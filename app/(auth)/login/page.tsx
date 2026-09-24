"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, type AuthResult } from "@/lib/utils";
import { KanbanSquare } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/boards";

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();

      if (mode === "magic") {
        const { error } = await withTimeout<AuthResult>(
          supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
            },
          }) as PromiseLike<AuthResult>,
        );
        if (error) setError(error.message);
        else setMessage("Te enviamos un enlace mágico a tu correo.");
        return;
      }

      const { error } = await withTimeout<AuthResult>(
        supabase.auth.signInWithPassword({ email, password }) as PromiseLike<AuthResult>,
      );
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : error.message === "Email not confirmed"
              ? "Debes confirmar tu correo antes de iniciar sesión."
              : error.message,
        );
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error("[login] error:", err);
      setError(
        err instanceof Error ? err.message : "Error inesperado al iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KanbanSquare className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-semibold">Inicia sesión en Kanban</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tus tableros en tiempo real
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Correo</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
          />
        </div>

        {mode === "password" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Contraseña</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        {message && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            {message}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Cargando..." : mode === "magic" ? "Enviar enlace mágico" : "Entrar"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "password" ? "magic" : "password"));
          setError(null);
          setMessage(null);
        }}
        className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "password" ? "Entrar con enlace mágico" : "Entrar con contraseña"}
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
