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
import { formatSql } from "@/lib/knowledge/format-sql";
import { copyText, downloadBlob } from "@/lib/knowledge/format";
import { cn, formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderClosed,
  FolderInput,
  FolderPlus,
  Folder as FolderIcon,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";

const ALL = "__all__";
const NO_FOLDER = "__none__";
const FOLDER_STORAGE_KEY = "knowledge-snippet-folders";

function readStoredFolders(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredFolders(folders: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // ignore
  }
}

export function SnippetsList({
  title = "Consultas SQL",
  description = "Biblioteca de consultas reutilizables del equipo.",
  favoritesOnly = false,
}: {
  title?: string;
  description?: string;
  favoritesOnly?: boolean;
}) {
  const {
    snippets,
    tags,
    loading,
    canEdit,
    toggleSnippetFavorite,
    createSnippet,
    moveSnippetsToFolder,
    renameFolder,
    deleteFolder,
  } = useKnowledge();
  const { toast } = useToast();
  const router = useRouter();

  const [quickCode, setQuickCode] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [databaseType, setDatabaseType] = useState(ALL);
  const [environment, setEnvironment] = useState(ALL);
  const [tagId, setTagId] = useState(ALL);
  const [sort, setSort] = useState("updated");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [newFolderName, setNewFolderName] = useState("");
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [emptyFolders, setEmptyFolders] = useState<string[]>(() => readStoredFolders());

  const deferredQuery = useDeferredValue(query);

  const base = useMemo(
    () => snippets.filter((s) => !favoritesOnly || s.is_favorite),
    [snippets, favoritesOnly],
  );

  /**
   * Carpetas existentes: las que tienen consultas más las creadas vacías
   * (persistidas en localStorage) para poder mover consultas a ellas.
   */
  const folders = useMemo(() => {
    const set = new Set<string>(emptyFolders);
    for (const snippet of snippets) {
      if (snippet.folder) set.add(snippet.folder);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [snippets, emptyFolders]);

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let without = 0;
    for (const snippet of snippets) {
      if (snippet.folder) counts.set(snippet.folder, (counts.get(snippet.folder) ?? 0) + 1);
      else without += 1;
    }
    return { counts, without };
  }, [snippets]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const result = base.filter((s) => {
      if (activeFolder === NO_FOLDER) {
        if (s.folder) return false;
      } else if (activeFolder !== ALL && s.folder !== activeFolder) {
        return false;
      }
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
  }, [base, activeFolder, deferredQuery, category, databaseType, environment, tagId, sort]);

  const moveSelectedTo = async (folder: string | null) => {
    try {
      await moveSnippetsToFolder([...selected], folder);
      setSelected(new Set());
      toast(folder ? `Movidas a "${folder}"` : "Movidas a Sin carpeta");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo mover", "error");
    }
  };

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    setEmptyFolders((prev) => {
      const next = prev.includes(name) ? prev : [...prev, name];
      writeStoredFolders(next);
      return next;
    });
    setActiveFolder(name);
    setNewFolderName("");
    toast(`Carpeta "${name}" creada: muéveles consultas desde "Mover a carpeta"`);
  };

  const handleRenameFolder = async (folder: string) => {
    const next = window.prompt("Nuevo nombre de la carpeta", folder);
    if (next === null || !next.trim()) return;
    const target = next.trim();
    try {
      await renameFolder(folder, target);
      setEmptyFolders((prev) => {
        const rewritten = prev.map((name) =>
          name === folder ? target : name.startsWith(`${folder}/`) ? `${target}${name.slice(folder.length)}` : name,
        );
        writeStoredFolders(rewritten);
        return rewritten;
      });
      if (activeFolder === folder) setActiveFolder(target);
      toast("Carpeta renombrada");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo renombrar", "error");
    }
  };

  const handleDeleteFolder = async (folder: string) => {
    try {
      await deleteFolder(folder);
      setEmptyFolders((prev) => {
        const next = prev.filter((name) => name !== folder && !name.startsWith(`${folder}/`));
        writeStoredFolders(next);
        return next;
      });
      if (activeFolder === folder) setActiveFolder(ALL);
      toast("Carpeta eliminada (las consultas quedaron sin carpeta)");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar", "error");
    }
  };

  const exportSelected = () => {
    const chosen = filtered.filter((s) => selected.has(s.id));
    if (chosen.length === 0) return;
    const { blob, fileName } = buildSnippetsZip(chosen);
    downloadBlob(fileName, blob);
    toast(`${chosen.length} consulta(s) exportadas como ${fileName}`);
  };

  const quickTitleFromCode = (sql: string) => {
    const source = sql.replace(/\s+/g, " ").trim();
    const table = source.match(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([A-Za-z0-9_$#.]+)/i)?.[1];

    // Verbo principal para un nombre legible y corto.
    const verb = /\bINSERT\b/i.test(source)
      ? "INSERT"
      : /\bUPDATE\b/i.test(source)
        ? "UPDATE"
        : /\bDELETE\b/i.test(source)
          ? "DELETE"
          : /\b(?:CREATE|DECLARE|CURSOR)\b/i.test(source)
            ? "PL/SQL"
            : "SELECT";

    const target = table ? table.split(".").pop()!.toUpperCase() : "";
    if (target) return `${verb} ${target}`.slice(0, 40);

    // Sin tabla: usar solo la primera palabra clave útil del código.
    const firstWord = source.match(/[A-Za-z0-9_$#]+/)?.[0] ?? "Consulta";
    return `${verb} ${firstWord}`.slice(0, 40);
  };

  const submitQuick = async () => {
    const raw = quickCode.trim();
    if (!raw) return;
    setQuickSaving(true);
    try {
      // Se guarda ya formateado para que al abrirla se vea ordenada, no en una
      // sola línea.
      const code = formatSql(raw);
      await createSnippet({
        title: quickTitleFromCode(code),
        sql_code: code,
        category: "Consulta",
        database_type: "Oracle",
        folder: activeFolder !== ALL && activeFolder !== NO_FOLDER ? activeFolder : null,
      });
      setQuickCode("");
      toast("Consulta guardada");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "error");
    } finally {
      setQuickSaving(false);
    }
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
            <Button size="sm" onClick={() => setCreateOpen(true)} data-shortcut-new>
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

        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitQuick();
            }}
            className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-2"
          >
            <div className="flex items-center gap-2">
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                + rápido
              </code>
              <input
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuickCode("");
                }}
                placeholder="Pega el SQL y pulsa Enter para guardarlo al instante"
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 font-mono text-xs outline-none"
              />
              <Button size="sm" type="submit" disabled={!quickCode.trim() || quickSaving}>
                {quickSaving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        )}

        {selected.size > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selected.size} seleccionada(s)
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Limpiar
              </Button>
              {canEdit && (
                <Dropdown
                  trigger={
                    <Button size="sm" variant="outline">
                      <FolderInput className="h-3.5 w-3.5" /> Mover a carpeta
                    </Button>
                  }
                >
                  {() => (
                    <div className="max-h-64 overflow-y-auto">
                      <DropdownItem onClick={() => moveSelectedTo(null)}>
                        <FolderClosed className="h-4 w-4 text-muted-foreground" /> Sin carpeta
                      </DropdownItem>
                      {folders.map((folder) => (
                        <DropdownItem key={folder} onClick={() => moveSelectedTo(folder)}>
                          <FolderIcon className="h-4 w-4 text-muted-foreground" /> {folder}
                        </DropdownItem>
                      ))}
                    </div>
                  )}
                </Dropdown>
              )}
              <Button size="sm" onClick={exportSelected}>
                <PackageOpen className="h-3.5 w-3.5" /> Exportar seleccionados
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {!favoritesOnly && (
          <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card/40 p-3 md:block">
            <button
              type="button"
              onClick={() => setFoldersOpen((v) => !v)}
              className="mb-2 flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {foldersOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Carpetas
            </button>

            {foldersOpen && (
              <div className="space-y-0.5">
                <FolderRow
                  label="Todas"
                  count={snippets.length}
                  active={activeFolder === ALL}
                  onClick={() => setActiveFolder(ALL)}
                />
                <FolderRow
                  label="Sin carpeta"
                  count={folderCounts.without}
                  active={activeFolder === NO_FOLDER}
                  onClick={() => setActiveFolder(NO_FOLDER)}
                  onDropSnippet={
                    canEdit
                      ? (snippetId) => {
                          moveSnippetsToFolder([snippetId], null).catch((err) =>
                            toast(err instanceof Error ? err.message : "Error", "error"),
                          );
                        }
                      : undefined
                  }
                />
                {folders.map((folder) => (
                  <FolderRow
                    key={folder}
                    label={folder}
                    count={folderCounts.counts.get(folder) ?? 0}
                    active={activeFolder === folder}
                    onClick={() => setActiveFolder(folder)}
                    onRename={canEdit ? () => handleRenameFolder(folder) : undefined}
                    onDelete={canEdit ? () => handleDeleteFolder(folder) : undefined}
                    onDropSnippet={
                      canEdit
                        ? (snippetId) => {
                            moveSnippetsToFolder([snippetId], folder)
                              .then(() => toast(`Movida a "${folder}"`))
                              .catch((err) =>
                                toast(err instanceof Error ? err.message : "Error", "error"),
                              );
                          }
                        : undefined
                    }
                  />
                ))}

                {canEdit && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createFolder();
                    }}
                    className="mt-2 flex items-center gap-1"
                  >
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Nueva carpeta"
                      className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newFolderName.trim()}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      aria-label="Crear carpeta"
                      title="Crear carpeta"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            )}
          </aside>
        )}

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
                role="link"
                tabIndex={0}
                data-shortcut-row
                draggable={canEdit}
                onDragStart={
                  canEdit
                    ? (e) => {
                        e.dataTransfer.setData("text/snippet-id", snippet.id);
                        e.dataTransfer.effectAllowed = "move";
                      }
                    : undefined
                }
                onClick={() => router.push(`/knowledge/sql/${snippet.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/knowledge/sql/${snippet.id}`);
                }}
                className="group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-ring/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => copyText(snippet.sql_code).then((ok) =>
                        toast(ok ? "SQL copiado" : "No se pudo copiar", ok ? "success" : "error"),
                      )}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Copiar SQL"
                      title="Copiar SQL"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
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
                          <div className="border-t border-border px-2 pt-1.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase">
                            Mover a carpeta
                          </div>
                          <DropdownItem
                            onClick={async () => {
                              try {
                                await moveSnippetsToFolder([snippet.id], null);
                                toast("Movida a Sin carpeta");
                              } catch (err) {
                                toast(err instanceof Error ? err.message : "Error", "error");
                              }
                            }}
                          >
                            <FolderClosed className="h-4 w-4 text-muted-foreground" /> Sin carpeta
                          </DropdownItem>
                          {folders.map((folder) => (
                            <DropdownItem
                              key={folder}
                              onClick={async () => {
                                try {
                                  await moveSnippetsToFolder([snippet.id], folder);
                                  toast(`Movida a "${folder}"`);
                                } catch (err) {
                                  toast(err instanceof Error ? err.message : "Error", "error");
                                }
                              }}
                            >
                              <FolderIcon className="h-4 w-4 text-muted-foreground" /> {folder}
                            </DropdownItem>
                          ))}
                        </div>
                      )}
                    </Dropdown>
                  </div>
                </div>

                <p className="mt-2 line-clamp-2 text-sm font-semibold break-words transition-colors group-hover:text-primary">
                  {snippet.title}
                </p>
                {snippet.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {snippet.description}
                  </p>
                )}
                <pre className="mt-2 max-h-20 overflow-hidden rounded-lg bg-slate-50 p-2 text-[11px] leading-4 text-slate-600 dark:bg-[#0b1020] dark:text-slate-300">
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
      </div>

      <SnippetDialog
        key={createOpen ? "open" : "closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function FolderRow({
  label,
  count,
  active,
  onClick,
  onRename,
  onDelete,
  onDropSnippet,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onDropSnippet?: (snippetId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={
        onDropSnippet
          ? (e) => {
              if (e.dataTransfer.types.includes("text/snippet-id")) {
                e.preventDefault();
                setDragOver(true);
              }
            }
          : undefined
      }
      onDragLeave={onDropSnippet ? () => setDragOver(false) : undefined}
      onDrop={
        onDropSnippet
          ? (e) => {
              const id = e.dataTransfer.getData("text/snippet-id");
              setDragOver(false);
              if (id) {
                e.preventDefault();
                onDropSnippet(id);
              }
            }
          : undefined
      }
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
        dragOver && "bg-primary/20 ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <FolderIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {(onRename || onDelete) && (
        <span className="flex w-8 shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onRename && (
            <button
              type="button"
              onClick={onRename}
              className="rounded p-0.5 hover:bg-muted hover:text-foreground"
              aria-label={`Renombrar ${label}`}
              title="Renombrar carpeta"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-0.5 hover:text-danger"
              aria-label={`Eliminar ${label}`}
              title="Eliminar carpeta"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </span>
      )}
      <span className="w-6 shrink-0 text-right text-[10px] opacity-70">{count}</span>
    </div>
  );
}
