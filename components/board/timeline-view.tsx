"use client";

import type { CardWithLabels } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { useMemo } from "react";

const MS_PER_DAY = 86400000;

/** Vista Timeline: barras por tarjeta entre fecha inicio y fin (o fecha límite). */
export function TimelineView({ onCardClick }: { onCardClick: (card: CardWithLabels) => void }) {
  const { lists } = useBoard();

  const cards = useMemo(
    () =>
      lists
        .flatMap((list) => list.cards.map((card) => ({ card, list })))
        .filter(({ card }) => card.due_date || card.start_date),
    [lists],
  );

  const range = useMemo(() => {
    const dates: number[] = [];
    for (const { card } of cards) {
      if (card.start_date) dates.push(new Date(card.start_date).getTime());
      if (card.due_date) dates.push(new Date(card.due_date).getTime());
    }
    if (dates.length === 0) return null;
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    // Padding de 2 días a cada lado.
    return { min: min - 2 * MS_PER_DAY, max: max + 2 * MS_PER_DAY };
  }, [cards]);

  if (!range || cards.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        Asigna fecha de inicio y/o límite a las tarjetas para verlas aquí.
      </p>
    );
  }

  const span = range.max - range.min;
  const dayCount = Math.round(span / MS_PER_DAY);
  const position = (time: number) => ((time - range.min) / span) * 100;

  // Marcas de días (espaciadas según el rango).
  const step = dayCount > 40 ? 7 : dayCount > 14 ? 2 : 1;
  const marks: { left: number; label: string }[] = [];
  for (let i = 0; i <= dayCount; i += step) {
    const time = range.min + i * MS_PER_DAY;
    marks.push({
      left: position(time),
      label: new Date(time).toLocaleDateString("es", { day: "2-digit", month: "short" }),
    });
  }

  const byList = lists
    .map((list) => ({
      list,
      items: cards.filter(({ list: l }) => l.id === list.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="min-w-[720px]">
        <div className="relative mb-2 h-6 border-b border-border">
          {marks.map((mark) => (
            <div
              key={mark.left}
              className="absolute top-0 flex h-full flex-col items-center"
              style={{ left: `${mark.left}%` }}
            >
              <span className="text-[9px] text-muted-foreground">{mark.label}</span>
              <div className="h-full w-px bg-border" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {byList.map(({ list, items }) => (
            <div key={list.id}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">{list.title}</p>
              <div className="space-y-1.5">
                {items.map(({ card }) => {
                  const start = card.start_date
                    ? new Date(card.start_date).getTime()
                    : new Date(card.due_date!).getTime();
                  const end = card.due_date
                    ? new Date(card.due_date).getTime()
                    : start;
                  const left = position(Math.min(start, end));
                  const width = Math.max(position(Math.max(start, end)) - left, 1.5);
                  return (
                    <div key={card.id} className="relative h-7">
                      <button
                        onClick={() => onCardClick(card)}
                        className={cn(
                          "absolute top-0 flex h-7 items-center truncate rounded-md border border-primary/30 bg-primary/15 px-2 text-[11px] text-primary hover:bg-primary/25",
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${card.title}${card.due_date ? ` · ${new Date(card.due_date).toLocaleDateString()}` : ""}`}
                      >
                        {card.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
