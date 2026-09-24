"use client";

import { RichTextEditor } from "@/components/board/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/dropdown";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { CardAssignee } from "@/lib/types";
import { LABEL_COLORS, cn, formatDate } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import {
  Archive,
  Calendar,
  Download,
  Loader2,
  Paperclip,
  Plus,
  Tag,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CardDialog({
  cardId,
  onClose,
}: {
  cardId: string | null;
  onClose: () => void;
}) {
  const {
    board,
    lists,
    labels,
    members,
    ownerProfile,
    canEdit,
    updateCard,
    archiveCard,
    deleteCard,
    toggleCardLabel,
    createLabel,
    toggleAssignee,
    addAttachment,
    deleteAttachment,
    getAttachmentUrl,
  } = useBoard();

  const card = useMemo(() => {
    if (!cardId) return null;
    for (const list of lists) {
      const found = list.cards.find((c) => c.id === cardId);
      if (found) return found;
    }
    return null;
  }, [lists, cardId]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const people = useMemo<CardAssignee[]>(() => {
    const list: CardAssignee[] = [];
    if (board) list.push({ user_id: board.owner_id, profile: ownerProfile });
    for (const m of members) {
      if (!list.some((p) => p.user_id === m.user_id)) {
        list.push({ user_id: m.user_id, profile: m.profile });
      }
    }
    return list;
  }, [board, ownerProfile, members]);

  const assignedIds = useMemo(
    () => new Set((card?.card_assignees ?? []).map((a) => a.user_id)),
    [card],
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !card) return;
    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError("El archivo supera el límite de 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAttachmentError(null);
    setUploading(true);
    const error = await addAttachment(card.id, file);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (error) setAttachmentError(error);
  }

  async function openAttachment(path: string) {
    const url = await getAttachmentUrl(path);
    if (url) window.open(url, "_blank", "noopener");
  }

  useEffect(() => {
    if (card && initialised.current !== card.id) {
      initialised.current = card.id;
      setTitle(card.title);
      setDescription(card.description ?? "");
    }
    if (!card) initialised.current = null;
  }, [card]);

  if (!card) return null;

  const assigned = new Set(card.card_labels?.map((cl) => cl.label_id));
  const dueValue = card.due_date ? card.due_date.slice(0, 10) : "";

  function handleDescription(html: string) {
    setDescription(html);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateCard(card!.id, { description: html });
    }, 600);
  }

  async function handleCreateLabel() {
    if (!newLabelName.trim()) return;
    const label = await createLabel(newLabelName.trim(), newLabelColor);
    if (label) await toggleCardLabel(card!.id, label.id, true);
    setNewLabelName("");
    setNewLabelColor(LABEL_COLORS[0]);
    setShowNewLabel(false);
  }

  return (
    <Modal open={!!cardId} onClose={onClose} size="lg" title="Detalle de la card">
      <div className="flex flex-col gap-5">
        <input
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== card.title)
              updateCard(card.id, { title: title.trim() });
          }}
          className="w-full rounded-lg border border-transparent bg-transparent px-1 text-lg font-semibold outline-none hover:border-border focus:border-input"
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_200px]">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              Descripción
            </label>
            <RichTextEditor
              content={description}
              onChange={handleDescription}
              editable={canEdit}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Tag className="h-3.5 w-3.5" /> Etiquetas
              </label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const active = assigned.has(label.id);
                  return (
                    <button
                      key={label.id}
                      disabled={!canEdit}
                      onClick={() => toggleCardLabel(card.id, label.id, !active)}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white transition-all",
                        active ? "shadow-sm" : "opacity-40 hover:opacity-70",
                      )}
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </button>
                  );
                })}
                {labels.length === 0 && !showNewLabel && (
                  <p className="text-xs text-muted-foreground">Sin etiquetas</p>
                )}
              </div>

              {canEdit && !showNewLabel && (
                <button
                  onClick={() => setShowNewLabel(true)}
                  className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Nueva etiqueta
                </button>
              )}

              {showNewLabel && (
                <div className="mt-1 rounded-lg border border-border p-2">
                  <Input
                    autoFocus
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Nombre"
                    className="h-8 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewLabelColor(color)}
                        className={cn(
                          "h-5 w-5 rounded-full",
                          newLabelColor === color && "ring-2 ring-ring ring-offset-1",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={handleCreateLabel}>
                      Crear
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewLabel(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Fecha límite
              </label>
              <Input
                type="date"
                disabled={!canEdit}
                value={dueValue}
                onChange={(e) =>
                  updateCard(card.id, {
                    due_date: e.target.value
                      ? new Date(`${e.target.value}T12:00:00`).toISOString()
                      : null,
                  })
                }
              />
              {card.due_date && (
                <p className="text-xs text-muted-foreground">{formatDate(card.due_date)}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Lista</label>
              <Select
                disabled={!canEdit}
                value={card.list_id}
                onChange={(e) => updateCard(card.id, { list_id: e.target.value })}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Responsables
            </label>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const active = assignedIds.has(p.user_id);
                return (
                  <button
                    key={p.user_id}
                    disabled={!canEdit}
                    onClick={() => toggleAssignee(card.id, p.user_id, !active)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border opacity-60 hover:opacity-100",
                    )}
                  >
                    <Avatar name={p.profile?.full_name} email={p.profile?.email} size={18} />
                    {p.profile?.full_name || p.profile?.email || "Usuario"}
                  </button>
                );
              })}
              {people.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin miembros</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" /> Adjuntos
            </label>
            <div className="flex flex-col gap-1.5">
              {(card.attachments ?? []).map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <button
                    onClick={() => openAttachment(att.path)}
                    className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
                  >
                    {att.name}
                  </button>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatSize(att.size)}
                  </span>
                  <button
                    onClick={() => openAttachment(att.path)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Abrir"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => deleteAttachment(att)}
                      className="p-1 text-muted-foreground hover:text-danger"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {canEdit && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-fit"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {uploading ? "Subiendo..." : "Adjuntar archivo"}
                  </Button>
                </>
              )}
              {attachmentError && (
                <p className="text-xs text-danger">{attachmentError}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Creada el {new Date(card.created_at).toLocaleDateString()}
          </p>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  archiveCard(card.id, true);
                  onClose();
                }}
              >
                <Archive className="h-4 w-4" /> Archivar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm("¿Eliminar esta card?")) {
                    deleteCard(card.id);
                    onClose();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
