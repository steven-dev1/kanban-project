"use client";

import { ArgumentsPanel } from "@/components/knowledge/arguments-panel";
import { CodePanel } from "@/components/knowledge/code-panel";
import { ColumnsPanel } from "@/components/knowledge/columns-panel";
import { DuplicateObjectDialog } from "@/components/knowledge/duplicate-object-dialog";
import { EnvironmentsPanel } from "@/components/knowledge/environments-panel";
import { ObjectAiActions } from "@/components/knowledge/object-ai-actions";
import { ExportMenu, type ExportAction } from "@/components/knowledge/export-menu";
import { ObjectDialog } from "@/components/knowledge/object-dialog";
import { RelationsPanel } from "@/components/knowledge/relations-panel";
import { SendItemDialog } from "@/components/messages/send-item-dialog";
import { TagPicker } from "@/components/knowledge/tag-picker";
import { EnvironmentBadge, ObjectTypeBadge, Skeleton } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { ENVIRONMENTS, ENVIRONMENT_LABELS, OBJECT_TYPE_LABELS, objectListPath } from "@/lib/knowledge/constants";
import { ddlFileName, objectToDdl } from "@/lib/knowledge/ddl";
import {
  displayObjectName,
  ensureTrailingNewline,
  objectCodeFileName,
} from "@/lib/knowledge/format";
import { recordRecent } from "@/lib/knowledge/recent";
import type { Environment, OracleCodeVersion, SourceType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import {
  ArrowLeft,
  Code2,
  Columns3,
  CopyPlus,
  Download,
  GitBranch,
  Info,
  Layers,
  Link2,
  ListTree,
  Pencil,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TabKey = "info" | "columns" | "code" | "spec" | "body" | "args" | "environments" | "impact";

const CODE_TYPES = new Set(["PROCEDURE", "FUNCTION", "PACKAGE"]);

export function ObjectDetail({ objectId }: { objectId: string }) {
  const {
    objects,
    profiles,
    loading,
    canEdit,
    isAdmin,
    deleteObject,
    duplicateObject,
    toggleObjectFavorite,
    toggleObjectTag,
  } = useKnowledge();
  const confirm = useConfirm();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const object = objects.find((o) => o.id === objectId) ?? null;
  // Enlace profundo: /knowledge/objects/{id}?tab=columns
  const [chosenTab, setChosenTab] = useState<TabKey | null>(() => {
    const deepTab = searchParams.get("tab") as TabKey | null;
    return deepTab ?? null;
  });
  const [editOpen, setEditOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [activeEnv, setActiveEnv] = useState<Environment | null>(null);

  useEffect(() => {
    if (object) {
      recordRecent({
        kind: "object",
        id: object.id,
        label: displayObjectName(object.schema_name, object.object_name),
        href: `/knowledge/objects/${object.id}`,
      });
    }
  }, [object]);

  const latestByType = useMemo(() => {
    const map = new Map<SourceType, OracleCodeVersion>();
    if (!object) return map;
    for (const version of [...object.code_versions].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )) {
      map.set(version.source_type, version);
    }
    return map;
  }, [object]);

  const exportActions = useMemo<ExportAction[]>(() => {
    if (!object) return [];
    const label = object.object_name;
    if (object.object_type === "PACKAGE") {
      const spec = latestByType.get("SPECIFICATION");
      const body = latestByType.get("BODY");
      const actions: ExportAction[] = [];
      if (spec) {
        actions.push({ label: "Copiar Specification", content: spec.source_code });
        actions.push({
          label: "Specification .sql",
          content: spec.source_code,
          fileName: objectCodeFileName(label, "SPECIFICATION", spec.environment ?? "DEV", "sql"),
        });
        actions.push({
          label: "Specification .txt",
          content: spec.source_code,
          fileName: objectCodeFileName(label, "SPECIFICATION", spec.environment ?? "DEV", "txt"),
        });
      }
      if (body) {
        actions.push({ label: "Copiar Body", content: body.source_code });
        actions.push({
          label: "Body .sql",
          content: body.source_code,
          fileName: objectCodeFileName(label, "BODY", body.environment ?? "DEV", "sql"),
        });
        actions.push({
          label: "Body .txt",
          content: body.source_code,
          fileName: objectCodeFileName(label, "BODY", body.environment ?? "DEV", "txt"),
        });
      }
      if (spec && body) {
        const full = `${ensureTrailingNewline(spec.source_code)}\n${ensureTrailingNewline(
          body.source_code,
        )}`;
        const env = body.environment ?? "DEV";
        actions.push({ label: "Copiar package completo", content: full });
        actions.push({
          label: "Package completo .sql",
          content: full,
          fileName: objectCodeFileName(label, "SOURCE", env, "sql"),
        });
        actions.push({
          label: "Package completo .txt",
          content: full,
          fileName: objectCodeFileName(label, "SOURCE", env, "txt"),
        });
      }
      return actions;
    }
    if (object.object_type === "PROCEDURE" || object.object_type === "FUNCTION") {
      const version = latestByType.get("SOURCE");
      if (!version) return [];
      return [
        { label: "Copiar código", content: version.source_code },
        {
          label: "Exportar .sql",
          content: version.source_code,
          fileName: objectCodeFileName(label, "SOURCE", version.environment ?? "DEV", "sql"),
        },
        {
          label: "Exportar .txt",
          content: version.source_code,
          fileName: objectCodeFileName(label, "SOURCE", version.environment ?? "DEV", "txt"),
        },
      ];
    }
    // Tables / views: export a human readable documentation sheet.
    const lines = [
      `${object.schema_name}.${object.object_name} (${OBJECT_TYPE_LABELS[object.object_type]})`,
      object.description ? `Descripción: ${object.description}` : "",
      object.module ? `Módulo: ${object.module}` : "",
      object.owner ? `Responsable: ${object.owner}` : "",
      "",
      "COLUMNAS",
      ...object.columns.map(
        (c) =>
          `- ${c.column_name} ${c.data_type ?? ""}${c.data_length ? `(${c.data_length})` : ""} ${
            c.nullable ? "NULL" : "NOT NULL"
          }${c.description ? ` — ${c.description}` : ""}`,
      ),
      "",
      "VALORES DOCUMENTADOS",
      ...object.columns.flatMap((c) =>
        c.values.map((v) => `- ${c.column_name} = ${v.value}${v.meaning ? ` → ${v.meaning}` : ""}`),
      ),
    ].filter((line) => line !== "" || true);
    const content = lines.join("\n");
    const actions: ExportAction[] = [
      { label: "Copiar documentación", content },
      {
        label: "Exportar documentación .txt",
        content,
        fileName: objectCodeFileName(label, "SOURCE", "DEV", "txt").replace(/_DEV_/, "_"),
      },
    ];
    const ddl = objectToDdl(object);
    if (ddl) {
      actions.push({ label: "Copiar DDL (CREATE TABLE)", content: ddl });
      actions.push({ label: "Exportar DDL .sql", content: ddl, fileName: ddlFileName(object) });
    }
    return actions;
  }, [object, latestByType]);

  if (loading && !object) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Objeto no encontrado.{" "}
        <Link href="/knowledge/tables" className="text-primary hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const listPath = objectListPath(object.object_type);

  const isTableLike = object.object_type === "TABLE" || object.object_type === "VIEW";
  const isPackage = object.object_type === "PACKAGE";
  const hasCode = CODE_TYPES.has(object.object_type);
  const hasArgs = object.object_type === "PROCEDURE" || object.object_type === "FUNCTION" || isPackage;

  // Ambientes donde el objeto existe (documentados).
  const existingEnvironments = ENVIRONMENTS.filter((env) =>
    object.environments.some((e) => e.environment === env),
  );
  // Por defecto: PRODUCTIVO si existe; si no, el primero disponible.
  const defaultEnvironment =
    existingEnvironments.includes("PRODUCTIVO") ? "PRODUCTIVO" : (existingEnvironments[0] ?? null);
  const selectedEnv = activeEnv ?? defaultEnvironment;

  const sourceVersions = object.code_versions.filter(
    (v) => v.source_type === "SOURCE" && (!selectedEnv || v.environment === selectedEnv),
  );
  const specVersions = object.code_versions.filter(
    (v) => v.source_type === "SPECIFICATION" && (!selectedEnv || v.environment === selectedEnv),
  );
  const bodyVersions = object.code_versions.filter(
    (v) => v.source_type === "BODY" && (!selectedEnv || v.environment === selectedEnv),
  );

  const tabs: { key: TabKey; label: string; icon: typeof Info }[] = [
    ...(isTableLike ? [{ key: "columns" as TabKey, label: "Columnas", icon: Columns3 }] : []),
    ...(hasCode && !isPackage ? [{ key: "code" as TabKey, label: "Código", icon: Code2 }] : []),
    ...(isPackage
      ? [
          { key: "spec" as TabKey, label: "Specification", icon: Layers },
          { key: "body" as TabKey, label: "Body", icon: Layers },
        ]
      : []),
    ...(hasArgs ? [{ key: "args" as TabKey, label: "Argumentos", icon: ListTree }] : []),
    { key: "environments", label: "Ambientes", icon: Layers },
    { key: "impact", label: "Impacto / Relaciones", icon: GitBranch },
    { key: "info", label: "Información", icon: Info },
  ];

  const defaultTab: TabKey = isTableLike
    ? "columns"
    : hasCode && !isPackage
      ? "code"
      : isPackage
        ? "spec"
        : "info";
  const tab = chosenTab ?? defaultTab;

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Eliminar objeto",
      message: `¿Deseas eliminar ${displayObjectName(object.schema_name, object.object_name)}? Esta acción eliminará la documentación asociada.`,
      danger: true,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    try {
      await deleteObject(object.id);
      toast("Objeto eliminado");
      router.push(listPath);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-4 py-1.5 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={listPath}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Volver al listado"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <ObjectTypeBadge type={object.object_type} />
            <h1 className="truncate font-mono text-base font-semibold">
              {displayObjectName(object.schema_name, object.object_name)}
            </h1>
            <button
              onClick={() => toggleObjectFavorite(object.id, !object.is_favorite)}
              className={cn(
                "shrink-0 rounded-md p-0.5 transition-colors hover:bg-muted",
                object.is_favorite ? "text-amber-500" : "text-muted-foreground",
              )}
              aria-label="Favorito"
              title={object.is_favorite ? "Quitar de favoritos" : "Marcar favorito"}
            >
              <Star className="h-4 w-4" fill={object.is_favorite ? "currentColor" : "none"} />
            </button>
            {object.description && (
              <span className="hidden truncate text-xs text-muted-foreground lg:inline">
                {object.description}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <TagPicker
              assigned={object.tags}
              canEdit={canEdit}
              onToggle={(tagId, active) =>
                toggleObjectTag(object.id, tagId, active).catch((e) => toast(e.message, "error"))
              }
            />
            <ObjectAiActions objectId={object.id} />
            <Button size="sm" variant="ghost" title="Enviar" onClick={() => setSendOpen(true)}>
              <Send className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title="Copiar enlace"
              onClick={() => {
                const url = `${window.location.origin}/knowledge/objects/${object.id}?tab=${tab}`;
                navigator.clipboard?.writeText(url).then(
                  () => toast("Enlace copiado"),
                  () => toast("No se pudo copiar", "error"),
                );
              }}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <ExportMenu
              actions={exportActions}
              trigger={
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Exportar"
                >
                  <Download className="h-4 w-4" />
                </button>
              }
            />
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                title="Duplicar con variación"
                onClick={() => {
                  setDuplicateError(null);
                  setDuplicateOpen(true);
                }}
              >
                <CopyPlus className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="ghost" title="Eliminar" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            )}
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setChosenTab(item.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium transition-colors",
                    tab === item.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Selector de ambiente global: gobierna el código que se muestra. */}
          {existingEnvironments.length > 0 && (
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
              {ENVIRONMENTS.map((env) => {
                const exists = existingEnvironments.includes(env);
                const active = selectedEnv === env;
                return (
                  <button
                    key={env}
                    onClick={() => setActiveEnv(env)}
                    disabled={!exists}
                    title={exists ? ENVIRONMENT_LABELS[env] : `No existe en ${ENVIRONMENT_LABELS[env]}`}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : exists
                          ? "text-muted-foreground hover:text-foreground"
                          : "cursor-not-allowed text-muted-foreground/40 line-through",
                    )}
                  >
                    {env}
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </header>

      {selectedEnv && !existingEnvironments.includes(selectedEnv) && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300 md:px-6">
          Este objeto no existe en {ENVIRONMENT_LABELS[selectedEnv]}. Puedes crear la versión aquí o
          copiar el código desde otro ambiente.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 md:p-4">
        {tab === "info" && <InfoTab object={object} profiles={profiles} />}
        {tab === "columns" && (
          <ColumnsPanel
            objectId={object.id}
            objectSchema={object.schema_name}
            columns={object.columns}
            canEdit={canEdit}
          />
        )}
        {tab === "code" && (
          <CodePanel
            objectId={object.id}
            objectName={object.object_name}
            sourceType="SOURCE"
            versions={sourceVersions}
                        allVersions={object.code_versions}
                        objectType={object.object_type}
            canEdit={canEdit}
            emptyLabel={
              selectedEnv
                ? `Sin código en ${ENVIRONMENT_LABELS[selectedEnv]}. Crea la primera versión o copia el código desde otro ambiente.`
                : "Sin código almacenado. Crea la primera versión."
            }
          />
        )}
        {tab === "spec" && (
          <CodePanel
            objectId={object.id}
            objectName={object.object_name}
            sourceType="SPECIFICATION"
            versions={specVersions}
                        allVersions={object.code_versions}
                        objectType={object.object_type}
            canEdit={canEdit}
            emptyLabel="Sin Package Specification almacenado."
          />
        )}
        {tab === "body" && (
          <CodePanel
            objectId={object.id}
            objectName={object.object_name}
            sourceType="BODY"
            versions={bodyVersions}
                        allVersions={object.code_versions}
                        objectType={object.object_type}
            canEdit={canEdit}
            emptyLabel="Sin Package Body almacenado."
          />
        )}
        {tab === "args" && (
          <ArgumentsPanel objectId={object.id} args={object.arguments} canEdit={canEdit} />
        )}
        {tab === "environments" && (
          <EnvironmentsPanel
            objectId={object.id}
            environments={object.environments}
            codeVersions={object.code_versions}
            canEdit={canEdit}
          />
        )}
        {tab === "impact" && <RelationsPanel object={object} canEdit={canEdit} />}
      </div>

      <ObjectDialog
        key={editOpen ? object.id : "object-dialog-closed"}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        object={object}
      />

      <SendItemDialog
        key={sendOpen ? "send-open" : "send-dialog-closed"}
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        itemType="OBJECT"
        itemId={object.id}
        itemLabel={displayObjectName(object.schema_name, object.object_name)}
      />

      <DuplicateObjectDialog
        key={duplicateOpen ? "duplicate-open" : "duplicate-closed"}
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        object={object}
        defaultSchema={object.schema_name}
        defaultName={`${object.object_name}_COPIA`}
        saving={duplicating}
        error={duplicateError}
        onSubmit={async (values) => {
          setDuplicateError(null);
          setDuplicating(true);
          try {
            const newId = await duplicateObject(object.id, values);
            toast("Objeto duplicado");
            setDuplicateOpen(false);
            if (newId) router.push(`/knowledge/objects/${newId}`);
          } catch (error) {
            setDuplicateError(error instanceof Error ? error.message : "Error");
          } finally {
            setDuplicating(false);
          }
        }}
      />
    </div>
  );
}

function InfoTab({
  object,
  profiles,
}: {
  object: ReturnType<typeof useKnowledge>["objects"][number];
  profiles: ReturnType<typeof useKnowledge>["profiles"];
}) {
  const ownerProfile = profiles.find((p) => p.id === object.owner);
  const ownerLabel = ownerProfile
    ? ownerProfile.full_name || ownerProfile.email || object.owner || "—"
    : object.owner || "—";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Información general</h3>
        <dl className="space-y-2 text-sm">
          <InfoRow label="Schema" value={object.schema_name} mono />
          <InfoRow label="Nombre" value={object.object_name} mono />
          <InfoRow label="Tipo" value={`${object.object_type} · ${OBJECT_TYPE_LABELS[object.object_type]}`} />
          <InfoRow label="Módulo" value={object.module || "—"} />
          <InfoRow label="Responsable" value={ownerLabel} />
          <InfoRow label="Origen" value={object.source === "ORACLE" ? "Importado de Oracle" : "Manual"} />
          <InfoRow label="Última actualización" value={formatDate(object.updated_at) || "—"} />
        </dl>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Descripción</h3>
        <p className="text-sm">{object.description || object.functional_description || "—"}</p>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="text-sm">{object.notes || "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Ambientes:</span>
          {object.environments.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sin registrar</span>
          ) : (
            object.environments.map((env) => (
              <EnvironmentBadge key={env.id} environment={env.environment} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
