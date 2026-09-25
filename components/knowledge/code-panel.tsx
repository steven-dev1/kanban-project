"use client";

import { CodeBlock } from "@/components/knowledge/code-block";
import { ExportMenu, type ExportAction } from "@/components/knowledge/export-menu";
import { EnvironmentBadge, Field } from "@/components/knowledge/ui";
import { VersionComparator } from "@/components/knowledge/version-comparator";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ENVIRONMENTS, ENVIRONMENT_LABELS } from "@/lib/knowledge/constants";
import { objectCodeFileName } from "@/lib/knowledge/format";
import type { Environment, OracleCodeVersion, SourceType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { GitCompareArrows, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export function CodePanel({
  objectId,
  objectName,
  sourceType,
  versions,
  canEdit,
  emptyLabel,
}: {
  objectId: string;
  objectName: string;
  sourceType: SourceType;
  versions: OracleCodeVersion[];
  canEdit: boolean;
  emptyLabel: string;
}) {
  const { addCodeVersion } = useKnowledge();
  const { toast } = useToast();

  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [versions],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const selected = sorted.find((v) => v.id === selectedId) ?? sorted[0] ?? null;
  const selectedEnv = selected?.environment ?? "DEV";

  const exportActions: ExportAction[] = selected
    ? [
        { label: "Copiar código", content: selected.source_code },
        {
          label: "Exportar .sql",
          content: selected.source_code,
          fileName: objectCodeFileName(objectName, sourceType, selectedEnv, "sql"),
        },
        {
          label: "Exportar .txt",
          content: selected.source_code,
          fileName: objectCodeFileName(objectName, sourceType, selectedEnv, "txt"),
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "versión" : "versiones"}
        </p>
        <div className="flex items-center gap-2">
          {sorted.length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setCompare((v) => !v)}>
              <GitCompareArrows className="h-3.5 w-3.5" />
              {compare ? "Ver código" : "Comparar versiones"}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nueva versión
            </Button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : compare ? (
        <VersionComparator versions={versions} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            {selected && (
              <CodeBlock
                value={selected.source_code}
                title={`v${selected.version_number} · ${selectedEnv}`}
                actions={<ExportMenu actions={exportActions} />}
              />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Historial</h3>
            <ul className="space-y-1.5">
              {sorted.map((version) => (
                <li key={version.id}>
                  <button
                    onClick={() => setSelectedId(version.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selected?.id === version.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold">v{version.version_number}</span>
                      {version.environment && (
                        <EnvironmentBadge environment={version.environment} />
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(version.created_at)}
                    </div>
                    {version.change_description && (
                      <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {version.change_description}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <NewVersionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (input) => {
          await addCodeVersion(objectId, { ...input, source_type: sourceType });
          toast("Versión creada");
        }}
        defaultCode={selected?.source_code ?? ""}
      />
    </div>
  );
}

function NewVersionDialog({
  open,
  onClose,
  onSubmit,
  defaultCode,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    version_number: string;
    environment: Environment;
    source_code: string;
    change_description: string | null;
  }) => Promise<void>;
  defaultCode: string;
}) {
  const [versionNumber, setVersionNumber] = useState("1");
  const [environment, setEnvironment] = useState<Environment>("DEV");
  const [code, setCode] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!versionNumber.trim()) return setError("El número de versión es obligatorio");
    if (!code.trim()) return setError("El código no puede estar vacío");
    setSaving(true);
    try {
      await onSubmit({
        version_number: versionNumber.trim(),
        environment,
        source_code: code,
        change_description: changeDescription.trim() || null,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Ya existe una versión con ese número en ese ambiente."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva versión de código" size="xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número de versión *">
            <Input
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              placeholder="1.5"
            />
          </Field>
          <Field label="Ambiente *">
            <Select
              value={environment}
              onChange={(value) => setEnvironment(value as Environment)}
              options={ENVIRONMENTS.map((env) => ({
                value: env,
                label: `${env} · ${ENVIRONMENT_LABELS[env]}`,
              }))}
            />
          </Field>
        </div>
        <Field label="Descripción del cambio">
          <Input
            value={changeDescription}
            onChange={(e) => setChangeDescription(e.target.value)}
            placeholder="Se agregó validación de empresa"
          />
        </Field>
        <Field label="Código *" hint="Se conservan saltos de línea, indentación y comentarios.">
          <Textarea
            rows={14}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="font-mono text-[12.5px]"
            placeholder="CREATE OR REPLACE …"
          />
        </Field>
        <button
          type="button"
          onClick={() => setCode(defaultCode)}
          className="text-xs text-primary hover:underline"
        >
          Usar el código de la versión seleccionada como base
        </button>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Crear versión"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
