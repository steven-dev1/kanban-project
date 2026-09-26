"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { CardWithLabels } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function CardChecklist({
  card,
  canEdit,
}: {
  card: CardWithLabels;
  canEdit: boolean;
}) {
  const { addChecklistItem, toggleChecklistItem, deleteChecklistItem } = useBoard();
  const { toast } = useToast();
  const [text, setText] = useState("");

  const items = [...(card.card_checklist_items ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const done = items.filter((i) => i.is_done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;

  const add = async () => {
    if (!text.trim()) return;
    const value = text.trim();
    setText("");
    try {
      await addChecklistItem(card.id, value);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error", "error");
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CheckSquare className="h-4 w-4" /> Checklist
        </label>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{items.length} · {percent}%
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <ul className="space-y-0.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
          >
            <input
              type="checkbox"
              checked={item.is_done}
              disabled={!canEdit}
              onChange={(e) =>
                toggleChecklistItem(item.id, e.target.checked).catch((err) =>
                  toast(err instanceof Error ? err.message : "Error", "error"),
                )
              }
              className="h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span
              className={cn(
                "flex-1 text-sm",
                item.is_done && "text-muted-foreground line-through",
              )}
            >
              {item.text}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  deleteChecklistItem(item.id).catch((err) =>
                    toast(err instanceof Error ? err.message : "Error", "error"),
                  )
                }
                className="rounded p-1 text-muted-foreground opacity-0 hover:text-danger group-hover:opacity-100"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Agregar elemento al checklist…"
            className="h-8"
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!text.trim()}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
