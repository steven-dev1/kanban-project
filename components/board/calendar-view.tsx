"use client";

import { Avatar } from "@/components/ui/dropdown";
import type { CardWithLabels } from "@/lib/types";
import { cn, dueState, formatDate } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
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

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Vista Calendario: tarjetas por fecha límite, con detalle del día elegido. */
export function CalendarView({ onCardClick }: { onCardClick: (card: CardWithLabels) => void }) {
  const { lists, updateCard, canEdit } = useBoard();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const cards = useMemo(() => lists.flatMap((l) => l.cards), [lists]);
  const listColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of lists) map.set(list.id, list.color ?? "#94a3b8");
    return map;
  }, [lists]);

  const firstDay = startOfMonth(month);
  const leading = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -leading);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const cardsByDay = useMemo(() => {
    const map = new Map<string, CardWithLabels[]>();
    for (const card of cards) {
      if (!card.due_date) continue;
      const key = dayKey(new Date(card.due_date));
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    return map;
  }, [cards]);

  const withoutDate = useMemo(() => cards.filter((c) => !c.due_date), [cards]);
  const selectedCards = cardsByDay.get(dayKey(selected)) ?? [];
  const monthLabel = month.toLocaleDateString("es", { month: "long", year: "numeric" });

  const goToday = () => {
    const today = new Date();
    setMonth(startOfMonth(today));
    setSelected(today);
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4 lg:flex-row">
      {/* Calendario */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold capitalize">
            <CalendarDays className="h-4 w-4 text-primary" />
            {monthLabel}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              Hoy
            </button>
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden rounded-xl border border-border">
          {days.map((day) => {
            const key = dayKey(day);
            const dayCards = cardsByDay.get(key) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            const isToday = sameDay(day, new Date());
            const isSelected = sameDay(day, selected);
            const hasOverdue = dayCards.some((c) => !c.is_completed && dueState(c.due_date, c.is_completed) === "overdue");
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(day)}
                onDragOver={(e) => {
                  if (canEdit && dragCardId) {
                    e.preventDefault();
                    setHoverDay(key);
                  }
                }}
                onDragLeave={() => setHoverDay((h) => (h === key ? null : h))}
                onDrop={() => {
                  if (dragCardId && canEdit) {
                    const iso = new Date(
                      day.getFullYear(),
                      day.getMonth(),
                      day.getDate(),
                      12,
                    ).toISOString();
                    updateCard(dragCardId, { due_date: iso });
                  }
                  setDragCardId(null);
                  setHoverDay(null);
                }}
                className={cn(
                  "flex min-h-20 flex-col items-stretch gap-1 border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0",
                  !inMonth ? "bg-muted/30" : "bg-card hover:bg-muted/40",
                  isSelected && "ring-2 ring-inset ring-primary",
                  hoverDay === key && "bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                  {dayCards.slice(0, 3).map((card) => (
                    <span
                      key={card.id}
                      draggable={canEdit}
                      onDragStart={() => setDragCardId(card.id)}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[9px] leading-tight",
                        card.is_completed
                          ? "bg-green-500/15 text-green-700 line-through dark:text-green-400"
                          : "bg-muted text-muted-foreground",
                      )}
                      title={card.title}
                    >
                      {card.title}
                    </span>
                  ))}
                  {dayCards.length > 3 && (
                    <span className="px-1 text-[9px] text-muted-foreground">
                      +{dayCards.length - 3} más
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {dayCards.length > 0 && (
                    <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">
                      {dayCards.length}
                    </span>
                  )}
                  {hasOverdue && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del día */}
      <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-card lg:w-72">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold capitalize">
            {selected.toLocaleDateString("es", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedCards.length} {selectedCards.length === 1 ? "tarjeta" : "tarjetas"} con
            vencimiento
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {selectedCards.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nada agendado este día.
            </p>
          ) : (
            selectedCards.map((card) => (
              <button
                key={card.id}
                onClick={() => onCardClick(card)}
                className="flex w-full items-start gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-muted/50"
              >
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: listColor.get(card.list_id) ?? "#94a3b8" }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-xs font-medium",
                      card.is_completed && "text-muted-foreground line-through",
                    )}
                  >
                    {card.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {card.is_completed && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    {card.card_assignees?.slice(0, 2).map((a) => (
                      <Avatar key={a.user_id} name={a.profile?.full_name} size={14} />
                    ))}
                    {card.start_date && <span>inicio {formatDate(card.start_date)}</span>}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {withoutDate.length > 0 && (
          <div className="border-t border-border p-2.5">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
              <Inbox className="h-3 w-3" /> Sin fecha ({withoutDate.length})
            </p>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {withoutDate.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onCardClick(card)}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/70"
                >
                  {card.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
