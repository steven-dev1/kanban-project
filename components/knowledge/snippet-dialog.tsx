"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/knowledge/ui";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  DATABASE_TYPES,
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  SQL_CATEGORIES,
} from "@/lib/knowledge/constants";
import type {
  DatabaseType,
  Environment,
  SqlCategory,
  SqlSnippet,
} from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { useState } from "react";

const NONE = "__none__";

export function SnippetDialog({
  open,
  onClose,
  snippet,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  snippet?: SqlSnippet | null;
  onCreated?: (snippet: SqlSnippet) => void;
}) {
  const { createSnippet, updateSnippet } = useKnowledge();
  const { toast } = useToast();
  const editing = !!snippet;

  const [title, setTitle] = useState(snippet?.title ?? "");
  const [description, setDescription] = useState(snippet?.description ?? "");
  const [sqlCode, setSqlCode] = useState(snippet?.sql_code ?? "");
  const [category, setCategory] = useState<SqlCategory>(snippet?.category ?? "Consulta");
  const [databaseType, setDatabaseType] = useState<DatabaseType>(
    snippet?.database_type ?? "Oracle",
  );
  const [schemaName, setSchemaName] = useState(snippet?.schema_name ?? "");
  const [environment, setEnvironment] = useState<string>(snippet?.environment ?? NONE);
  const [notes, setNotes] = useState(snippet?.notes ?? "");
  const [warnings, setWarnings] = useState(snippet?.warnings ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("El título es obligatorio");
    if (!sqlCode.trim()) return setError("El SQL no puede estar vacío");

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        sql_code: sqlCode,
        category,
        database_type: databaseType,
        schema_name: schemaName.trim() || null,
        environment: environment === NONE ? null : (environment as Environment),
        notes: notes.trim() || null,
        warnings: warnings.trim() || null,
      };
      if (editing && snippet) {
        await updateSnippet(snippet.id, payload);
        toast("Consulta actualizada");
        onClose();
      } else {
        const created = await createSnippet(payload);
        toast("Consulta creada");
        onCreated?.(created as SqlSnippet);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar consulta" : "Nueva consulta SQL"} size="xl">
      <div className="space-y-4">
        <Field label="Título *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Consulta de kilómetros por pasajero"
          />
        </Field>

        <Field label="Descripción">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qué resuelve esta consulta"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Categoría">
            <Select
              value={category}
              onChange={(value) => setCategory(value as SqlCategory)}
              options={SQL_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Base de datos">
            <Select
              value={databaseType}
              onChange={(value) => setDatabaseType(value as DatabaseType)}
              options={DATABASE_TYPES.map((d) => ({ value: d, label: d }))}
            />
          </Field>
          <Field label="Ambiente">
            <Select
              value={environment}
              onChange={setEnvironment}
              options={[
                { value: NONE, label: "Sin especificar" },
                ...ENVIRONMENTS.map((env) => ({
                  value: env,
                  label: `${env} · ${ENVIRONMENT_LABELS[env]}`,
                })),
              ]}
            />
          </Field>
        </div>

        <Field label="Schema">
          <Input
            value={schemaName}
            onChange={(e) => setSchemaName(e.target.value.toUpperCase())}
            placeholder="SP6DF"
          />
        </Field>

        <Field label="SQL *" hint="El sistema solo almacena y muestra la consulta; nunca la ejecuta.">
          <Textarea
            rows={10}
            value={sqlCode}
            onChange={(e) => setSqlCode(e.target.value)}
            spellCheck={false}
            className="font-mono text-[12.5px]"
            placeholder="SELECT * FROM SP6DF.VG_TIQUETES WHERE ..."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Advertencias">
            <Textarea
              rows={2}
              value={warnings}
              onChange={(e) => setWarnings(e.target.value)}
              placeholder="Cuidados al ejecutar"
            />
          </Field>
          <Field label="Notas">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas libres"
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear consulta"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
