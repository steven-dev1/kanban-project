"use client";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Code2,
  Columns3,
  ChevronDown,
  FileCode2,
  History,
  Home,
  KanbanSquare,
  LayoutDashboard,
  Package,
  Pause,
  Plus,
  Server,
  Sigma,
  Star,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface BoardLink {
  id: string;
  title: string;
  is_paused: boolean;
}

const KNOWLEDGE_LINKS = [
  { href: "/knowledge", label: "Inicio", icon: Home, exact: true },
  { href: "/knowledge/tables", label: "Tablas y vistas", icon: Table2 },
  { href: "/knowledge/columns", label: "Columnas", icon: Columns3 },
  { href: "/knowledge/sql", label: "Consultas SQL", icon: FileCode2 },
  { href: "/knowledge/procedures", label: "Procedures", icon: Code2 },
  { href: "/knowledge/functions", label: "Functions", icon: Sigma },
  { href: "/knowledge/packages", label: "Packages", icon: Package },
  { href: "/knowledge/favorites", label: "Favoritos", icon: Star },
  { href: "/knowledge/recent", label: "Recientes", icon: History },
  { href: "/knowledge/environments", label: "Ambientes", icon: Server },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [boards, setBoards] = useState<BoardLink[]>([]);

  const inKnowledge = pathname.startsWith("/knowledge");
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const knowledgeOpen = manualOpen ?? inKnowledge;

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
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
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

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setManualOpen(!knowledgeOpen)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
            inKnowledge && "bg-muted",
          )}
        >
          <Table2 className="h-4 w-4" />
          <span className="flex-1 text-left">Diccionario de Datos</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              !knowledgeOpen && "-rotate-90",
            )}
          />
        </button>
        {knowledgeOpen && (
          <div className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-2">
            {KNOWLEDGE_LINKS.map((link) => {
              const Icon = link.icon;
              const active = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                    active && "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

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

      <div className="mt-1 flex-1 space-y-0.5">
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
