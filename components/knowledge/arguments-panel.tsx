"use client";

import { Field } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { OracleArgument } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const IN_OUT_OPTIONS = ["IN", "OUT", "IN OUT"];

export function ArgumentsPanel({
  objectId,
  args,
  canEdit,
}: {
  objectId: string;
  args: OracleArgument[];
  canEdit: boolean;
}) {
  const { addArgument, updateArgument, deleteArgument, isAdmin } = useKnowledge();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OracleArgument | null>(null);

  const nextPosition = args.length ? Math.max(...args.map((a) => a.position ?? 0)) + 1 : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {args.length} {args.length === 1 ? "argumento" : "argumentos"}
        </p>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Agregar argumento
          </Button>
        )}
      </div>

      {args.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Sin argumentos documentados.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">In/Out</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Descripción</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {args.map((arg) => (
                <tr key={arg.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{arg.position}</td>
                  <td className="px-3 py-2 font-mono text-xs font-medium">
                    {arg.argument_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{arg.data_type || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{arg.in_out}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                    {arg.description || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditing(arg);
                            setOpen(true);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() =>
                              deleteArgument(arg.id)
                                .then(() => toast("Argumento eliminado"))
                                .catch((e) => toast(e.message, "error"))
                            }
                            className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ArgumentDialog
        key={editing?.id ?? "new"}
        open={open}
        onClose={() => setOpen(false)}
        argument={editing}
        nextPosition={nextPosition}
        onSubmit={async (values) => {
          if (editing) await updateArgument(editing.id, values);
          else await addArgument(objectId, values);
          toast(editing ? "Argumento actualizado" : "Argumento agregado");
        }}
      />
    </div>
  );
}

function ArgumentDialog({
  open,
  onClose,
  argument,
  nextPosition,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  argument: OracleArgument | null;
  nextPosition: number;
  onSubmit: (values: {
    argument_name: string;
    position: number;
    data_type: string | null;
    in_out: "IN" | "OUT" | "IN OUT";
    description: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(argument?.argument_name ?? "");
  const [position, setPosition] = useState(String(argument?.position ?? nextPosition));
  const [dataType, setDataType] = useState(argument?.data_type ?? "");
  const [inOut, setInOut] = useState<"IN" | "OUT" | "IN OUT">(argument?.in_out ?? "IN");
  const [description, setDescription] = useState(argument?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("El nombre del argumento es obligatorio");
    const parsedPosition = Number(position);
    if (!Number.isFinite(parsedPosition) || parsedPosition < 0) {
      return setError("La posición debe ser un número válido");
    }
    setSaving(true);
    try {
      await onSubmit({
        argument_name: name.trim(),
        position: parsedPosition,
        data_type: dataType.trim() || null,
        in_out: inOut,
        description: description.trim() || null,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Ya existe un argumento en esa posición."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={argument ? "Editar argumento" : "Nuevo argumento"} size="md">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="P_EMPRESA"
            />
          </Field>
          <Field label="Posición">
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="1" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de dato">
            <Input
              value={dataType}
              onChange={(e) => setDataType(e.target.value.toUpperCase())}
              placeholder="NUMBER"
            />
          </Field>
          <Field label="In / Out">
            <Select
              value={inOut}
              onChange={(value) => setInOut(value as "IN" | "OUT" | "IN OUT")}
              options={IN_OUT_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </Field>
        </div>
        <Field label="Descripción">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : argument ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
