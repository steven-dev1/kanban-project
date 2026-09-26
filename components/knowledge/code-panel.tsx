"use client";

import { CodeBlock } from "@/components/knowledge/code-block";
import { CodeEditor } from "@/components/knowledge/code-editor";
import { ExportMenu, type ExportAction } from "@/components/knowledge/export-menu";
import { EnvironmentBadge, Field } from "@/components/knowledge/ui";
import { VersionComparator } from "@/components/knowledge/version-comparator";
import { SyntaxReport, useValidation } from "@/components/knowledge/syntax-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { addCodeVersion, updateCodeVersion, profiles } = useKnowledge();
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
              <>
                <CodeBlock
                  value={selected.source_code}
                  title={`v${selected.version_number} · ${selectedEnv}`}
                  editable={canEdit}
                  onChange={
                    canEdit
                      ? async (value) => {
                          await updateCodeVersion(selected.id, { source_code: value });
                          toast("Versión actualizada");
                        }
                      : undefined
                  }
                  actions={<ExportMenu actions={exportActions} />}
                />
                {canEdit && (
                  <VersionDescriptionEditor
                    key={selected.id}
                    version={selected}
                    onSave={async (description) => {
                      await updateCodeVersion(selected.id, { change_description: description });
                      toast("Descripción actualizada");
                    }}
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Estás editando la versión <strong>v{selected.version_number}</strong> (se modifica
                  en el lugar). Usa <strong>Nueva versión</strong> para cambios que quieras dejar
                  registrados como una versión distinta.
                </p>
              </>
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
                      <span className="flex items-center gap-1">
                        {version.id === sorted[0]?.id && (
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase">
                            Actual
                          </span>
                        )}
                        {version.environment && (
                          <EnvironmentBadge environment={version.environment} />
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(version.created_at)} ·{" "}
                      {(() => {
                        const author = profiles.find((p) => p.id === version.created_by);
                        return author?.full_name || author?.email || "Usuario";
                      })()}
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
        key={dialogOpen ? "open" : "closed"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (input) => {
          await addCodeVersion(objectId, { ...input, source_type: sourceType });
          toast("Versión creada");
        }}
        defaultCode={selected?.source_code ?? ""}
        versions={versions}
      />
    </div>
  );
}

function VersionDescriptionEditor({
  version,
  onSave,
}: {
  version: OracleCodeVersion;
  onSave: (description: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState(version.change_description ?? "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const commit = async () => {
    const next = value.trim() || null;
    if ((version.change_description ?? null) === next) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={saving}
        placeholder="Descripción del cambio (queda en el registro)"
        className="h-8 text-xs"
      />
      {saving && <span className="shrink-0 text-[10px] text-muted-foreground">Guardando…</span>}
    </div>
  );
}

function NewVersionDialog({
  open,
  onClose,
  onSubmit,
  defaultCode,
  versions,
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
  versions: OracleCodeVersion[];
}) {
  const sortedByDate = [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latest = sortedByDate[sortedByDate.length - 1] ?? null;
  const suggestedVersion = latest ? String(Number(latest.version_number) + 1) : "1";

  const [versionNumber, setVersionNumber] = useState(suggestedVersion);
  const [environment, setEnvironment] = useState<Environment>("DEV");
  const [code, setCode] = useState(defaultCode);
  const [changeDescription, setChangeDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = useValidation(code);

  const normalized = (value: string) =>
    (value ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();

  const envVersions = versions.filter((v) => v.environment === environment);
  const latestEnv =
    [...envVersions].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-1)[0] ?? null;
  const noChanges = !!latestEnv && normalized(latestEnv.source_code) === normalized(code);
  const parsedVersion = Number(versionNumber);
  const duplicateNumber =
    versionNumber.trim() !== "" &&
    Number.isFinite(parsedVersion) &&
    envVersions.some((v) => Number(v.version_number) === parsedVersion);

  const submit = async () => {
    setError(null);
    if (!versionNumber.trim()) return setError("El número de versión es obligatorio");
    if (!code.trim()) return setError("El código no puede estar vacío");
    if (validation.errors.length > 0) {
      return setError("Hay errores de sintaxis. Corrígelos antes de guardar.");
    }
    if (duplicateNumber) {
      return setError(`La versión ${versionNumber} ya existe en ${environment}.`);
    }
    if (noChanges) {
      return setError("No hay cambios respecto a la versión actual de ese ambiente.");
    }
    if (versions.length > 0 && !changeDescription.trim()) {
      return setError("Describe el cambio realizado (queda en el registro de versiones).");
    }
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
        <Field
          label="Número de versión *"
          hint={
            duplicateNumber
              ? `La versión ${versionNumber} ya existe en ${environment}.`
              : `Sugerida: ${suggestedVersion}`
          }
        >
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
        <Field
          label={versions.length > 0 ? "Descripción del cambio *" : "Descripción del cambio"}
          hint={versions.length > 0 ? "Se guarda en el registro de cambios." : undefined}
        >
          <Input
            value={changeDescription}
            onChange={(e) => setChangeDescription(e.target.value)}
            placeholder="Se agregó validación de empresa"
          />
        </Field>
        <Field label="Código *" hint="Tab para indentar. Se conservan saltos de línea, indentación y comentarios.">
          <CodeEditor
            value={code}
            onChange={setCode}
            minLines={14}
            maxHeight={440}
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
        <SyntaxReport result={validation} />
        {noChanges && latestEnv && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            Sin cambios respecto a la versión {latestEnv.version_number} de {environment}. No se
            puede crear una versión idéntica.
          </p>
        )}
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={
              saving || validation.errors.length > 0 || noChanges || duplicateNumber
            }
          >
            {saving ? "Guardando…" : "Crear versión"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
