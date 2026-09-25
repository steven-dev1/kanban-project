"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/knowledge/ui";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { OBJECT_TYPE_LABELS, OBJECT_TYPES } from "@/lib/knowledge/constants";
import type { OracleObject, OracleObjectType } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { useState } from "react";

const NONE = "__none__";

export function ObjectDialog({
  open,
  onClose,
  object,
  defaultType,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  object?: OracleObject | null;
  defaultType?: OracleObjectType;
  onCreated?: (object: OracleObject) => void;
}) {
  const { createObject, updateObject, profiles } = useKnowledge();
  const { toast } = useToast();
  const editing = !!object;

  const [schemaName, setSchemaName] = useState(object?.schema_name ?? "");
  const [objectName, setObjectName] = useState(object?.object_name ?? "");
  const [objectType, setObjectType] = useState<OracleObjectType>(
    object?.object_type ?? defaultType ?? "TABLE",
  );
  const [description, setDescription] = useState(object?.description ?? "");
  const [functionalDescription, setFunctionalDescription] = useState(
    object?.functional_description ?? "",
  );
  const [module, setModule] = useState(object?.module ?? "");
  const [owner, setOwner] = useState(object?.owner ?? NONE);
  const [notes, setNotes] = useState(object?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!schemaName.trim()) return setError("El schema es obligatorio");
    if (!objectName.trim()) return setError("El nombre del objeto es obligatorio");

    setSaving(true);
    try {
      const payload = {
        schema_name: schemaName.trim().toUpperCase(),
        object_name: objectName.trim().toUpperCase(),
        object_type: objectType,
        description: description.trim() || null,
        functional_description: functionalDescription.trim() || null,
        module: module.trim() || null,
        owner: owner === NONE ? null : owner,
        notes: notes.trim() || null,
      };
      if (editing && object) {
        await updateObject(object.id, payload);
        toast("Objeto actualizado");
        onClose();
      } else {
        const created = await createObject(payload);
        toast("Objeto creado");
        onCreated?.(created as OracleObject);
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Ya existe un objeto con ese schema, nombre y tipo."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar objeto" : "Nuevo objeto"} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Schema *">
            <Input
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value.toUpperCase())}
              placeholder="SP6DF"
            />
          </Field>
          <Field label="Nombre *">
            <Input
              value={objectName}
              onChange={(e) => setObjectName(e.target.value.toUpperCase())}
              placeholder="VG_TIQUETES"
            />
          </Field>
        </div>

        <Field label="Tipo *">
          <Select
            value={objectType}
            onChange={(value) => setObjectType(value as OracleObjectType)}
            options={OBJECT_TYPES.map((type) => ({
              value: type,
              label: `${type} · ${OBJECT_TYPE_LABELS[type]}`,
            }))}
          />
        </Field>

        <Field label="Descripción técnica">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qué es este objeto"
          />
        </Field>

        <Field label="Descripción funcional">
          <Textarea
            rows={3}
            value={functionalDescription}
            onChange={(e) => setFunctionalDescription(e.target.value)}
            placeholder="Para qué sirve en el negocio"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Módulo">
            <Input
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="Tiquetes, SAP, Contabilidad…"
            />
          </Field>
          <Field label="Responsable">
            <Select
              value={owner}
              onChange={setOwner}
              placeholder="Sin asignar"
              options={[
                { value: NONE, label: "Sin asignar" },
                ...profiles.map((p) => ({
                  value: p.id,
                  label: p.full_name || p.email || p.id,
                })),
              ]}
            />
          </Field>
        </div>

        <Field label="Notas">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas libres"
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear objeto"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
