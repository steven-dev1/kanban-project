"use client";

import { Field } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { OracleObject } from "@/lib/types";

export function DuplicateObjectDialog({
  open,
  onClose,
  object,
  defaultSchema,
  defaultName,
  saving,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  object: OracleObject;
  defaultSchema: string;
  defaultName: string;
  saving: boolean;
  error: string | null;
  onSubmit: (values: { schema_name: string; object_name: string }) => void;
}) {
  // El diálogo se monta con key cuando cambia el objeto/abre, así que el estado
  // inicial se toma directamente de los valores por defecto.
  return (
    <Modal open={open} onClose={onClose} title={`Duplicar ${object.object_name}`} size="md">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const schemaName = (form.elements.namedItem("schema") as HTMLInputElement).value;
          const objectName = (form.elements.namedItem("name") as HTMLInputElement).value;
          onSubmit({
            schema_name: schemaName.trim().toUpperCase(),
            object_name: objectName.trim().toUpperCase(),
          });
        }}
      >
        <p className="text-xs text-muted-foreground">
          Se copian columnas, valores, argumentos, código, ambientes y etiquetas. Ajusta el nombre
          para crear una variación.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Schema *">
            <Input name="schema" defaultValue={defaultSchema} />
          </Field>
          <Field label="Nuevo nombre *">
            <Input name="name" defaultValue={defaultName} />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Duplicando…" : "Duplicar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
