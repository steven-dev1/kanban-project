"use client";

import { Field, ObjectTypeBadge } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { RELATION_TYPES, RELATION_TYPE_LABELS } from "@/lib/knowledge/constants";
import type { OracleObjectWithRelations, RelationType } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { ArrowRight, Link2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export function RelationsPanel({
  object,
  canEdit,
}: {
  object: OracleObjectWithRelations;
  canEdit: boolean;
}) {
  const { objects, addRelation, deleteRelation, isAdmin } = useKnowledge();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const usage = useMemo(() => {
    // Who uses this object (incoming relations).
    return object.relations_as_target;
  }, [object.relations_as_target]);

  const outgoing = object.relations_as_source;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Utilizado por ({usage.length})
            </h3>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Relacionar
              </Button>
            )}
          </div>
          {usage.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
              Ningún objeto apunta a este todavía.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {usage.map((relation) => (
                <RelationRow
                  key={relation.id}
                  object={relation.source_object}
                  relationLabel={RELATION_TYPE_LABELS[relation.relation_type]}
                  description={relation.description}
                  canDelete={isAdmin}
                  onDelete={() => deleteRelation(relation.id).then(() => toast("Relación eliminada"))}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            Depende de / usa ({outgoing.length})
          </h3>
          {outgoing.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
              Este objeto no tiene dependencias documentadas.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {outgoing.map((relation) => (
                <RelationRow
                  key={relation.id}
                  object={relation.target_object}
                  relationLabel={RELATION_TYPE_LABELS[relation.relation_type]}
                  description={relation.description}
                  canDelete={isAdmin}
                  onDelete={() => deleteRelation(relation.id).then(() => toast("Relación eliminada"))}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        {object.snippet_count} consulta(s) SQL relacionada(s) con este objeto.
      </p>

      <RelationsDialog
        open={open}
        onClose={() => setOpen(false)}
        object={object}
        objects={objects}
        onSubmit={async (input) => {
          await addRelation(input);
          toast("Relación agregada");
        }}
      />
    </div>
  );
}

function RelationRow({
  object,
  relationLabel,
  description,
  canDelete,
  onDelete,
}: {
  object: { id: string; schema_name: string; object_name: string; object_type: OracleObjectWithRelations["object_type"] };
  relationLabel: string;
  description: string | null;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <Link
        href={`/knowledge/objects/${object.id}`}
        className="flex min-w-0 items-center gap-2 hover:text-primary"
      >
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <ObjectTypeBadge type={object.object_type} />
        <span className="truncate font-mono text-xs">
          {object.schema_name}.{object.object_name}
        </span>
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
          {relationLabel}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {description && (
          <span className="hidden max-w-[200px] truncate text-[11px] text-muted-foreground lg:inline">
            {description}
          </span>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
            aria-label="Eliminar relación"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

function RelationsDialog({
  open,
  onClose,
  object,
  objects,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  object: OracleObjectWithRelations;
  objects: OracleObjectWithRelations[];
  onSubmit: (input: {
    source_object_id: string;
    target_object_id: string;
    relation_type: RelationType;
    description: string | null;
  }) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState<RelationType>("DEPENDS_ON");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = objects.filter((o) => o.id !== object.id);

  const submit = async () => {
    setError(null);
    if (!targetId) return setError("Selecciona un objeto destino");
    setSaving(true);
    try {
      await onSubmit({
        source_object_id: object.id,
        target_object_id: targetId,
        relation_type: relationType,
        description: description.trim() || null,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Esa relación ya existe."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva relación" size="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Origen: </span>
          <span className="font-mono font-medium">
            {object.schema_name}.{object.object_name}
          </span>
        </div>
        <Field label="Tipo de relación">
          <Select
            value={relationType}
            onChange={(value) => setRelationType(value as RelationType)}
            options={RELATION_TYPES.map((type) => ({
              value: type,
              label: `${type} · ${RELATION_TYPE_LABELS[type]}`,
            }))}
          />
        </Field>
        <Field label="Objeto destino *">
          <Select
            value={targetId}
            onChange={setTargetId}
            placeholder="Selecciona objeto"
            options={candidates.map((o) => ({
              value: o.id,
              label: `${o.schema_name}.${o.object_name} (${o.object_type})`,
            }))}
          />
        </Field>
        <Field label="Descripción">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Crear relación"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
