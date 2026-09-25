"use client";

import { ObjectTypeBadge, SectionTitle, Skeleton } from "@/components/knowledge/ui";
import { useRecent } from "@/lib/knowledge/recent";
import { formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { History } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export function RecentView() {
  const { objects, snippets, loading } = useKnowledge();
  const recent = useRecent();

  const created = useMemo(() => {
    const objectItems = objects.map((o) => ({
      id: o.id,
      name: `${o.schema_name}.${o.object_name}`,
      href: `/knowledge/objects/${o.id}`,
      type: o.object_type as string,
      at: o.created_at,
    }));
    const snippetItems = snippets.map((s) => ({
      id: s.id,
      name: s.title,
      href: `/knowledge/sql/${s.id}`,
      type: "SQL",
      at: s.created_at,
    }));
    return [...objectItems, ...snippetItems]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10);
  }, [objects, snippets]);

  const updated = useMemo(() => {
    const objectItems = objects.map((o) => ({
      id: o.id,
      name: `${o.schema_name}.${o.object_name}`,
      href: `/knowledge/objects/${o.id}`,
      type: o.object_type as string,
      at: o.updated_at,
    }));
    const snippetItems = snippets.map((s) => ({
      id: s.id,
      name: s.title,
      href: `/knowledge/sql/${s.id}`,
      type: "SQL",
      at: s.updated_at,
    }));
    return [...objectItems, ...snippetItems]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10);
  }, [objects, snippets]);

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-lg font-semibold">Recientes</h1>
          <p className="text-sm text-muted-foreground">
            Elementos vistos, creados y editados recientemente.
          </p>
        </div>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <SectionTitle title="Vistos por ti" description="Tu historial de lectura reciente." />
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no has abierto elementos.</p>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((entry) => (
                <li key={`${entry.kind}-${entry.id}`}>
                  <Link
                    href={entry.href}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {entry.kind === "object" ? "Objeto" : "SQL"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <ItemList title="Creados recientemente" items={created} />
          <ItemList title="Última actualización" items={updated} />
        </div>
      </div>
    </div>
  );
}

function ItemList({
  title,
  items,
}: {
  title: string;
  items: { id: string; name: string; href: string; type: string; at: string }[];
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin datos.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
              >
                {["TABLE", "VIEW", "PROCEDURE", "FUNCTION", "PACKAGE", "TRIGGER"].includes(
                  item.type,
                ) ? (
                  <ObjectTypeBadge type={item.type as "TABLE"} />
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    SQL
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatDate(item.at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
