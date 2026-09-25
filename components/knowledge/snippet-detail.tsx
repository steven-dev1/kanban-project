"use client";

import { CodeBlock } from "@/components/knowledge/code-block";
import { ExportMenu, type ExportAction } from "@/components/knowledge/export-menu";
import { SnippetDialog } from "@/components/knowledge/snippet-dialog";
import { TagPicker } from "@/components/knowledge/tag-picker";
import { Field, ObjectTypeBadge, Skeleton } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { snippetFileName } from "@/lib/knowledge/format";
import { recordRecent } from "@/lib/knowledge/recent";
import { useKnowledge } from "@/providers/knowledge-provider";
import { AlertTriangle, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SnippetDetail({ snippetId }: { snippetId: string }) {
  const {
    snippets,
    objects,
    loading,
    canEdit,
    isAdmin,
    updateSnippet,
    deleteSnippet,
    toggleSnippetFavorite,
    toggleSnippetTag,
    addSnippetParameter,
    deleteSnippetParameter,
    addSnippetObject,
    removeSnippetObject,
  } = useKnowledge();
  const confirm = useConfirm();
  const { toast } = useToast();
  const router = useRouter();

  const snippet = snippets.find((s) => s.id === snippetId) ?? null;
  const [editOpen, setEditOpen] = useState(false);
  const [paramName, setParamName] = useState("");
  const [paramType, setParamType] = useState("");
  const [paramDesc, setParamDesc] = useState("");
  const [paramExample, setParamExample] = useState("");
  const [linkObjectId, setLinkObjectId] = useState("");

  useEffect(() => {
    if (snippet) {
      recordRecent({
        kind: "snippet",
        id: snippet.id,
        label: snippet.title,
        href: `/knowledge/sql/${snippet.id}`,
      });
    }
  }, [snippet]);

  if (loading && !snippet) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!snippet) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Consulta no encontrada.{" "}
        <Link href="/knowledge/sql" className="text-primary hover:underline">
          Volver
        </Link>
      </div>
    );
  }

  const exportActions: ExportAction[] = [
    { label: "Copiar SQL", content: snippet.sql_code },
    {
      label: "Exportar .sql",
      content: snippet.sql_code,
      fileName: snippetFileName(snippet.title, "sql"),
    },
    {
      label: "Exportar .txt",
      content: snippet.sql_code,
      fileName: snippetFileName(snippet.title, "txt"),
    },
  ];

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Eliminar consulta",
      message: `¿Eliminar "${snippet.title}"? También se eliminarán sus parámetros y relaciones.`,
      danger: true,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    await deleteSnippet(snippet.id);
    toast("Consulta eliminada");
    router.push("/knowledge/sql");
  };

  const linkedIds = new Set(snippet.objects.map((o) => o.id));
  const linkCandidates = objects.filter((o) => !linkedIds.has(o.id));

  const addParameter = async () => {
    if (!paramName.trim()) return;
    try {
      await addSnippetParameter(snippet.id, {
        parameter_name: paramName.trim(),
        data_type: paramType.trim() || null,
        description: paramDesc.trim() || null,
        example_value: paramExample.trim() || null,
      });
      setParamName("");
      setParamType("");
      setParamDesc("");
      setParamExample("");
      toast("Parámetro agregado");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/knowledge/sql" className="text-xs text-muted-foreground hover:text-foreground">
              ← Consultas SQL
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{snippet.title}</h1>
              <button
                onClick={() => toggleSnippetFavorite(snippet.id, !snippet.is_favorite)}
                className={
                  snippet.is_favorite
                    ? "rounded p-1 text-amber-500 hover:bg-muted"
                    : "rounded p-1 text-muted-foreground hover:bg-muted"
                }
                aria-label="Favorito"
              >
                <Star className="h-4 w-4" fill={snippet.is_favorite ? "currentColor" : "none"} />
              </button>
            </div>
            {snippet.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{snippet.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">{snippet.category}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{snippet.database_type}</span>
              {snippet.schema_name && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{snippet.schema_name}</span>
              )}
              {snippet.environment && (
                <span className="rounded bg-muted px-1.5 py-0.5">{snippet.environment}</span>
              )}
            </div>
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
            assigned={snippet.tags}
            canEdit={canEdit}
            onToggle={(tagId, active) =>
              toggleSnippetTag(snippet.id, tagId, active).catch((e) => toast(e.message, "error"))
            }
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto space-y-5 p-4 md:p-6">
        {snippet.warnings && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{snippet.warnings}</p>
          </div>
        )}

        <CodeBlock
          value={snippet.sql_code}
          title={snippet.title}
          fileName={snippetFileName(snippet.title, "sql")}
          editable={canEdit}
          onChange={
            canEdit
              ? async (value) => {
                  await updateSnippet(snippet.id, { sql_code: value });
                  toast("Consulta actualizada");
                }
              : undefined
          }
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Parámetros
            </h3>
            {snippet.parameters.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin parámetros documentados.</p>
            ) : (
              <ul className="space-y-1.5">
                {snippet.parameters.map((param) => (
                  <li
                    key={param.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold">{param.parameter_name}</code>
                        {param.data_type && (
                          <span className="text-muted-foreground">{param.data_type}</span>
                        )}
                        {param.required && (
                          <span className="rounded bg-danger/10 px-1 text-[10px] text-danger">
                            requerido
                          </span>
                        )}
                      </div>
                      {param.description && (
                        <p className="mt-0.5 text-muted-foreground">{param.description}</p>
                      )}
                      {param.example_value && (
                        <p className="mt-0.5 text-muted-foreground">
                          Ejemplo: <code className="font-mono">{param.example_value}</code>
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() =>
                          deleteSnippetParameter(param.id).catch((e) => toast(e.message, "error"))
                        }
                        className="rounded p-1 text-muted-foreground hover:text-danger"
                        aria-label="Eliminar parámetro"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <div className="space-y-2 border-t border-border pt-3">
                <Field label="Nuevo parámetro">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={paramName}
                      onChange={(e) => setParamName(e.target.value)}
                      placeholder=":P_EMPRESA"
                      className="h-8"
                    />
                    <Input
                      value={paramType}
                      onChange={(e) => setParamType(e.target.value.toUpperCase())}
                      placeholder="NUMBER"
                      className="h-8"
                    />
                  </div>
                </Field>
                <Input
                  value={paramDesc}
                  onChange={(e) => setParamDesc(e.target.value)}
                  placeholder="Descripción"
                  className="h-8"
                />
                <div className="flex gap-2">
                  <Input
                    value={paramExample}
                    onChange={(e) => setParamExample(e.target.value)}
                    placeholder="Ejemplo: 1"
                    className="h-8"
                  />
                  <Button size="sm" variant="outline" onClick={addParameter}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Objetos utilizados
            </h3>
            {snippet.objects.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin objetos relacionados.</p>
            ) : (
              <ul className="space-y-1.5">
                {snippet.objects.map((object) => (
                  <li
                    key={object.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"
                  >
                    <Link
                      href={`/knowledge/objects/${object.id}`}
                      className="flex min-w-0 items-center gap-2 hover:text-primary"
                    >
                      <ObjectTypeBadge type={object.object_type} />
                      <span className="truncate font-mono">
                        {object.schema_name}.{object.object_name}
                      </span>
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() =>
                          removeSnippetObject(snippet.id, object.id).catch((e) =>
                            toast(e.message, "error"),
                          )
                        }
                        className="rounded p-1 text-muted-foreground hover:text-danger"
                        aria-label="Quitar relación"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canEdit && linkCandidates.length > 0 && (
              <div className="flex items-end gap-2 border-t border-border pt-3">
                <div className="flex-1">
                  <Field label="Relacionar objeto">
                    <Select
                      value={linkObjectId}
                      onChange={setLinkObjectId}
                      placeholder="Selecciona objeto"
                      options={linkCandidates.map((o) => ({
                        value: o.id,
                        label: `${o.schema_name}.${o.object_name} (${o.object_type})`,
                      }))}
                    />
                  </Field>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!linkObjectId}
                  onClick={async () => {
                    try {
                      await addSnippetObject(snippet.id, linkObjectId);
                      setLinkObjectId("");
                      toast("Objeto relacionado");
                    } catch (error) {
                      toast(error instanceof Error ? error.message : "Error", "error");
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </section>
        </div>

        {snippet.notes && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Notas</h3>
            <p className="text-sm">{snippet.notes}</p>
          </section>
        )}
      </div>

      <SnippetDialog
        key={editOpen ? snippet.id : "closed"}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        snippet={snippet}
      />
    </div>
  );
}
