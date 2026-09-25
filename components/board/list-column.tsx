"use client";

import { CardItem } from "@/components/board/card-item";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import type { BoardList, CardWithLabels } from "@/lib/types";
import { LIST_COLORS, cn } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  GripVertical,
  MoreHorizontal,
  Palette,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  list: BoardList & { cards: CardWithLabels[] };
  canEdit: boolean;
  onCardClick: (card: CardWithLabels) => void;
}

export function ListColumn({ list, canEdit, onCardClick }: Props) {
  const { updateList, archiveList, deleteList, addCard } = useBoard();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState(list.title);
  const [adding, setAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id, data: { type: "list" } });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `cards-${list.id}`,
    data: { type: "list", listId: list.id },
  });

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function commitTitle() {
    setEditingTitle(false);
    if (draft.trim() && draft !== list.title) {
      await updateList(list.id, { title: draft.trim() });
    } else {
      setDraft(list.title);
    }
  }

  async function submitCard() {
    const value = newCardTitle.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    setCardError(null);
    setSubmitting(true);
    try {
      await addCard(list.id, value);
      setNewCardTitle("");
      inputRef.current?.focus();
    } catch (err) {
      setCardError(
        err instanceof Error ? err.message : "No se pudo crear la card",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex max-h-full w-[85vw] shrink-0 flex-col rounded-2xl border border-border bg-muted/60 sm:w-72",
        isDragging && "opacity-50",
      )}
    >
      <div
        className="flex items-center gap-1.5 rounded-t-2xl border-b border-border/70 px-2.5 py-2"
        style={{ boxShadow: `inset 0 3px 0 0 ${list.color ?? "#94a3b8"}` }}
      >
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label="Mover lista"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {editingTitle ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setDraft(list.title);
                setEditingTitle(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1 text-sm font-semibold outline-none"
          />
        ) : (
          <h3
            className={cn(
              "min-w-0 flex-1 truncate px-1 text-sm font-semibold",
              canEdit && "cursor-text",
            )}
            onClick={() => {
              if (!canEdit) return;
              setDraft(list.title);
              setEditingTitle(true);
            }}
          >
            {list.title}
          </h3>
        )}

        <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {list.cards.length}
        </span>

        {canEdit && (
          <Dropdown
            trigger={
              <button className="rounded-md p-1 text-muted-foreground hover:bg-background">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            {(close) => (
              <div className="w-52">
                <DropdownItem
                  onClick={() => {
                    close();
                    setCardError(null);
                    setAdding(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Añadir card
                </DropdownItem>
                <div className="px-2 py-1.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Palette className="h-3.5 w-3.5" /> Color
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {LIST_COLORS.map((c) => (
                      <button
                        key={c.value}
                        title={c.name}
                        onClick={() => {
                          updateList(list.id, { color: c.value });
                          close();
                        }}
                        className={cn(
                          "h-5 w-5 rounded-full border border-border/50 transition-transform hover:scale-110",
                          list.color === c.value && "ring-2 ring-ring ring-offset-1",
                        )}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>
                <DropdownItem
                  onClick={() => {
                    close();
                    archiveList(list.id, true);
                    toast("Lista archivada");
                  }}
                >
                  <Archive className="h-4 w-4" /> Archivar lista
                </DropdownItem>
                <DropdownItem
                  danger
                  onClick={async () => {
                    close();
                    const ok = await confirm({
                      title: "Eliminar lista",
                      message: `¿Eliminar la lista "${list.title}" y sus cards?`,
                      confirmLabel: "Eliminar",
                      danger: true,
                    });
                    if (ok) {
                      await deleteList(list.id);
                      toast("Lista eliminada");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Eliminar lista
                </DropdownItem>
              </div>
            )}
          </Dropdown>
        )}
      </div>

      <div
        ref={setDropRef}
        className={cn(
          "flex min-h-[8px] flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors",
          isOver && "bg-primary/5",
        )}
      >
        <SortableContext
          items={list.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {list.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              canEdit={canEdit}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>

        {list.cards.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            Sin cards
          </p>
        )}

        {adding && (
          <div className="rounded-xl border border-border bg-card p-2">
            <textarea
              ref={inputRef}
              rows={2}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitCard();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewCardTitle("");
                }
              }}
              placeholder="Título de la card..."
              className="w-full resize-none bg-transparent text-sm outline-none"
            />
            {cardError && (
              <p className="mt-1.5 rounded-md bg-danger/10 px-2 py-1 text-[11px] text-danger">
                {cardError}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <Button size="sm" onClick={submitCard} disabled={submitting}>
                {submitting ? "Añadiendo..." : "Añadir"}
              </Button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewCardTitle("");
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {canEdit && !adding && (
        <button
          onClick={() => {
            setCardError(null);
            setAdding(true);
          }}
          className="m-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Añadir card
        </button>
      )}
    </div>
  );
}
