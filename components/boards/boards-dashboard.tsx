"use client";

import { CreateBoardDialog } from "@/components/boards/create-board-dialog";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  KanbanSquare,
  LayoutGrid,
  MoreHorizontal,
  Pause,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface BoardRow extends Board {
  board_members: { count: number }[];
  cards: { count: number }[];
}

export function BoardsDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(searchParams.get("new") === "1");
  const [renaming, setRenaming] = useState<Board | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("boards")
      .select("*, board_members(count), cards(count)")
      .order("updated_at", { ascending: false });
    setBoards((data as BoardRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => load());
    const channel = supabase
      .channel("dashboard-boards")
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  async function deleteBoard(board: Board) {
    if (
      !confirm(`¿Eliminar el tablero "${board.title}"? Esta acción no se puede deshacer.`)
    )
      return;
    setBusy(true);
    await supabase.from("boards").delete().eq("id", board.id);
    setBusy(false);
    load();
  }

  async function renameBoard() {
    if (!renaming || !newTitle.trim()) return;
    setBusy(true);
    await supabase.from("boards").update({ title: newTitle.trim() }).eq("id", renaming.id);
    setBusy(false);
    setRenaming(null);
    setNewTitle("");
    load();
    router.refresh();
  }

  async function togglePause(board: Board) {
    await supabase
      .from("boards")
      .update({ is_paused: !board.is_paused })
      .eq("id", board.id);
    load();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mis tableros</h1>
            <p className="text-sm text-muted-foreground">
              Organiza tus proyectos con tableros kanban
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nuevo tablero
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KanbanSquare className="h-7 w-7" />
            </span>
            <h2 className="text-lg font-semibold">Crea tu primer tablero</h2>
            <p className="mt-1 mb-5 max-w-sm text-sm text-muted-foreground">
              Los tableros te permiten organizar tareas en columnas y arrastrarlas
              según su estado.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Nuevo tablero
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => {
              const isOwner = board.owner_id === user?.id;
              const memberCount = board.board_members?.[0]?.count ?? 0;
              const cardCount = board.cards?.[0]?.count ?? 0;
              return (
                <div
                  key={board.id}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-lg"
                >
                  <Link
                    href={`/boards/${board.id}`}
                    className="absolute inset-0 rounded-2xl"
                    aria-label={board.title}
                  />
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        board.is_paused
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <LayoutGrid className="h-5 w-5" />
                    </span>
                    <div className="relative z-10">
                      <Dropdown
                        trigger={
                          <button className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      >
                        {(close) => (
                          <div>
                            <DropdownItem
                              onClick={() => {
                                close();
                                setRenaming(board);
                                setNewTitle(board.title);
                              }}
                            >
                              <Pencil className="h-4 w-4" /> Renombrar
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => {
                                close();
                                togglePause(board);
                              }}
                            >
                              <Pause className="h-4 w-4" />
                              {board.is_paused ? "Reanudar" : "Pausar"}
                            </DropdownItem>
                            {isOwner && (
                              <DropdownItem
                                danger
                                onClick={() => {
                                  close();
                                  deleteBoard(board);
                                }}
                              >
                                <Trash2 className="h-4 w-4" /> Eliminar
                              </DropdownItem>
                            )}
                          </div>
                        )}
                      </Dropdown>
                    </div>
                  </div>

                  <h3 className="truncate font-semibold">{board.title}</h3>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                    {board.description || "Sin descripción"}
                  </p>

                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {memberCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <LayoutGrid className="h-3.5 w-3.5" /> {cardCount} cards
                    </span>
                    {board.is_paused && (
                      <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                        <Pause className="h-3 w-3" /> Pausado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateBoardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Renombrar tablero">
        <div className="flex flex-col gap-4">
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button onClick={renameBoard} disabled={busy}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
