"use client";

import { SnippetDialog } from "@/components/knowledge/snippet-dialog";
import { EmptyState, Skeleton, TagChip } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  DATABASE_TYPES,
  ENVIRONMENTS,
  SQL_CATEGORIES,
} from "@/lib/knowledge/constants";
import { buildSnippetsZip } from "@/lib/knowledge/export";
import { downloadBlob } from "@/lib/knowledge/format";
import { cn, formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { Download, PackageOpen, Plus, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const ALL = "__all__";

export function SnippetsList({
  title = "Consultas SQL",
  description = "Biblioteca de consultas reutilizables del equipo.",
  favoritesOnly = false,
}: {
  title?: string;
  description?: string;
  favoritesOnly?: boolean;
}) {
  const { snippets, tags, loading, canEdit, toggleSnippetFavorite } = useKnowledge();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [databaseType, setDatabaseType] = useState(ALL);
  const [environment, setEnvironment] = useState(ALL);
  const [tagId, setTagId] = useState(ALL);
  const [sort, setSort] = useState("updated");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const base = useMemo(
    () => snippets.filter((s) => !favoritesOnly || s.is_favorite),
    [snippets, favoritesOnly],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = base.filter((s) => {
      if (category !== ALL && s.category !== category) return false;
      if (databaseType !== ALL && s.database_type !== databaseType) return false;
      if (environment !== ALL && s.environment !== environment) return false;
      if (tagId !== ALL && !s.tags.some((t) => t.id === tagId)) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        s.sql_code.toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q)
      );
    });
    return result.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "created") return b.created_at.localeCompare(a.created_at);
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [base, query, category, databaseType, environment, tagId, sort]);

  const exportSelected = () => {
    const chosen = filtered.filter((s) => selected.has(s.id));
    if (chosen.length === 0) return;
    const { blob, fileName } = buildSnippetsZip(chosen);
    downloadBlob(fileName, blob);
    toast(`${chosen.length} consulta(s) exportadas como ${fileName}`);
  };

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
              <Plus className="h-3.5 w-3.5" /> Nueva consulta
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en título, descripción o SQL…"
              className="pl-8"
            />
          </div>
          <div className="w-40">
            <Select
              value={category}
              onChange={setCategory}
              options={[
                { value: ALL, label: "Todas las categorías" },
                ...SQL_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          <div className="w-36">
            <Select
              value={databaseType}
              onChange={setDatabaseType}
              options={[
                { value: ALL, label: "Toda BD" },
                ...DATABASE_TYPES.map((d) => ({ value: d, label: d })),
              ]}
            />
          </div>
          <div className="w-32">
            <Select
              value={environment}
              onChange={setEnvironment}
              options={[
                { value: ALL, label: "Ambiente" },
                ...ENVIRONMENTS.map((e) => ({ value: e, label: e })),
              ]}
            />
          </div>
          {tags.length > 0 && (
            <div className="w-36">
              <Select
                value={tagId}
                onChange={setTagId}
                options={[
                  { value: ALL, label: "Etiquetas" },
                  ...tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
                ]}
              />
            </div>
          )}
          <div className="w-40">
            <Select
              value={sort}
              onChange={setSort}
              options={[
                { value: "updated", label: "Actualizadas" },
                { value: "created", label: "Recientes" },
                { value: "title", label: "Título" },
              ]}
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selected.size} seleccionada(s)
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
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No hay consultas"
            description={
              favoritesOnly
                ? "Marca consultas como favoritas para verlas aquí."
                : "Crea la primera consulta de la biblioteca."
            }
            action={
              canEdit && !favoritesOnly ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nueva consulta
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((snippet) => (
              <div
                key={snippet.id}
                className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-ring/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(snippet.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(snippet.id)) next.delete(snippet.id);
                          else next.add(snippet.id);
                          return next;
                        })
                      }
                      aria-label={`Seleccionar ${snippet.title}`}
                      className="h-3.5 w-3.5 accent-[var(--primary)]"
                    />
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                      {snippet.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleSnippetFavorite(snippet.id, !snippet.is_favorite)}
                      className={cn(
                        "rounded p-1 hover:bg-muted",
                        snippet.is_favorite ? "text-amber-500" : "text-muted-foreground",
                      )}
                      aria-label="Favorito"
                    >
                      <Star
                        className="h-3.5 w-3.5"
                        fill={snippet.is_favorite ? "currentColor" : "none"}
                      />
                    </button>
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
                            onClick={() => {
                              const { blob, fileName } = buildSnippetsZip([snippet]);
                              downloadBlob(fileName, blob);
                              toast(`Exportado: ${fileName}`);
                            }}
                          >
                            <Download className="h-4 w-4 text-muted-foreground" /> Exportar
                          </DropdownItem>
                        </div>
                      )}
                    </Dropdown>
                  </div>
                </div>

                <Link
                  href={`/knowledge/sql/${snippet.id}`}
                  className="mt-2 text-sm font-semibold hover:text-primary"
                >
                  {snippet.title}
                </Link>
                {snippet.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {snippet.description}
                  </p>
                )}
                <pre className="mt-2 max-h-20 overflow-hidden rounded-lg bg-[#0b1020] p-2 text-[11px] leading-4 text-slate-300">
                  <code className="line-clamp-3 whitespace-pre-wrap">{snippet.sql_code}</code>
                </pre>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {snippet.schema_name && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {snippet.schema_name}
                    </span>
                  )}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {snippet.database_type}
                  </span>
                  {snippet.environment && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {snippet.environment}
                    </span>
                  )}
                  {snippet.tags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} />
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  {formatDate(snippet.updated_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <SnippetDialog
        key={createOpen ? "open" : "closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
