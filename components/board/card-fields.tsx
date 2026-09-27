"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { CardWithLabels } from "@/lib/types";
import { useBoard } from "@/providers/board-provider";
import { ListChecks } from "lucide-react";

const CHECKBOX_YES = "true";

/** Campos personalizados del tablero aplicados a esta tarjeta. */
export function CardFields({ card, canEdit }: { card: CardWithLabels; canEdit: boolean }) {
  const { fields, members, ownerProfile, board, setCardFieldValue } = useBoard();
  const { toast } = useToast();

  if (fields.length === 0) return null;

  const valueFor = (fieldId: string) =>
    card.card_field_values?.find((v) => v.field_id === fieldId)?.value ?? "";

  const people = [
    ...(board ? [{ id: board.owner_id, label: ownerProfile?.full_name || ownerProfile?.email || "Propietario" }] : []),
    ...members.map((m) => ({
      id: m.user_id,
      label: m.profile?.full_name || m.profile?.email || "Usuario",
    })),
  ];

  const save = (fieldId: string, value: string | null) => {
    setCardFieldValue(card.id, fieldId, value).catch((err) =>
      toast(err instanceof Error ? err.message : "No se pudo guardar el campo", "error"),
    );
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" /> Campos
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const value = valueFor(field.id);
          return (
            <div key={field.id} className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">{field.name}</span>
              {field.field_type === "SELECT" ? (
                <Select
                  disabled={!canEdit}
                  value={value || "__none__"}
                  onChange={(v) => save(field.id, v === "__none__" ? null : v)}
                  options={[
                    { value: "__none__", label: "—" },
                    ...(field.options ?? []).map((o) => ({ value: o, label: o })),
                  ]}
                />
              ) : field.field_type === "USER" ? (
                <Select
                  disabled={!canEdit}
                  value={value || "__none__"}
                  onChange={(v) => save(field.id, v === "__none__" ? null : v)}
                  options={[
                    { value: "__none__", label: "—" },
                    ...people.map((p) => ({ value: p.id, label: p.label })),
                  ]}
                />
              ) : field.field_type === "CHECKBOX" ? (
                <label className="flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={value === CHECKBOX_YES}
                    onChange={(e) => save(field.id, e.target.checked ? CHECKBOX_YES : null)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {value === CHECKBOX_YES ? "Sí" : "No"}
                </label>
              ) : field.field_type === "DATE" ? (
                <Input
                  type="date"
                  disabled={!canEdit}
                  value={value}
                  onChange={(e) => save(field.id, e.target.value || null)}
                  className="h-9"
                />
              ) : field.field_type === "NUMBER" ? (
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={value}
                  onChange={(e) => save(field.id, e.target.value || null)}
                  className="h-9"
                />
              ) : (
                <Input
                  disabled={!canEdit}
                  value={value}
                  onChange={(e) => save(field.id, e.target.value || null)}
                  className="h-9"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
