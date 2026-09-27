"use client";

import { Skeleton } from "@/components/knowledge/ui";
import { useRecent } from "@/lib/knowledge/recent";
import { useKnowledge } from "@/providers/knowledge-provider";
import {
  Code2,
  FileCode2,
  History,
  Package,
  Search,
  Sigma,
  Star,
  Table2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export function KnowledgeDashboard() {
  const { objects, snippets, loading } = useKnowledge();
  const recent = useRecent();

  const stats = useMemo(() => {
    const count = (type: string) => objects.filter((o) => o.object_type === type).length;
    return {
      tables: count("TABLE"),
      views: count("VIEW"),
      sql: snippets.length,
      procedures: count("PROCEDURE"),
      functions: count("FUNCTION"),
      packages: count("PACKAGE"),
    };
  }, [objects, snippets]);

  const cards = [
    { label: "Tablas", value: stats.tables, icon: Table2, href: "/knowledge/tables" },
    { label: "Vistas", value: stats.views, icon: Eye, href: "/knowledge/tables" },
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

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/knowledge/search"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" /> Búsqueda global
          </Link>
          <Link
            href="/knowledge/recent"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <History className="h-3.5 w-3.5 text-muted-foreground" /> Recientes
          </Link>
          <Link
            href="/knowledge/favorites"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <Star className="h-3.5 w-3.5 text-muted-foreground" /> Favoritos
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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

        {recent.length > 0 && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Vistos por ti</h3>
              <Link href="/knowledge/recent" className="text-xs text-primary hover:underline">
                Ver recientes
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.slice(0, 10).map((entry) => (
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


