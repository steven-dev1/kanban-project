"use client";

import { Field } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { toDatabaseError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/client";
import type { Profile, SharedItem } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";

export function SendItemDialog({
  open,
  onClose,
  itemType,
  itemId,
  itemLabel,
}: {
  open: boolean;
  onClose: () => void;
  itemType: SharedItem["item_type"];
  itemId: string;
  itemLabel: string;
}) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    // Directorio completo (SECURITY DEFINER) para elegir destinatario aunque
    // no comparta tablero con el usuario.
    supabase
      .rpc("list_directory")
      .then((res: { data: Profile[] | null }) => {
        if (active) setProfiles((res.data ?? []).filter((p) => p.id !== user.id));
      });
    return () => {
      active = false;
    };
  }, [open, user, supabase]);

  const send = async () => {
    setError(null);
    if (!user) return;
    if (!recipient) return setError("Selecciona un destinatario");
    setSending(true);
    try {
      const { error: insertError } = await supabase.from("shared_items").insert({
        sender_id: user.id,
        recipient_id: recipient,
        item_type: itemType,
        item_id: itemId,
        item_label: itemLabel,
        message: message.trim() || null,
      });
      if (insertError) throw toDatabaseError(insertError);
      toast("Objeto enviado");
      setMessage("");
      setRecipient("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Enviar: ${itemLabel}`} size="md">
      <div className="space-y-4">
        <Field label="Destinatario *">
          <Select
            value={recipient}
            onChange={setRecipient}
            placeholder="Selecciona un usuario"
            options={profiles.map((p) => ({
              value: p.id,
              label: p.full_name || p.email || p.id,
            }))}
          />
        </Field>
        <Field label="Mensaje" hint="Opcional. Se envía como notificación interna.">
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Te comparto este objeto para revisarlo…"
          />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={sending || profiles.length === 0}>
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
