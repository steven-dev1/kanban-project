"use client";

import { ArgumentsPanel } from "@/components/knowledge/arguments-panel";
import { CodePanel } from "@/components/knowledge/code-panel";
import { ColumnsPanel } from "@/components/knowledge/columns-panel";
import { EnvironmentsPanel } from "@/components/knowledge/environments-panel";
import { ExportMenu, type ExportAction } from "@/components/knowledge/export-menu";
import { ObjectDialog } from "@/components/knowledge/object-dialog";
import { RelationsPanel } from "@/components/knowledge/relations-panel";
import { TagPicker } from "@/components/knowledge/tag-picker";
import { EnvironmentBadge, ObjectTypeBadge, Skeleton } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { OBJECT_TYPE_LABELS } from "@/lib/knowledge/constants";
import { ensureTrailingNewline, objectCodeFileName } from "@/lib/knowledge/format";
import { recordRecent } from "@/lib/knowledge/recent";
import type { OracleCodeVersion, SourceType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import {
  Code2,
  Columns3,
  GitBranch,
  Info,
  Layers,
  ListTree,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    toggleObjectFavorite,
    toggleObjectTag,
  } = useKnowledge();
  const confirm = useConfirm();
  const { toast } = useToast();
  const router = useRouter();

  const object = objects.find((o) => o.id === objectId) ?? null;
  const [tab, setTab] = useState<TabKey>("info");
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (object) {
      recordRecent({
        kind: "object",
        id: object.id,
        label: `${object.schema_name}.${object.object_name}`,
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
      object.functional_description ? `Funcional: ${object.functional_description}` : "",
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
    return [
      { label: "Copiar documentación", content },
      {
        label: "Exportar documentación .txt",
        content,
        fileName: objectCodeFileName(label, "SOURCE", "DEV", "txt").replace(/_DEV_/, "_"),
      },
    ];
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

  const isTableLike = object.object_type === "TABLE" || object.object_type === "VIEW";
  const isPackage = object.object_type === "PACKAGE";
  const hasCode = CODE_TYPES.has(object.object_type);
  const hasArgs = object.object_type === "PROCEDURE" || object.object_type === "FUNCTION" || isPackage;

  const sourceVersions = object.code_versions.filter((v) => v.source_type === "SOURCE");
  const specVersions = object.code_versions.filter((v) => v.source_type === "SPECIFICATION");
  const bodyVersions = object.code_versions.filter((v) => v.source_type === "BODY");

  const tabs: { key: TabKey; label: string; icon: typeof Info }[] = [
    { key: "info", label: "Información", icon: Info },
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
  ];

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Eliminar objeto",
      message: `¿Deseas eliminar ${object.schema_name}.${object.object_name}? Esta acción eliminará la documentación asociada.`,
      danger: true,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    try {
      await deleteObject(object.id);
      toast("Objeto eliminado");
      router.push("/knowledge/tables");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/knowledge/tables"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Diccionario de datos
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ObjectTypeBadge type={object.object_type} />
              <h1 className="font-mono text-lg font-semibold break-all">
                {object.schema_name}.{object.object_name}
              </h1>
              <button
                onClick={() => toggleObjectFavorite(object.id, !object.is_favorite)}
                className={cn(
                  "rounded-md p-1 transition-colors hover:bg-muted",
                  object.is_favorite ? "text-amber-500" : "text-muted-foreground",
                )}
                aria-label="Favorito"
                title={object.is_favorite ? "Quitar de favoritos" : "Marcar favorito"}
              >
                <Star className="h-4 w-4" fill={object.is_favorite ? "currentColor" : "none"} />
              </button>
            </div>
            {object.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{object.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ExportMenu actions={exportActions} />
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="danger" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <TagPicker
            assigned={object.tags}
            canEdit={canEdit}
            onToggle={(tagId, active) =>
              toggleObjectTag(object.id, tagId, active).catch((e) => toast(e.message, "error"))
            }
          />
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {tab === "info" && <InfoTab object={object} profiles={profiles} />}
        {tab === "columns" && (
          <ColumnsPanel objectId={object.id} columns={object.columns} canEdit={canEdit} />
        )}
        {tab === "code" && (
          <CodePanel
            objectId={object.id}
            objectName={object.object_name}
            sourceType="SOURCE"
            versions={sourceVersions}
            canEdit={canEdit}
            emptyLabel="Sin código almacenado. Crea la primera versión."
          />
        )}
        {tab === "spec" && (
          <CodePanel
            objectId={object.id}
            objectName={object.object_name}
            sourceType="SPECIFICATION"
            versions={specVersions}
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
            canEdit={canEdit}
          />
        )}
        {tab === "impact" && <RelationsPanel object={object} canEdit={canEdit} />}
      </div>

      <ObjectDialog
        key={editOpen ? object.id : "closed"}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        object={object}
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
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Descripciones</h3>
        <div>
          <p className="text-xs text-muted-foreground">Descripción técnica</p>
          <p className="text-sm">{object.description || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Descripción funcional</p>
          <p className="text-sm">{object.functional_description || "—"}</p>
        </div>
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
