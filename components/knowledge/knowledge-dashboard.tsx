"use client";

import { ObjectTypeBadge, SectionTitle, Skeleton } from "@/components/knowledge/ui";
import { Input } from "@/components/ui/input";
import { useRecent } from "@/lib/knowledge/recent";
import { cn, formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import {
  Code2,
  Columns3,
  Database,
  FileCode2,
  Package,
  Sigma,
  Star,
  Table2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function KnowledgeDashboard() {
  const { objects, snippets, loading } = useKnowledge();
  const recent = useRecent();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const count = (type: string) => objects.filter((o) => o.object_type === type).length;
    return {
      tables: count("TABLE"),
      views: count("VIEW"),
      columns: objects.reduce((acc, o) => acc + o.columns.length, 0),
      sql: snippets.length,
      procedures: count("PROCEDURE"),
      functions: count("FUNCTION"),
      packages: count("PACKAGE"),
    };
  }, [objects, snippets]);

  const favorites = useMemo(() => {
    const objectFavorites = objects
      .filter((o) => o.is_favorite)
      .map((o) => ({
        id: o.id,
        name: `${o.schema_name}.${o.object_name}`,
        href: `/knowledge/objects/${o.id}`,
        type: o.object_type as string,
        updated_at: o.updated_at,
      }));
    const snippetFavorites = snippets
      .filter((s) => s.is_favorite)
      .map((s) => ({
        id: s.id,
        name: s.title,
        href: `/knowledge/sql/${s.id}`,
        type: "SQL",
        updated_at: s.updated_at,
      }));
    return [...objectFavorites, ...snippetFavorites].slice(0, 6);
  }, [objects, snippets]);

  const recentlyUpdated = useMemo(() => {
    const objectItems = objects.map((o) => ({
      id: o.id,
      name: `${o.schema_name}.${o.object_name}`,
      href: `/knowledge/objects/${o.id}`,
      type: o.object_type as string,
      updated_at: o.updated_at,
    }));
    const snippetItems = snippets.map((s) => ({
      id: s.id,
      name: s.title,
      href: `/knowledge/sql/${s.id}`,
      type: "SQL",
      updated_at: s.updated_at,
    }));
    return [...objectItems, ...snippetItems]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 6);
  }, [objects, snippets]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/knowledge/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  const cards = [
    { label: "Tablas", value: stats.tables, icon: Table2, href: "/knowledge/tables" },
    { label: "Vistas", value: stats.views, icon: Eye, href: "/knowledge/tables" },
    { label: "Columnas", value: stats.columns, icon: Columns3, href: "/knowledge/columns" },
    { label: "Consultas SQL", value: stats.sql, icon: FileCode2, href: "/knowledge/sql" },
    { label: "Procedures", value: stats.procedures, icon: Code2, href: "/knowledge/procedures" },
    { label: "Functions", value: stats.functions, icon: Sigma, href: "/knowledge/functions" },
    { label: "Packages", value: stats.packages, icon: Package, href: "/knowledge/packages" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Oracle Knowledge Hub</h1>
          <p className="text-sm text-muted-foreground">
            Diccionario de datos y repositorio técnico de Oracle y PL/SQL.
          </p>
        </div>

        <form onSubmit={submitSearch} className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔎 Buscar tablas, columnas, SQL, procedures, packages…"
            className="h-12 text-sm"
          />
        </form>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-ring/40 hover:bg-muted/40"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </Link>
              );
            })}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <SectionTitle
              title="Favoritos"
              description="Objetos y consultas marcadas con estrella."
              action={
                <Link href="/knowledge/favorites" className="text-xs text-primary hover:underline">
                  Ver todos
                </Link>
              }
            />
            {favorites.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aún no hay favoritos.</p>
            ) : (
              <ul className="space-y-1.5">
                {favorites.map((item) => (
                  <ListItem key={`${item.type}-${item.id}`} item={item} starred />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <SectionTitle
              title="Actualizados recientemente"
              description="Últimos objetos y consultas modificados."
              action={
                <Link href="/knowledge/recent" className="text-xs text-primary hover:underline">
                  Ver recientes
                </Link>
              }
            />
            {recentlyUpdated.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin actividad todavía.</p>
            ) : (
              <ul className="space-y-1.5">
                {recentlyUpdated.map((item) => (
                  <ListItem key={`${item.type}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {recent.length > 0 && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <SectionTitle title="Vistos por ti" description="Tu actividad reciente." />
            <div className="flex flex-wrap gap-2">
              {recent.map((entry) => (
                <Link
                  key={`${entry.kind}-${entry.id}`}
                  href={entry.href}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs hover:border-ring/40"
                >
                  <span className="font-mono">{entry.label}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ListItem({
  item,
  starred,
}: {
  item: { id: string; name: string; href: string; type: string; updated_at: string };
  starred?: boolean;
}) {
  const isObjectType = ["TABLE", "VIEW", "PROCEDURE", "FUNCTION", "PACKAGE", "TRIGGER"].includes(
    item.type,
  );
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
      >
        {starred && <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="currentColor" />}
        {isObjectType ? (
          <ObjectTypeBadge type={item.type as "TABLE"} />
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            SQL
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.name}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatDate(item.updated_at)}
        </span>
      </Link>
    </li>
  );
}

export function StatPill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Database;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card px-3 py-2", className)}>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
