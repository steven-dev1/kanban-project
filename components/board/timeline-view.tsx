"use client";

import type { CardWithLabels } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { GitCompareArrows, GanttChartSquare } from "lucide-react";
import { useMemo } from "react";

const MS_PER_DAY = 86400000;

/** Vista Timeline: barras por tarjeta entre fecha inicio y fin (o fecha límite). */
export function TimelineView({ onCardClick }: { onCardClick: (card: CardWithLabels) => void }) {
  const { lists } = useBoard();

  const items = useMemo(
    () =>
      lists.flatMap((list) =>
        list.cards
          .filter((card) => card.due_date || card.start_date)
          .map((card) => ({ card, list })),
      ),
    [lists],
  );

  const range = useMemo(() => {
    const dates: number[] = [];
    for (const { card } of items) {
      if (card.start_date) dates.push(new Date(card.start_date).getTime());
      if (card.due_date) dates.push(new Date(card.due_date).getTime());
    }
    if (dates.length === 0) return null;
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    return { min: min - 2 * MS_PER_DAY, max: max + 2 * MS_PER_DAY };
  }, [items]);

  if (!range || items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <GanttChartSquare className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Asigna fecha de inicio y/o límite a las tarjetas para verlas aquí.
        </p>
      </div>
    );
  }

  const span = range.max - range.min;
  const dayCount = Math.round(span / MS_PER_DAY);
  const position = (time: number) => ((time - range.min) / span) * 100;
  const today = new Date();
  const todayLeft = position(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
  );

  // Marcas de fecha, espaciadas según el rango.
  const step = dayCount > 60 ? 7 : dayCount > 30 ? 5 : dayCount > 14 ? 2 : 1;
  const marks: { left: number; label: string; isToday: boolean }[] = [];
  for (let i = 0; i <= dayCount; i += step) {
    const time = range.min + i * MS_PER_DAY;
    const date = new Date(time);
    marks.push({
      left: position(time),
      label: date.toLocaleDateString("es", { day: "2-digit", month: "short" }),
      isToday:
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear(),
    });
  }

  const byList = lists
    .map((list) => ({ list, group: items.filter(({ list: l }) => l.id === list.id) }))
    .filter((entry) => entry.group.length > 0);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex min-w-[760px]">
        {/* Columna de nombres */}
        <div className="w-48 shrink-0">
          <div className="mb-2 flex h-7 items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <GitCompareArrows className="h-3.5 w-3.5" /> Timeline
          </div>
          <div className="space-y-4">
            {byList.map(({ list, group }) => (
              <div key={list.id}>
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: list.color ?? "#94a3b8" }}
                  />
                  <span className="truncate text-xs font-semibold text-muted-foreground">
                    {list.title}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.map(({ card }) => (
                    <button
                      key={card.id}
                      onClick={() => onCardClick(card)}
                      className={cn(
                        "block w-full truncate rounded-md px-2 py-1 text-left text-[11px] hover:bg-muted",
                        card.is_completed && "text-muted-foreground line-through",
                      )}
                      title={card.title}
                    >
                      {card.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Área de barras */}
        <div className="relative min-w-0 flex-1">
          {/* Cabecera de fechas */}
          <div className="relative mb-2 h-7 border-b border-border">
            {marks.map((mark) => (
              <div
                key={mark.left}
                className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
                style={{ left: `${mark.left}%` }}
              >
                {mark.label}
              </div>
            ))}
          </div>

          <div className="relative">
            {/* Líneas guía verticales */}
            {marks.map((mark) => (
              <div
                key={`grid-${mark.left}`}
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/60"
                style={{ left: `${mark.left}%` }}
              />
            ))}
            {/* Marcador de hoy */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-danger"
              style={{ left: `${todayLeft}%` }}
              title="Hoy"
            />

            <div className="space-y-4">
              {byList.map(({ list, group }) => (
                <div key={list.id} className="space-y-1.5">
                  <div className="invisible text-xs">&nbsp;</div>
                  {group.map(({ card }) => {
                    const start = card.start_date
                      ? new Date(card.start_date).getTime()
                      : new Date(card.due_date!).getTime();
                    const end = card.due_date ? new Date(card.due_date).getTime() : start;
                    const left = position(Math.min(start, end));
                    const width = Math.max(position(Math.max(start, end)) - left, 1);
                    return (
                      <div key={card.id} className="relative h-6">
                        <button
                          onClick={() => onCardClick(card)}
                          className={cn(
                            "absolute top-0 flex h-6 items-center truncate rounded-md border px-2 text-[11px] transition-colors",
                            card.is_completed
                              ? "border-green-500/30 bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:text-green-400"
                              : "border-primary/30 bg-primary/15 text-primary hover:bg-primary/25",
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${card.title} · ${formatDate(card.start_date) ?? "?"} → ${
                            formatDate(card.due_date) ?? "?"
                          }`}
                        >
                          {card.title}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
