"use client";

import {
  cn,
  formatDate,
  isoAtNoon,
  monthGrid,
  monthLabel,
  parseDateParts,
  todayParts,
  type DateParts,
} from "@/lib/utils";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function DatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Sin fecha",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<DateParts>(
    () => parseDateParts(value) ?? todayParts(),
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = parseDateParts(value);
  const today = todayParts();
  const cells = monthGrid(view.y, view.m);

  const isSame = (a: DateParts | null, y: number, m: number, d: number) =>
    !!a && a.y === y && a.m === m && a.d === d;

  function shiftMonth(delta: number) {
    setView((prev) => {
      const date = new Date(prev.y, prev.m + delta, 1);
      return { y: date.getFullYear(), m: date.getMonth(), d: 1 };
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-ring/60",
        )}
      >
        <span className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {value ? (
            <span>{formatDate(value)}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        {value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Quitar fecha"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronLeft className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-72 rounded-2xl border border-border bg-card p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{monthLabel(view.y, view.m)}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="flex h-8 items-center justify-center text-[11px] font-medium text-muted-foreground"
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} />;
              const isSelected = isSame(selected, view.y, view.m, day);
              const isToday = isSame(today, view.y, view.m, day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(isoAtNoon({ y: view.y, m: view.m, d: day }));
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-muted",
                    isToday && !isSelected && "font-semibold text-primary",
                    isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            <button
              type="button"
              onClick={() => {
                const t = todayParts();
                setView(t);
                onChange(isoAtNoon(t));
                setOpen(false);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
