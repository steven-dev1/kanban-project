"use client";

import { EnvironmentBadge, Field, StatusBadge } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  ENVIRONMENT_LABELS,
  ENVIRONMENT_STATUSES,
  ENVIRONMENT_STATUS_LABELS,
  ENVIRONMENTS,
} from "@/lib/knowledge/constants";
import type {
  Environment,
  EnvironmentStatus,
  OracleObjectEnvironment,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { Pencil } from "lucide-react";
import { useState } from "react";

export function EnvironmentsPanel({
  objectId,
  environments,
  canEdit,
}: {
  objectId: string;
  environments: OracleObjectEnvironment[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Environment | null>(null);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {ENVIRONMENTS.map((environment) => {
          const info = environments.find((e) => e.environment === environment);
          return (
            <div key={environment} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EnvironmentBadge environment={environment} />
                  <span className="text-xs text-muted-foreground">
                    {ENVIRONMENT_LABELS[environment]}
                  </span>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setEditing(environment)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Editar ambiente"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Versión</dt>
                  <dd className="font-mono font-medium">{info?.version || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    <StatusBadge status={info?.status ?? "UNKNOWN"} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Verificado</dt>
                  <dd>{formatDate(info?.last_verified_at) || "—"}</dd>
                </div>
                {info?.notes && (
                  <div className="pt-1 text-muted-foreground">{info.notes}</div>
                )}
              </dl>
            </div>
          );
        })}
      </div>

      <EnvironmentDialog
        key={editing ?? "none"}
        open={!!editing}
        environment={editing}
        objectId={objectId}
        current={environments.find((e) => e.environment === editing) ?? null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function EnvironmentDialog({
  open,
  onClose,
  objectId,
  environment,
  current,
}: {
  open: boolean;
  onClose: () => void;
  objectId: string;
  environment: Environment | null;
  current: OracleObjectEnvironment | null;
}) {
  const { upsertEnvironment } = useKnowledge();
  const { toast } = useToast();
  const [version, setVersion] = useState(current?.version ?? "");
  const [status, setStatus] = useState<EnvironmentStatus>(current?.status ?? "UNKNOWN");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [verified, setVerified] = useState(!!current?.last_verified_at);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!environment) return;
    setSaving(true);
    try {
      await upsertEnvironment(objectId, environment, {
        version: version.trim() || null,
        status,
        notes: notes.trim() || null,
        last_verified_at: verified ? new Date().toISOString() : (current?.last_verified_at ?? null),
      });
      toast("Ambiente actualizado");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ambiente ${environment ?? ""}`}
      size="md"
    >
      <div className="space-y-4">
        <Field label="Versión">
          <Input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.5"
          />
        </Field>
        <Field label="Estado">
          <Select
            value={status}
            onChange={(value) => setStatus(value as EnvironmentStatus)}
            options={ENVIRONMENT_STATUSES.map((s) => ({
              value: s,
              label: ENVIRONMENT_STATUS_LABELS[s],
            }))}
          />
        </Field>
        <Field label="Notas">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Marcar como verificado hoy
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
