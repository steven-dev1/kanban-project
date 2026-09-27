"use client";

import type { CardWithLabels } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { useMemo, useState } from "react";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

/** Vista Calendario: tarjetas ubicadas por fecha límite, se pueden mover de día. */
export function CalendarView({ onCardClick }: { onCardClick: (card: CardWithLabels) => void }) {
  const { lists, updateCard, canEdit } = useBoard();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const cards = useMemo(() => lists.flatMap((l) => l.cards), [lists]);

  const firstDay = startOfMonth(month);
  // Lunes = 0
  const leading = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -leading);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const cardsByDay = useMemo(() => {
    const map = new Map<string, CardWithLabels[]>();
    for (const card of cards) {
      if (!card.due_date) continue;
      const key = new Date(card.due_date).toDateString();
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    return map;
  }, [cards]);

  const withoutDate = cards.filter((c) => !c.due_date);

  const monthLabel = month.toLocaleDateString("es", { month: "long", year: "numeric" });

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            ←
          </button>
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Hoy
          </button>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-card py-1.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-b-xl border border-t-0 border-border bg-border">
        {days.map((day) => {
          const key = day.toDateString();
          const dayCards = cardsByDay.get(key) ?? [];
          const inMonth = day.getMonth() === month.getMonth();
          const isToday = sameDay(day, new Date());
          return (
            <div
              key={key}
              onDragOver={(e) => {
                if (canEdit && dragCardId) {
                  e.preventDefault();
                  setHoverDay(key);
                }
              }}
              onDragLeave={() => setHoverDay((h) => (h === key ? null : h))}
              onDrop={() => {
                if (dragCardId && canEdit) {
                  const iso = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();
                  updateCard(dragCardId, { due_date: iso });
                }
                setDragCardId(null);
                setHoverDay(null);
              }}
              className={cn(
                "min-h-24 bg-card p-1.5",
                !inMonth && "bg-muted/30",
                hoverDay === key && "bg-primary/10 ring-1 ring-inset ring-primary",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                  isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {day.getDate()}
              </div>
              <div className="flex flex-col gap-1">
                {dayCards.map((card) => (
                  <button
                    key={card.id}
                    draggable={canEdit}
                    onDragStart={() => setDragCardId(card.id)}
                    onClick={() => onCardClick(card)}
                    className="truncate rounded bg-muted px-1.5 py-1 text-left text-[10px] hover:bg-muted/70"
                    title={card.title}
                  >
                    {card.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {withoutDate.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Sin fecha límite ({withoutDate.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {withoutDate.map((card) => (
              <button
                key={card.id}
                draggable={canEdit}
                onDragStart={() => setDragCardId(card.id)}
                onClick={() => onCardClick(card)}
                className="rounded bg-muted px-2 py-1 text-[11px] hover:bg-muted/70"
              >
                {card.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
