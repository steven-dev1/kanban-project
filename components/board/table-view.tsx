"use client";

import { Avatar } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CardWithLabels } from "@/lib/types";
import { cn, dueState, formatDate } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

export function TableView({
  onCardClick,
}: {
  onCardClick: (card: CardWithLabels) => void;
}) {
  const { lists, labels } = useBoard();
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");

  const rows = useMemo(() => {
    const all = lists.flatMap((l) =>
      l.cards.map((c) => ({ card: c, listTitle: l.title, listColor: l.color })),
    );
    return all.filter(({ card }) => {
      if (listFilter !== "all" && card.list_id !== listFilter) return false;
      if (
        labelFilter !== "all" &&
        !card.card_labels?.some((cl) => cl.label_id === labelFilter)
      )
        return false;
      if (query && !card.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [lists, query, listFilter, labelFilter]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar cards..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={listFilter}
          onChange={setListFilter}
          className="w-44"
          options={[
            { value: "all", label: "Todas las listas" },
            ...lists.map((l) => ({
              value: l.id,
              label: l.title,
              color: l.color ?? undefined,
            })),
          ]}
        />
        <Select
          value={labelFilter}
          onChange={setLabelFilter}
          className="w-44"
          options={[
            { value: "all", label: "Todas las etiquetas" },
            ...labels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Card</th>
              <th className="px-4 py-3 font-medium">Lista</th>
              <th className="px-4 py-3 font-medium">Responsables</th>
              <th className="px-4 py-3 font-medium">Etiquetas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha límite</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Sin resultados
                </td>
              </tr>
            )}
            {rows.map(({ card, listTitle, listColor }) => {
              const st = dueState(card.due_date, card.is_completed);
              return (
                <tr
                  key={card.id}
                  onClick={() => onCardClick(card)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/50"
                >
                <td
                  className={cn(
                    "px-4 py-3 font-medium",
                    card.is_completed && "text-muted-foreground line-through",
                  )}
                >
                  {card.title}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: listColor ?? "#94a3b8" }}
                    />
                    {listTitle}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex -space-x-1.5">
                    {(card.card_assignees ?? []).map((a) => (
                      <Avatar
                        key={a.user_id}
                        name={a.profile?.full_name}
                        email={a.profile?.email}
                        size={24}
                        className="ring-2 ring-card"
                      />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {card.card_labels?.map((cl) => (
                      <span
                        key={cl.label_id}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: cl.labels.color }}
                      >
                        {cl.labels.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {st === "completed" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" /> Completada
                    </span>
                  )}
                  {st === "overdue" && (
                    <span className="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                      Vencida
                    </span>
                  )}
                  {st === "soon" && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Por vencer
                    </span>
                  )}
                  {st === "normal" && <span className="text-muted-foreground">—</span>}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-muted-foreground",
                    st === "overdue" && "font-medium text-danger",
                    st === "soon" && "font-medium text-amber-600 dark:text-amber-400",
                    st === "completed" && "text-green-600 dark:text-green-400",
                  )}
                >
                  {formatDate(card.due_date) ?? "—"}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
