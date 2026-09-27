"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { BoardFieldType } from "@/lib/types";
import { useBoard } from "@/providers/board-provider";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const FIELD_TYPE_LABELS: Record<BoardFieldType, string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  DATE: "Fecha",
  SELECT: "Selección",
  CHECKBOX: "Sí / No",
  USER: "Usuario",
};

export function BoardFieldsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { fields, createField, deleteField } = useBoard();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<BoardFieldType>("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const options =
        fieldType === "SELECT"
          ? optionsText
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined;
      await createField(name.trim(), fieldType, options);
      setName("");
      setOptionsText("");
      setFieldType("TEXT");
      toast("Campo creado");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Campos personalizados" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Los campos aplican a todas las tarjetas de este tablero y se editan dentro de cada tarjeta.
        </p>

        <ul className="space-y-1.5">
          {fields.map((field) => (
            <li
              key={field.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium">{field.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {FIELD_TYPE_LABELS[field.field_type]}
              </span>
              {field.options && field.options.length > 0 && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {field.options.join(", ")}
                </span>
              )}
              <button
                onClick={() => deleteField(field.id)}
                className="ml-auto rounded p-1 text-muted-foreground hover:text-danger"
                title="Eliminar campo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">Aún no hay campos personalizados.</p>
          )}
        </ul>

        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del campo (ej. Sprint)"
            />
            <Select
              value={fieldType}
              onChange={(v) => setFieldType(v as BoardFieldType)}
              options={Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
          {fieldType === "SELECT" && (
            <Input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Opciones separadas por coma (Alta, Media, Baja)"
            />
          )}
          <Button size="sm" onClick={submit} disabled={saving || !name.trim()}>
            <Plus className="h-3.5 w-3.5" /> {saving ? "Creando…" : "Agregar campo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
