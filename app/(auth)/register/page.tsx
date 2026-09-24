"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, type AuthResult } from "@/lib/utils";
import { KanbanSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const envMissing =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
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
      const { data, error } = await withTimeout<AuthResult>(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/boards`,
          },
        }) as PromiseLike<AuthResult>,
      );

      if (error) {
        setError(
          error.message === "User already registered"
            ? "Ese correo ya está registrado. Inicia sesión o usa otro."
            : error.message,
        );
        return;
      }
      if (data.session) {
        router.push("/boards");
        router.refresh();
        return;
      }
      setMessage("Cuenta creada. Revisa tu correo para confirmar tu cuenta.");
    } catch (err) {
      console.error("[register] error:", err);
      setError(
        err instanceof Error ? err.message : "Error inesperado al registrarse.",
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
        <h1 className="text-xl font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">Empieza a organizar tu trabajo</p>
      </div>

      {envMissing && (
        <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Faltan las variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          en .env.local. Reinicia el servidor tras crearlas.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Nombre</label>
          <Input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
          />
        </div>
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Contraseña</label>
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        {message && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            {message}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creando..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
