"use client";

import { ListColumn } from "@/components/board/list-column";
import { Button } from "@/components/ui/button";
import type { CardWithLabels } from "@/lib/types";
import { LIST_COLORS } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus, X } from "lucide-react";
import { useState } from "react";

export function KanbanView({
  onCardClick,
}: {
  onCardClick: (card: CardWithLabels) => void;
}) {
  const { lists, canEdit, moveCard, moveList, addList } = useBoard();
  const [activeCard, setActiveCard] = useState<CardWithLabels | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [listTitle, setListTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function cardList(cardId: string) {
    return lists.find((l) => l.cards.some((c) => c.id === cardId));
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "card") {
      const list = cardList(event.active.id as string);
      const card = list?.cards.find((c) => c.id === event.active.id);
      setActiveCard(card ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over || active.id === over.id) return;

    if (active.data.current?.type === "list") {
      const ids = lists.map((l) => l.id);
      const oldIndex = ids.indexOf(active.id as string);
      let overIndex = ids.indexOf(over.id as string);
      if (overIndex === -1) {
        const list = cardList(over.id as string);
        overIndex = list ? ids.indexOf(list.id) : -1;
      }
      if (oldIndex === -1 || overIndex === -1) return;
      const reordered = arrayMove(ids, oldIndex, overIndex);
      const pos = reordered.indexOf(active.id as string);
      const before =
        pos > 0 ? lists.find((l) => l.id === reordered[pos - 1])?.position ?? null : null;
      const after =
        pos < reordered.length - 1
          ? lists.find((l) => l.id === reordered[pos + 1])?.position ?? null
          : null;
      moveList(active.id as string, before, after);
      return;
    }

    const targetListId =
      (over.data.current?.listId as string | undefined) ?? cardList(over.id as string)?.id;
    if (!targetListId) return;
    const targetList = lists.find((l) => l.id === targetListId);
    if (!targetList) return;

    const targetCards = targetList.cards.filter((c) => c.id !== active.id);
    let insertIndex = targetCards.length;
    if (over.data.current?.type === "card") {
      const oi = targetCards.findIndex((c) => c.id === over.id);
      if (oi !== -1) insertIndex = oi;
    }
    const before = insertIndex > 0 ? targetCards[insertIndex - 1].position : null;
    const after =
      insertIndex < targetCards.length ? targetCards[insertIndex].position : null;
    moveCard(active.id as string, targetListId, before, after);
  }

  async function submitList() {
    const value = listTitle.trim();
    if (!value) {
      setAddingList(false);
      return;
    }
    setListTitle("");
    setAddingList(false);
    await addList(value, LIST_COLORS[lists.length % LIST_COLORS.length].value);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full items-start gap-3 overflow-x-auto p-4">
        <SortableContext
          items={lists.map((l) => l.id)}
          strategy={horizontalListSortingStrategy}
        >
          {lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              canEdit={canEdit}
              onCardClick={onCardClick}
            />
          ))}
        </SortableContext>

        {canEdit && (
          <div className="w-72 shrink-0">
            {addingList ? (
              <div className="rounded-2xl border border-border bg-muted/60 p-2">
                <input
                  autoFocus
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitList();
                    if (e.key === "Escape") {
                      setAddingList(false);
                      setListTitle("");
                    }
                  }}
                  placeholder="Nombre de la lista..."
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={submitList}>
                    Añadir lista
                  </Button>
                  <button
                    onClick={() => {
                      setAddingList(false);
                      setListTitle("");
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Añadir lista
              </button>
            )}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeCard && (
          <div className="w-72 rotate-2 rounded-xl border border-primary/40 bg-card p-3 shadow-2xl">
            <p className="text-sm font-medium">{activeCard.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
