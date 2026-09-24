"use client";

import { Avatar } from "@/components/ui/dropdown";
import type { CardWithLabels } from "@/lib/types";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Calendar, Paperclip } from "lucide-react";
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

  const overdue = isOverdue(card.due_date);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group/card relative rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-40",
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        "touch-none",
      )}
    >
      {labelList && labelList.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
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

      <p className="text-sm leading-snug font-medium break-words">{card.title}</p>

      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {card.due_date && (
          <span className={cn("flex items-center gap-1", overdue && "font-medium text-danger")}>
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
