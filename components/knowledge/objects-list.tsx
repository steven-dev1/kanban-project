"use client";

import { ObjectDialog } from "@/components/knowledge/object-dialog";
import {
  EmptyState,
  EnvironmentBadge,
  ObjectTypeBadge,
  Skeleton,
  TagChip,
} from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ENVIRONMENTS } from "@/lib/knowledge/constants";
import { downloadBlob } from "@/lib/knowledge/format";
import { buildObjectsZip } from "@/lib/knowledge/export";
import type { OracleObjectType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { Download, Filter, PackageOpen, Plus, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortKey = "name" | "updated" | "created";

const ALL = "__all__";

export function ObjectsList({
  objectTypes,
  title,
  description,
  favoritesOnly = false,
  defaultType,
}: {
  objectTypes: OracleObjectType[];
  title: string;
  description: string;
  favoritesOnly?: boolean;
  defaultType?: OracleObjectType;
}) {
  const { objects, tags, loading, canEdit, toggleObjectFavorite } = useKnowledge();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [schema, setSchema] = useState(ALL);
  const [module, setModule] = useState(ALL);
  const [environment, setEnvironment] = useState(ALL);
  const [tagId, setTagId] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const base = useMemo(
    () =>
      objects.filter(
        (o) =>
          objectTypes.includes(o.object_type) &&
          (!favoritesOnly || o.is_favorite),
      ),
    [objects, objectTypes, favoritesOnly],
  );

  const schemas = useMemo(
    () => Array.from(new Set(base.map((o) => o.schema_name))).sort(),
    [base],
  );
  const modules = useMemo(
    () => Array.from(new Set(base.map((o) => o.module).filter(Boolean))) as string[],
    [base],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = base.filter((o) => {
      if (schema !== ALL && o.schema_name !== schema) return false;
      if (module !== ALL && o.module !== module) return false;
      if (environment !== ALL && !o.environments.some((e) => e.environment === environment))
        return false;
      if (tagId !== ALL && !o.tags.some((t) => t.id === tagId)) return false;
      if (!q) return true;
      return (
        o.object_name.toLowerCase().includes(q) ||
        o.schema_name.toLowerCase().includes(q) ||
        (o.description ?? "").toLowerCase().includes(q) ||
        (o.functional_description ?? "").toLowerCase().includes(q) ||
        o.columns.some((c) => c.column_name.toLowerCase().includes(q))
      );
    });
    return result.sort((a, b) => {
      if (sort === "name") return a.object_name.localeCompare(b.object_name);
      if (sort === "created") return b.created_at.localeCompare(a.created_at);
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [base, query, schema, module, environment, tagId, sort]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportSelected = () => {
    const chosen = filtered.filter((o) => selected.has(o.id));
    if (chosen.length === 0) return;
    const { blob, fileName } = buildObjectsZip(chosen);
    downloadBlob(fileName, blob);
    toast(`${chosen.length} objeto(s) exportados como ${fileName}`);
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo objeto
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, descripción o columna…"
              className="pl-8"
            />
          </div>

          <div className="w-36">
            <Select
              value={schema}
              onChange={setSchema}
              options={[{ value: ALL, label: "Todos los schemas" }, ...schemas.map((s) => ({ value: s, label: s }))]}
            />
          </div>

          {modules.length > 0 && (
            <div className="w-36">
              <Select
                value={module}
                onChange={setModule}
                options={[{ value: ALL, label: "Todos los módulos" }, ...modules.map((m) => ({ value: m, label: m }))]}
              />
            </div>
          )}

          <div className="w-40">
            <Select
              value={environment}
              onChange={setEnvironment}
              options={[
                { value: ALL, label: "Todos los ambientes" },
                ...ENVIRONMENTS.map((env) => ({ value: env, label: env })),
              ]}
            />
          </div>

          {tags.length > 0 && (
            <div className="w-40">
              <Select
                value={tagId}
                onChange={setTagId}
                options={[
                  { value: ALL, label: "Todas las etiquetas" },
                  ...tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
                ]}
              />
            </div>
          )}

          <div className="w-40">
            <Select
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "name", label: "Ordenar: Nombre" },
                { value: "updated", label: "Actualizados" },
                { value: "created", label: "Recientes" },
              ]}
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selected.size} seleccionado(s)
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Limpiar
              </Button>
              <Button size="sm" onClick={exportSelected}>
                <PackageOpen className="h-3.5 w-3.5" /> Exportar seleccionados
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Filter className="h-6 w-6" />}
            title="No hay objetos que coincidan"
            description={
              favoritesOnly
                ? "Marca objetos como favoritos para verlos aquí."
                : "Ajusta los filtros o crea el primer objeto."
            }
            action={
              canEdit && !favoritesOnly ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nuevo objeto
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(filtered.map((o) => o.id)) : new Set())
                      }
                      aria-label="Seleccionar todos"
                      className="h-3.5 w-3.5 accent-[var(--primary)]"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Objeto</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Módulo</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Columnas</th>
                  <th className="hidden px-3 py-2 font-medium xl:table-cell">Ambientes</th>
                  <th className="hidden px-3 py-2 font-medium xl:table-cell">Etiquetas</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Actualizado</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((object) => (
                  <tr key={object.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(object.id)}
                        onChange={() => toggleSelected(object.id)}
                        aria-label={`Seleccionar ${object.object_name}`}
                        className="h-3.5 w-3.5 accent-[var(--primary)]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/knowledge/objects/${object.id}`}
                        className="font-mono text-xs font-medium hover:text-primary"
                      >
                        {object.schema_name}.{object.object_name}
                      </Link>
                      {object.description && (
                        <p className="mt-0.5 line-clamp-1 max-w-md text-[11px] text-muted-foreground">
                          {object.description}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <ObjectTypeBadge type={object.object_type} />
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell">
                      {object.module || "—"}
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell">
                      {object.columns.length || "—"}
                    </td>
                    <td className="hidden px-3 py-2.5 xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {object.environments.slice(0, 3).map((env) => (
                          <EnvironmentBadge key={env.id} environment={env.environment} />
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {object.tags.slice(0, 2).map((tag) => (
                          <TagChip key={tag.id} tag={tag} />
                        ))}
                        {object.tags.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{object.tags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                      {formatDate(object.updated_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Dropdown
                        trigger={
                          <button
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Acciones"
                          >
                            ⋮
                          </button>
                        }
                      >
                        {() => (
                          <div>
                            <DropdownItem
                              onClick={() =>
                                toggleObjectFavorite(object.id, !object.is_favorite).catch((e) =>
                                  toast(e.message, "error"),
                                )
                              }
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  object.is_favorite ? "text-amber-500" : "text-muted-foreground",
                                )}
                                fill={object.is_favorite ? "currentColor" : "none"}
                              />
                              {object.is_favorite ? "Quitar favorito" : "Marcar favorito"}
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => {
                                const { blob, fileName } = buildObjectsZip([object]);
                                downloadBlob(fileName, blob);
                                toast(`Exportado: ${fileName}`);
                              }}
                            >
                              <Download className="h-4 w-4 text-muted-foreground" /> Exportar
                            </DropdownItem>
                          </div>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ObjectDialog
        key={createOpen ? "open" : "closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultType={defaultType ?? objectTypes[0]}
      />
    </div>
  );
}
