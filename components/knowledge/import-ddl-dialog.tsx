"use client";

import { CodeEditor } from "@/components/knowledge/code-editor";
import { Field } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { parseTableDdl, type ParsedColumn } from "@/lib/knowledge/parse-ddl";
import type { OracleObject, OracleObjectType } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { useMemo, useState } from "react";

function typeLabel(column: ParsedColumn) {
  if (column.data_precision != null) {
    return `${column.data_type}(${column.data_precision}${
      column.data_scale != null ? `,${column.data_scale}` : ""
    })`;
  }
  if (column.data_length != null) return `${column.data_type}(${column.data_length})`;
  return column.data_type ?? "";
}

export function ImportDdlDialog({
  open,
  onClose,
  defaultType,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  defaultType?: OracleObjectType;
  onImported?: (object: OracleObject) => void;
}) {
  const { createObject, addColumn } = useKnowledge();
  const { toast } = useToast();

  const [ddl, setDdl] = useState("");
  const [schemaInput, setSchemaInput] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [overrides] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseTableDdl(ddl), [ddl]);
  const schema = schemaInput ?? parsed.schema_name?.toUpperCase() ?? "SP6DF";
  const name = nameInput ?? parsed.object_name ?? "";

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("El nombre del objeto es obligatorio");
    if (parsed.columns.length === 0) {
      return setError("No se detectaron columnas en el DDL");
    }

    setSaving(true);
    try {
      const created = await createObject({
        schema_name: schema.trim().toUpperCase(),
        object_name: name.trim().toUpperCase(),
        object_type: parsed.object_type ?? defaultType ?? "TABLE",
        description: description.trim() || null,
      });
      if (!created) throw new Error("No se pudo crear el objeto");

      for (const column of parsed.columns) {
        await addColumn(created.id, {
          column_name: column.column_name,
          data_type: column.data_type,
          data_length: overrides[`${column.column_name}:length`] ?? column.data_length,
          data_precision: overrides[`${column.column_name}:precision`] ?? column.data_precision,
          data_scale: overrides[`${column.column_name}:scale`] ?? column.data_scale,
          nullable: column.nullable,
          column_order: column.column_order,
          description: column.description,
        });
      }

      toast(`Objeto creado con ${parsed.columns.length} columna(s)`);
      onImported?.(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Importar DDL de tabla o vista" size="xl">
      <div className="space-y-4">
        <Field label="DDL (CREATE TABLE / CREATE VIEW)" hint="Pega el script de creación.">
          <CodeEditor
            value={ddl}
            onChange={setDdl}
            minLines={10}
            maxHeight={300}
            placeholder={"CREATE TABLE SP6DF.VG_TIQUETES (\n  NUMERO_TIQUETE NUMBER(10) NOT NULL,\n  C_EMP VARCHAR2(5),\n  ...\n);"}
          />
        </Field>

        {parsed.warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            {parsed.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Schema *">
            <Input value={schema} onChange={(e) => setSchemaInput(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Nombre *">
            <Input value={name} onChange={(e) => setNameInput(e.target.value.toUpperCase())} />
          </Field>
        </div>

        <Field label="Descripción">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción del objeto (opcional)"
          />
        </Field>

        {parsed.columns.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium">
              Columnas detectadas ({parsed.columns.length})
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Columna</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Nullable</th>
                    <th className="px-3 py-2">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.columns.map((column) => (
                    <tr key={column.column_name} className="border-t border-border">
                      <td className="px-3 py-1.5 text-muted-foreground">{column.column_order}</td>
                      <td className="px-3 py-1.5 font-mono">{column.column_name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{typeLabel(column)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {column.nullable ? "Sí" : "No"}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {column.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || parsed.columns.length === 0}>
            {saving ? "Importando…" : `Importar ${parsed.columns.length} columnas`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
