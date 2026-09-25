"use client";

import { ObjectTypeBadge, SectionTitle, Skeleton } from "@/components/knowledge/ui";
import { formatDate } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import Link from "next/link";
import { useMemo } from "react";

export function FavoritesView() {
  const { objects, snippets, loading } = useKnowledge();

  const favoriteObjects = useMemo(
    () => objects.filter((o) => o.is_favorite),
    [objects],
  );
  const favoriteSnippets = useMemo(
    () => snippets.filter((s) => s.is_favorite),
    [snippets],
  );

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
          <h1 className="text-lg font-semibold">Favoritos</h1>
          <p className="text-sm text-muted-foreground">
            Objetos y consultas marcadas para acceso rápido.
          </p>
        </div>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <SectionTitle title="Objetos" description={`${favoriteObjects.length} objeto(s).`} />
          {favoriteObjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Marca objetos con ★ para verlos aquí.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {favoriteObjects.map((object) => (
                <li key={object.id}>
                  <Link
                    href={`/knowledge/objects/${object.id}`}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <ObjectTypeBadge type={object.object_type} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {object.schema_name}.{object.object_name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDate(object.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <SectionTitle title="Consultas SQL" description={`${favoriteSnippets.length} consulta(s).`} />
          {favoriteSnippets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Marca consultas con ★ para verlas aquí.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {favoriteSnippets.map((snippet) => (
                <li key={snippet.id}>
                  <Link
                    href={`/knowledge/sql/${snippet.id}`}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      SQL
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {snippet.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDate(snippet.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
