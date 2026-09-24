"use client";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { KanbanSquare, LayoutDashboard, Pause, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface BoardLink {
  id: string;
  title: string;
  is_paused: boolean;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [boards, setBoards] = useState<BoardLink[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("boards")
      .select("id,title,is_paused")
      .order("updated_at", { ascending: false });
    setBoards((data as BoardLink[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => load());
    const channel = supabase
      .channel("sidebar-boards")
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, load)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_members" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link
        href="/boards"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
          pathname === "/boards" && "bg-muted",
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        Mis tableros
      </Link>

      <div className="mt-3 flex items-center justify-between px-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Tableros
        </span>
        <Link
          href="/boards?new=1"
          onClick={onNavigate}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Nuevo tablero"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto">
        {boards.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Aún no tienes tableros
          </p>
        )}
        {boards.map((board) => {
          const active = pathname.startsWith(`/boards/${board.id}`);
          return (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                active && "bg-primary/10 text-primary",
              )}
            >
              <KanbanSquare className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{board.title}</span>
              {board.is_paused && (
                <Pause className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
