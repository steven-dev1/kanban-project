"use client";

import { Avatar } from "@/components/ui/dropdown";
import type { CardWithLabels } from "@/lib/types";
import { cn, DUE_STATE_COLORS, dueState, formatDate } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Calendar, CheckCircle2, Circle, Paperclip } from "lucide-react";
import { useEffect, useRef } from "react";

export function CardItem({
  card,
  canEdit,
  onClick,
}: {
  card: CardWithLabels;
  canEdit: boolean;
  onClick: () => void;
}) {
  const { toggleCardComplete } = useBoard();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: { type: "card", listId: card.list_id },
      disabled: !canEdit,
    });

  const draggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) draggedRef.current = true;
  }, [isDragging]);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const state = dueState(card.due_date, card.is_completed);
  const accent = DUE_STATE_COLORS[state];
  const labelList = card.card_labels?.map((cl) => cl.labels).filter(Boolean).slice(0, 4);
  const assignees = card.card_assignees ?? [];
  const attachmentCount = card.attachments?.length ?? 0;

  function handleClick() {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onClick();
  }

  const stateLabel = {
    completed: "Completada",
    overdue: "Fecha límite vencida",
    soon: "Fecha límite próxima",
    normal: "",
  }[state];

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(state !== "normal" ? { borderLeftColor: accent } : {}),
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      title={stateLabel || undefined}
      className={cn(
        "group/card relative rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        state !== "normal" && "border-l-4",
        state === "completed" && "bg-green-500/5",
        state === "overdue" && "bg-red-500/5",
        state === "soon" && "bg-amber-500/5",
        isDragging && "opacity-40",
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        "touch-none",
      )}
    >
      {canEdit && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleCardComplete(card.id, !card.is_completed);
          }}
          className="absolute top-2 right-2 z-10 rounded-full bg-card/80 p-0.5 transition-colors"
          title={card.is_completed ? "Marcar como pendiente" : "Marcar como completada"}
        >
          {card.is_completed ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground hover:text-green-500" />
          )}
        </button>
      )}

      {labelList && labelList.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 pr-6">
          {labelList.map((label) => (
            <span
              key={label.id}
              className="h-1.5 w-8 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}

      <p
        className={cn(
          "pr-6 text-sm leading-snug font-medium break-words",
          card.is_completed && "text-muted-foreground line-through",
        )}
      >
        {card.title}
      </p>

      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {card.due_date && (
          <span
            className={cn(
              "flex items-center gap-1",
              state === "overdue" && "font-medium text-danger",
              state === "soon" && "font-medium text-amber-600 dark:text-amber-400",
              state === "completed" && "text-green-600 dark:text-green-400",
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(card.due_date)}
          </span>
        )}
        {card.description && card.description !== "<p></p>" && (
          <AlignLeft className="h-3.5 w-3.5" />
        )}
        {attachmentCount > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="h-3.5 w-3.5" />
            {attachmentCount}
          </span>
        )}

        {assignees.length > 0 && (
          <div className="ml-auto flex -space-x-1.5">
            {assignees.slice(0, 3).map((a) => (
              <Avatar
                key={a.user_id}
                name={a.profile?.full_name}
                email={a.profile?.email}
                size={22}
                className="ring-2 ring-card"
              />
            ))}
            {assignees.length > 3 && (
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
