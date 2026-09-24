import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RuntimeDiagnostics } from "@/components/layout/runtime-diagnostics";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kanban",
  description: "Tableros kanban en tiempo real con Supabase",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <AuthProvider initialUser={user}>{children}</AuthProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function s(m){var b=document.getElementById('runtime-errors');if(!b)return;b.setAttribute('data-open','1');var d=document.createElement('div');d.textContent=m;b.appendChild(d);}window.addEventListener('error',function(e){var t=e.target;if(t&&(t.tagName==='SCRIPT'||t.tagName==='LINK')){s('[recurso que fallo] '+t.tagName+' '+(t.src||t.href));}},true);window.addEventListener('unhandledrejection',function(e){s('[promesa] '+((e.reason&&e.reason.message)||String(e.reason)));});})();",
          }}
        />
        <RuntimeDiagnostics />
        <div id="boot-warning">
          El JavaScript del cliente no cargó o la página no se hidrató. Abre la
          consola (F12) y revisa que <code>/_next/static</code> cargue con 200.
        </div>
        <div id="runtime-errors" />
      </body>
    </html>
  );
}
