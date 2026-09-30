"use client";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar } from "@/components/ui/dropdown";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { aiExtractCases, type ExtractedCase } from "@/lib/ai/client";
import { cn } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { Loader2, Sparkles, Trash2, AlertTriangle, X } from "lucide-react";
import { useMemo, useState } from "react";

interface Draft {
  selected: boolean;
  title: string;
  description: string;
  listId: string;
  dueDate: string | null;
  assigneeIds: string[];
  priority: string | null;
  confidence: number;
}

export function ImportCasesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { board, lists, members, ownerProfile, importCases } = useBoard();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const people = useMemo(() => {
    const result: { user_id: string; name: string; email: string }[] = [];
    if (board && ownerProfile) {
      result.push({
        user_id: board.owner_id,
        name: ownerProfile.full_name ?? "",
        email: (ownerProfile.email ?? "").toLowerCase(),
      });
    }
    for (const member of members) {
      if (!member.profile) continue;
      result.push({
        user_id: member.user_id,
        name: member.profile.full_name ?? "",
        email: (member.profile.email ?? "").toLowerCase(),
      });
    }
    return result;
  }, [board, ownerProfile, members]);

  function matchList(name?: string | null) {
    if (name) {
      const found = lists.find(
        (list) => list.title.toLowerCase() === name.trim().toLowerCase(),
      );
      if (found) return found.id;
    }
    return lists[0]?.id ?? "";
  }

  function matchAssignees(item: ExtractedCase) {
    const ids: string[] = [];
    const email = item.assignee_email?.trim().toLowerCase();
    if (email) {
      const byEmail = people.find((person) => person.email && person.email === email);
      if (byEmail) ids.push(byEmail.user_id);
    }
    if (ids.length === 0 && item.assignee_name) {
      const byName = people.find(
        (person) =>
          person.name.length > 0 &&
          person.name.toLowerCase() === item.assignee_name!.trim().toLowerCase(),
      );
      if (byName) ids.push(byName.user_id);
    }
    return ids;
  }

  function normalizeDue(value?: string | null) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return new Date(`${value}T12:00:00`).toISOString();
  }

  async function analyze() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const cases = await aiExtractCases({
        text,
        members: people.map((person) => ({
          name: person.name || person.email,
          email: person.email,
        })),
        lists: lists.map((list) => list.title),
      });
      if (cases.length === 0) {
        setError("La IA no detectó casos en el texto. Revisa el contenido e inténtalo de nuevo.");
        setDrafts([]);
        return;
      }
      setDrafts(
        cases.map((item) => ({
          selected: true,
          title: item.title || "Caso sin título",
          description: item.description ?? "",
          listId: matchList(item.list),
          dueDate: normalizeDue(item.due_date),
          assigneeIds: matchAssignees(item),
          priority: item.priority ?? null,
          confidence: item.confidence ?? 0,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar el texto.");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  }

  async function create() {
    const selected = drafts.filter((draft) => draft.selected && draft.listId);
    if (selected.length === 0) {
      setError("Selecciona al menos un caso para crear.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const count = await importCases(
        selected.map((draft) => ({
          title: draft.title.trim() || "Caso sin título",
          description:
            [
              draft.priority ? `Prioridad: ${draft.priority}` : null,
              draft.description.trim() || null,
            ]
              .filter(Boolean)
              .join("\n\n") || null,
          due_date: draft.dueDate,
          list_id: draft.listId,
          assignee_user_ids: draft.assigneeIds,
        })),
      );
      toast(`${count} ${count === 1 ? "tarjeta creada" : "tarjetas creadas"}`);
      setText("");
      setDrafts([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron crear las tarjetas.");
    } finally {
      setSaving(false);
    }
  }

  const listOptions = lists.map((list) => ({ value: list.id, label: list.title }));

  return (
    <Modal open={open} onClose={onClose} title="Detectar casos con IA" size="xl">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Pega el correo o texto con los casos. La IA los detectará y propondrá
          tarjetas con título, descripción, responsable, lista y fecha límite.
        </p>
        <Textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí el correo con los casos…"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {text.trim().length.toLocaleString()} caracteres
          </span>
          <div className="flex gap-2">
            {drafts.length > 0 && (
              <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}>
                Descartar propuesta
              </Button>
            )}
            <Button onClick={analyze} disabled={loading || !text.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analizando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Analizar con IA
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {drafts.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {drafts.length} {drafts.length === 1 ? "caso detectado" : "casos detectados"}
              </p>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setDrafts((prev) =>
                    prev.map((draft) => ({ ...draft, selected: true })),
                  )
                }
              >
                Seleccionar todos
              </button>
            </div>

            <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
              {drafts.map((draft, index) => {
                const assignees = people.filter((person) =>
                  draft.assigneeIds.includes(person.user_id),
                );
                return (
                  <div
                    key={index}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      draft.selected
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(e) => updateDraft(index, { selected: e.target.checked })}
                        className="mt-2 h-4 w-4"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Input
                          value={draft.title}
                          onChange={(e) => updateDraft(index, { title: e.target.value })}
                        />
                        {draft.description && (
                          <Textarea
                            rows={2}
                            value={draft.description}
                            onChange={(e) =>
                              updateDraft(index, { description: e.target.value })
                            }
                            className="text-xs"
                          />
                        )}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Select
                            value={draft.listId}
                            onChange={(value) => updateDraft(index, { listId: value })}
                            options={listOptions}
                          />
                          <DatePicker
                            value={draft.dueDate}
                            onChange={(value) => updateDraft(index, { dueDate: value })}
                            placeholder="Sin fecha"
                          />
                          <div className="flex flex-wrap items-center gap-1.5">
                            {assignees.map((person) => (
                              <span
                                key={person.user_id}
                                className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs"
                              >
                                <Avatar name={person.name} email={person.email} size={18} />
                                <span className="max-w-[120px] truncate">
                                  {person.name || person.email}
                                </span>
                                <button
                                  onClick={() =>
                                    updateDraft(index, {
                                      assigneeIds: draft.assigneeIds.filter(
                                        (id) => id !== person.user_id,
                                      ),
                                    })
                                  }
                                  className="text-muted-foreground hover:text-danger"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            {draft.assigneeIds.length === 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                Sin responsable detectado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {draft.priority && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            {draft.priority}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setDrafts((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="rounded-md p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                          title="Quitar caso"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                Se crearán {drafts.filter((d) => d.selected).length} tarjetas en el tablero.
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={create} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creando…
                    </>
                  ) : (
                    "Crear tarjetas"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
