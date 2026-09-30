import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV === "development";

// En desarrollo, Next/React DevTools abren websockets en localhost; los
// permitimos solo en dev para no romper HMR ni el inspector.
const connectSrc = [
  "connect-src 'self'",
  supabaseUrl,
  supabaseUrl ? `wss://${supabaseUrl.replace(/^https?:\/\//, "")}` : "",
  isDev ? "ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*" : "",
]
  .filter(Boolean)
  .join(" ")
  .trim();

// Cabeceras de seguridad aplicadas a todas las respuestas.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // CSP: se permite 'unsafe-inline'/'unsafe-eval' por el editor y Next en dev;
  // se restringe el resto al propio origen y a Supabase.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
