"use client";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useBoard } from "@/providers/board-provider";
import { Mail, Shield, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";

export function MembersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    board,
    members,
    ownerProfile,
    invitations,
    isAdmin,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvitation,
  } = useBoard();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err" | "warn";
    text: string;
  } | null>(null);

  const owner = board?.owner_id;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setFeedback(null);
    const result = await inviteMember(email.trim(), role);
    setLoading(false);
    if (result.error) {
      setFeedback({ type: "err", text: result.error });
      return;
    }
    setEmail("");
    setFeedback({
      type: result.warning ? "warn" : "ok",
      text:
        result.warning ??
        "Invitación enviada. El usuario recibirá un correo y una notificación.",
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Miembros del tablero" size="md">
      <div className="flex flex-col gap-5">
        {isAdmin && (
          <form onSubmit={handleInvite} className="rounded-xl border border-border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="h-4 w-4" /> Invitar por correo
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="flex-1"
              />
              <Select
                value={role}
                onChange={(v) => setRole(v as Role)}
                className="sm:w-32"
                options={[
                  { value: "member", label: "Miembro" },
                  { value: "admin", label: "Admin" },
                ]}
              />
              <Button type="submit" disabled={loading}>
                Invitar
              </Button>
            </div>
            {feedback && (
              <p
                className={cn(
                  "mt-2 text-xs",
                  feedback.type === "ok" && "text-primary",
                  feedback.type === "err" && "text-danger",
                  feedback.type === "warn" && "text-amber-600 dark:text-amber-400",
                )}
              >
                {feedback.text}
              </p>
            )}
          </form>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Miembros ({members.length + 1})
          </p>
          <div className="flex flex-col gap-1">
            <MemberRow
              name={ownerProfile?.full_name}
              email={ownerProfile?.email}
              fallback="Propietario"
              roleLabel="Propietario"
              isYou={owner === user?.id}
            />
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
              >
                <Avatar name={m.profile?.full_name} email={m.profile?.email} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.profile?.full_name || "Usuario"}
                    {m.user_id === user?.id && (
                      <span className="ml-1 text-xs text-muted-foreground">(tú)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.profile?.email}
                  </p>
                </div>
                {isAdmin && m.user_id !== user?.id ? (
                  <>
                    <Select
                      value={m.role}
                      onChange={(v) => updateMemberRole(m.id, v as Role)}
                      className="w-28"
                      options={[
                        { value: "member", label: "Miembro" },
                        { value: "admin", label: "Admin" },
                      ]}
                    />
                    <button
                      onClick={() => removeMember(m.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                      title="Quitar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {m.role === "admin" && <Shield className="h-3 w-3" />}
                    {m.role === "admin" ? "Admin" : "Miembro"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {invitations.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Invitaciones pendientes
            </p>
            <div className="flex flex-col gap-1">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{inv.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {inv.role} · pendiente
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => cancelInvitation(inv.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                      title="Cancelar invitación"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MemberRow({
  name,
  email,
  fallback,
  roleLabel,
  isYou,
}: {
  name?: string | null;
  email?: string | null;
  fallback: string;
  roleLabel: string;
  isYou?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <Avatar name={name} email={email} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {name || fallback}
          {isYou && <span className="ml-1 text-xs text-muted-foreground">(tú)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
        <Shield className="h-3 w-3" /> {roleLabel}
      </span>
    </div>
  );
}
