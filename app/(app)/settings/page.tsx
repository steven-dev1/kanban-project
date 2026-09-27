"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/knowledge/ui";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { toDatabaseError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";
import type { KnowledgeRole, Profile } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "next-themes";
import { useState } from "react";

const ROLE_LABELS: Record<KnowledgeRole, string> = {
  viewer: "Viewer (solo lectura)",
  editor: "Editor (crear/editar)",
  admin: "Admin (acceso total)",
};

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();

  if (loading || !profile) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-lg font-semibold">Perfil y ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Actualiza tus datos personales y preferencias.
          </p>
        </div>

        <ProfileForm key={profile.id} profile={profile} email={user?.email ?? null} />
        <AppearanceSection />
      </div>
    </div>
  );
}

function ProfileForm({ profile, email }: { profile: Profile; email: string | null }) {
  const supabase = createClient();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, avatar_url: avatarUrl.trim() || null })
        .eq("id", profile.id);
      if (error) throw toDatabaseError(error);
      toast("Perfil actualizado");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Cuenta</h2>
      <Field label="Correo">
        <Input value={email ?? ""} disabled />
      </Field>
      <Field label="Nombre completo">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Tu nombre"
        />
      </Field>
      <Field label="URL del avatar" hint="Opcional. Enlace a una imagen.">
        <Input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Field label="Rol en el Knowledge Hub" hint="Solo un admin puede cambiarlo.">
        <Input value={ROLE_LABELS[profile.knowledge_role]} disabled />
      </Field>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </section>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Apariencia</h2>
      <Field label="Tema">
        <Select
          value={hydrated ? (theme ?? "system") : "system"}
          onChange={(value) => setTheme(value)}
          options={[
            { value: "light", label: "Claro" },
            { value: "dark", label: "Oscuro" },
            { value: "system", label: "Sistema" },
          ]}
        />
      </Field>
    </section>
  );
}
