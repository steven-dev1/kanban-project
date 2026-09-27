"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { BoardList, Card, Profile } from "@/lib/types";
import { displayObjectName } from "@/lib/knowledge/format";
import { cn } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { BarChart3, FileWarning, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface BoardOption {
  id: string;
  title: string;
}

interface CardRow extends Card {
  card_assignees: { user_id: string }[];
}

export function ReportsDashboard() {
  const { objects, snippets } = useKnowledge();
  const supabase = createClient();

  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [boardId, setBoardId] = useState<string>("");
  const [lists, setLists] = useState<BoardList[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("boards")
      .select("id, title, is_template")
      .eq("is_template", false)
      .order("updated_at", { ascending: false })
      .then((res: { data: unknown }) => {
        const rows = (res.data as BoardOption[]) ?? [];
        setBoards(rows);
        setBoardId((prev) => prev || rows[0]?.id || "");
      });
  }, [supabase]);

  const loadBoard = useCallback(
    async (id: string) => {
      if (!id) return;
      setLoading(true);
      const [listsRes, cardsRes, profilesRes] = await Promise.all([
        supabase.from("lists").select("*").eq("board_id", id).order("position"),
        supabase.from("cards").select("*, card_assignees(user_id)").eq("board_id", id),
        supabase.from("profiles").select("*"),
      ]);
      setLists((listsRes.data as BoardList[]) ?? []);
      setCards((cardsRes.data as CardRow[]) ?? []);
      setProfiles((profilesRes.data as Profile[]) ?? []);
      setNow(Date.now());
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    queueMicrotask(() => loadBoard(boardId));
  }, [boardId, loadBoard]);

  const byColumn = useMemo(
    () =>
      lists.map((list) => ({
        list,
        total: cards.filter((c) => c.list_id === list.id && !c.is_archived).length,
        overdue: cards.filter(
          (c) =>
            c.list_id === list.id &&
            !c.is_archived &&
            c.due_date &&
            !c.is_completed &&
            new Date(c.due_date).getTime() < now,
        ).length,
      })),
    [lists, cards, now],
  );

  const overdue = cards.filter(
    (c) => !c.is_archived && c.due_date && !c.is_completed && new Date(c.due_date).getTime() < now,
  );
  const completed = cards.filter((c) => c.is_completed && !c.is_archived);

  const byAssignee = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of cards) {
      if (card.is_archived || card.is_completed) continue;
      for (const a of card.card_assignees) {
        map.set(a.user_id, (map.get(a.user_id) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([userId, count]) => ({
        name: profiles.find((p) => p.id === userId)?.full_name ?? "Usuario",
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [cards, profiles]);

  // --- Hub ---
  const documentedObjects = objects.filter(
    (o) => o.description && o.description.trim().length > 0,
  ).length;
  const objectsWithoutOwner = objects.filter((o) => !o.owner);
  const columnsTotal = objects.reduce((acc, o) => acc + o.columns.length, 0);
  const columnsDocumented = objects.reduce(
    (acc, o) =>
      acc +
      o.columns.filter((c) => c.description || c.business_meaning).length,
    0,
  );
  const coverage = objects.length > 0 ? Math.round((documentedObjects / objects.length) * 100) : 0;
  const columnCoverage =
    columnsTotal > 0 ? Math.round((columnsDocumented / columnsTotal) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" /> Informes
          </h1>
          <p className="text-sm text-muted-foreground">
            Métricas de tableros y estado de documentación del hub.
          </p>
        </div>

        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Tablero</h2>
            <div className="w-64">
              <Select
                value={boardId}
                onChange={setBoardId}
                options={boards.map((b) => ({ value: b.id, label: b.title }))}
              />
            </div>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
            </p>
          ) : boards.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no hay tableros.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Tarjetas activas" value={cards.filter((c) => !c.is_archived).length} />
                <Metric label="Completadas" value={completed.length} />
                <Metric label="Vencidas" value={overdue.length} tone="danger" />
                <Metric label="Columnas" value={lists.length} />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Tarjetas por columna
                </h3>
                <ul className="space-y-1.5">
                  {byColumn.map(({ list, total, overdue: ovd }) => {
                    const max = Math.max(...byColumn.map((c) => c.total), 1);
                    return (
                      <li key={list.id} className="flex items-center gap-3 text-xs">
                        <span className="w-40 truncate">{list.title}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full rounded bg-primary/60"
                            style={{ width: `${(total / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums">{total}</span>
                        {ovd > 0 && <span className="text-danger">{ovd} vencidas</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {byAssignee.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Carga por responsable
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {byAssignee.map((a) => (
                      <span
                        key={a.name}
                        className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
                      >
                        {a.name}: <strong>{a.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Documentación del hub</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Objetos" value={objects.length} />
            <Metric label="Con descripción" value={`${coverage}%`} />
            <Metric label="Columnas documentadas" value={`${columnCoverage}%`} />
            <Metric label="Consultas SQL" value={snippets.length} />
          </div>

          {objectsWithoutOwner.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                <FileWarning className="h-3.5 w-3.5" /> Objetos sin responsable (
                {objectsWithoutOwner.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {objectsWithoutOwner.slice(0, 20).map((o) => (
                  <Link
                    key={o.id}
                    href={`/knowledge/objects/${o.id}`}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] hover:border-ring/40"
                  >
                    {displayObjectName(o.schema_name, o.object_name)}
                  </Link>
                ))}
                {objectsWithoutOwner.length > 20 && (
                  <span className="self-center text-[11px] text-muted-foreground">
                    +{objectsWithoutOwner.length - 20}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <Link href="/boards">
            <Button variant="outline" size="sm">
              Ir a tableros
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className={cn("text-2xl font-semibold", tone === "danger" && "text-danger")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
