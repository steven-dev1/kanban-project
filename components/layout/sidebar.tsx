"use client";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  Code2,
  ChevronDown,
  FileCode2,
  GitPullRequest,
  History,
  Home,
  KanbanSquare,
  LayoutDashboard,
  MessageSquare,
  Package,
  Pause,
  Plus,
  Search,
  Server,
  Settings,
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

interface KnowledgeLink {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}

/**
 * El menú de Knowledge se agrupa por intención para que sea más intuitivo:
 * primero lo que se consulta, luego lo que se descubre (lo propio) y por
 * último lo que se comparte.
 */
const KNOWLEDGE_GROUPS: { title: string; links: KnowledgeLink[] }[] = [
  {
    title: "Explorar",
    links: [
      { href: "/knowledge", label: "Resumen", icon: Home, exact: true },
      { href: "/knowledge/tables", label: "Tablas y vistas", icon: Table2 },
      { href: "/knowledge/procedures", label: "Procedures", icon: Code2 },
      { href: "/knowledge/functions", label: "Functions", icon: Sigma },
      { href: "/knowledge/packages", label: "Packages", icon: Package },
      { href: "/knowledge/sql", label: "Consultas SQL", icon: FileCode2 },
    ],
  },
  {
    title: "Descubrir",
    links: [
      { href: "/knowledge/search", label: "Búsqueda global", icon: Search },
      { href: "/knowledge/favorites", label: "Favoritos", icon: Star },
      { href: "/knowledge/recent", label: "Recientes", icon: History },
      { href: "/knowledge/environments", label: "Ambientes", icon: Server },
      { href: "/knowledge/history", label: "Historial", icon: History },
    ],
  },
  {
    title: "Colaborar",
    links: [{ href: "/knowledge/pull-requests", label: "Pull Requests", icon: GitPullRequest }],
  },
];

const KNOWLEDGE_LINKS: KnowledgeLink[] = KNOWLEDGE_GROUPS.flatMap((group) => group.links);

const GLOBAL_LINKS = [
  { href: "/reports", label: "Informes", icon: BarChart3 },
  { href: "/notifications", label: "Notificaciones", icon: Bell },
  { href: "/messages", label: "Mensajes", icon: MessageSquare },
  { href: "/settings", label: "Perfil y ajustes", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function Sidebar({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const supabase = createClient();
  const pathname = usePathname();
  const [boards, setBoards] = useState<BoardLink[]>([]);

  const inKnowledge = pathname.startsWith("/knowledge");
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const knowledgeOpen = collapsed ? true : (manualOpen ?? inKnowledge);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const itemClass = cn(
    "group relative flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-muted",
    collapsed && "justify-center",
  );

  const tooltipClass =
    "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground opacity-0 shadow-lg ring-1 ring-black/5 transition-opacity group-hover:opacity-100 dark:ring-white/5";

  const renderLabel = (label: string) =>
    collapsed ? <span className={tooltipClass}>{label}</span> : <span className="truncate">{label}</span>;

  return (
    <nav className={cn("flex h-full flex-col gap-1 overflow-y-auto overflow-x-visible", collapsed ? "p-2" : "p-3")}>
      <Link href="/boards" onClick={onNavigate} className={cn(itemClass, pathname === "/boards" && "bg-muted")}>
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        {renderLabel("Mis tableros")}
      </Link>

      {collapsed ? (
        <>
          {KNOWLEDGE_LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(itemClass, active && "bg-primary/10 text-primary")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {renderLabel(link.label)}
              </Link>
            );
          })}
        </>
      ) : (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setManualOpen(!knowledgeOpen)}
            className={cn(itemClass, "w-full", inKnowledge && "bg-muted")}
          >
            <Table2 className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-left">Diccionario de Datos</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                !knowledgeOpen && "-rotate-90",
              )}
            />
          </button>
          {knowledgeOpen && (
            <div className="mt-0.5 ml-3 space-y-2 border-l border-border pl-2 pb-1">
              {KNOWLEDGE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-0.5">
                  <p className="px-2.5 pt-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </p>
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(pathname, link.href, link.exact);
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
              ))}
            </div>
          )}
        </div>
      )}

      {!collapsed && (
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
      )}

      <div className={cn("flex-1 space-y-0.5", !collapsed && "mt-1")}>
        {boards.length === 0 && !collapsed && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Aún no tienes tableros</p>
        )}
        {boards.map((board) => {
          const active = pathname.startsWith(`/boards/${board.id}`);
          return (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted",
                collapsed && "justify-center",
                active && "bg-primary/10 text-primary",
              )}
            >
              <KanbanSquare className="h-4 w-4 shrink-0" />
              {collapsed ? (
                <span className={tooltipClass}>{board.title}</span>
              ) : (
                <>
                  <span className="flex-1 truncate">{board.title}</span>
                  {board.is_paused && <Pause className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </>
              )}
            </Link>
          );
        })}
      </div>

      <div className={cn("space-y-0.5 border-t border-border pt-2", "mt-2")}>
        {GLOBAL_LINKS.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(itemClass, active && "bg-primary/10 text-primary")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {renderLabel(link.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
