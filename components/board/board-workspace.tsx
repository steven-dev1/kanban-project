"use client";

import { ArchivePanel } from "@/components/board/archive-panel";
import { CardDialog } from "@/components/board/card-dialog";
import { ChartsView } from "@/components/board/charts-view";
import { KanbanView } from "@/components/board/kanban-view";
import { MembersDialog } from "@/components/board/members-dialog";
import { TableView } from "@/components/board/table-view";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  KanbanSquare,
  Lock,
  Pause,
  Play,
  Table2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type View = "kanban" | "table" | "charts";

export function BoardWorkspace() {
  const { board, loading, loadError, isAdmin, togglePause, archivedCards, archivedLists } =
    useBoard();
  const { toast } = useToast();
  const [view, setView] = useState<View>("kanban");
  const [cardId, setCardId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="flex flex-1 gap-3 overflow-hidden p-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-72 shrink-0 space-y-2 rounded-2xl border border-border bg-muted/40 p-3"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-16 animate-pulse rounded-xl bg-card" />
              <div className="h-16 animate-pulse rounded-xl bg-card" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">No tienes acceso a este tablero.</p>
        <Link href="/boards">
          <Button variant="outline">Volver a mis tableros</Button>
        </Link>
      </div>
    );
  }

  const views: { id: View; label: string; icon: typeof KanbanSquare }[] = [
    { id: "kanban", label: "Kanban", icon: KanbanSquare },
    { id: "table", label: "Tabla", icon: Table2 },
    { id: "charts", label: "Gráficos", icon: BarChart3 },
  ];

  const archivedCount = archivedCards.length + archivedLists.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{board.title}</h1>
            {board.is_paused && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" /> Pausado
              </span>
            )}
          </div>
          {board.description && (
            <p className="truncate text-xs text-muted-foreground">{board.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
            {views.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  view === id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Miembros</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Archivados</span>
            {archivedCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px]">
                {archivedCount}
              </span>
            )}
          </Button>

          {isAdmin && (
            <Button
              variant={board.is_paused ? "primary" : "outline"}
              size="sm"
              onClick={() => {
                togglePause();
                toast(board.is_paused ? "Tablero reanudado" : "Tablero pausado");
              }}
            >
              {board.is_paused ? (
                <>
                  <Play className="h-4 w-4" /> Reanudar
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" /> Pausar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {board.is_paused && (
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" />
          Este tablero está pausado. Solo puedes visualizarlo
          {isAdmin ? "; reanúdalo para volver a editar." : "."}
        </div>
      )}

      {loadError && (
        <div className="flex items-start gap-2 border-b border-danger/20 bg-danger/10 px-4 py-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No se pudieron cargar algunos datos: {loadError}
            <br />
            Si acabas de actualizar la app, ejecuta el archivo{" "}
            <code>supabase/schema.sql</code> en el SQL Editor de Supabase.
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {view === "kanban" && <KanbanView onCardClick={(c) => setCardId(c.id)} />}
        {view === "table" && <TableView onCardClick={(c) => setCardId(c.id)} />}
        {view === "charts" && <ChartsView />}
      </div>

      <CardDialog cardId={cardId} onClose={() => setCardId(null)} />
      <MembersDialog open={membersOpen} onClose={() => setMembersOpen(false)} />
      <ArchivePanel open={archiveOpen} onClose={() => setArchiveOpen(false)} />
    </div>
  );
}
