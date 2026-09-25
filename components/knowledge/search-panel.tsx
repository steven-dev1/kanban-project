"use client";

import { ObjectTypeBadge, Skeleton } from "@/components/knowledge/ui";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ENVIRONMENTS } from "@/lib/knowledge/constants";
import { cn } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { Database, FileCode2, Hash, Search as SearchIcon, Tag as TagIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const ALL = "__all__";

type ResultKind =
  | "TABLE"
  | "VIEW"
  | "PROCEDURE"
  | "FUNCTION"
  | "PACKAGE"
  | "TRIGGER"
  | "SEQUENCE"
  | "SYNONYM"
  | "MATERIALIZED_VIEW"
  | "COLUMN"
  | "VALUE"
  | "SQL";

interface ResultItem {
  key: string;
  kind: ResultKind;
  name: string;
  context: string;
  description: string | null;
  href: string;
}

const KIND_LABELS: Record<ResultKind, string> = {
  TABLE: "TABLE",
  VIEW: "VIEW",
  PROCEDURE: "PROCEDURE",
  FUNCTION: "FUNCTION",
  PACKAGE: "PACKAGE",
  TRIGGER: "TRIGGER",
  SEQUENCE: "SEQUENCE",
  SYNONYM: "SYNONYM",
  MATERIALIZED_VIEW: "MVIEW",
  COLUMN: "COLUMN",
  VALUE: "VALUE",
  SQL: "SQL",
};

export function SearchPanel({ initialQuery = "" }: { initialQuery?: string }) {
  const { objects, snippets, tags, loading } = useKnowledge();
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState(ALL);
  const [schema, setSchema] = useState(ALL);
  const [environment, setEnvironment] = useState(ALL);
  const [module, setModule] = useState(ALL);
  const [tagId, setTagId] = useState(ALL);

  const schemas = useMemo(
    () => Array.from(new Set(objects.map((o) => o.schema_name))).sort(),
    [objects],
  );
  const modules = useMemo(
    () => Array.from(new Set(objects.map((o) => o.module).filter(Boolean))) as string[],
    [objects],
  );

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: ResultItem[] = [];
    const matches = (values: (string | null | undefined)[]) =>
      q.length === 0 || values.some((v) => (v ?? "").toLowerCase().includes(q));

    for (const object of objects) {
      if (schema !== ALL && object.schema_name !== schema) continue;
      if (module !== ALL && object.module !== module) continue;
      if (environment !== ALL && !object.environments.some((e) => e.environment === environment))
        continue;
      if (tagId !== ALL && !object.tags.some((t) => t.id === tagId)) continue;

      if (
        matches([
          object.object_name,
          object.schema_name,
          object.description,
          object.functional_description,
          object.notes,
        ])
      ) {
        items.push({
          key: `obj-${object.id}`,
          kind: object.object_type,
          name: object.object_name,
          context: object.schema_name,
          description: object.description ?? object.functional_description ?? null,
          href: `/knowledge/objects/${object.id}`,
        });
      }

      for (const column of object.columns) {
        if (
          matches([
            column.column_name,
            column.description,
            column.business_meaning,
            column.notes,
          ])
        ) {
          items.push({
            key: `col-${column.id}`,
            kind: "COLUMN",
            name: column.column_name,
            context: `${object.schema_name}.${object.object_name}`,
            description: column.description ?? column.business_meaning ?? null,
            href: `/knowledge/objects/${object.id}`,
          });
        }
        for (const value of column.values) {
          if (matches([value.value, value.meaning, value.notes])) {
            items.push({
              key: `val-${value.id}`,
              kind: "VALUE",
              name: value.value,
              context: `${object.object_name}.${column.column_name}`,
              description: value.meaning ?? null,
              href: `/knowledge/objects/${object.id}`,
            });
          }
        }
      }
    }

    for (const snippet of snippets) {
      if (environment !== ALL && snippet.environment !== environment) continue;
      if (schema !== ALL && snippet.schema_name !== schema) continue;
      if (tagId !== ALL && !snippet.tags.some((t) => t.id === tagId)) continue;
      if (
        matches([snippet.title, snippet.description, snippet.sql_code, snippet.notes, snippet.warnings])
      ) {
        items.push({
          key: `sql-${snippet.id}`,
          kind: "SQL",
          name: snippet.title,
          context: snippet.schema_name ?? snippet.category,
          description: snippet.description ?? null,
          href: `/knowledge/sql/${snippet.id}`,
        });
      }
    }

    const filtered = kind === ALL ? items : items.filter((i) => i.kind === kind);
    return filtered.slice(0, 200);
  }, [objects, snippets, query, kind, schema, environment, module, tagId]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <h1 className="text-lg font-semibold">Búsqueda global</h1>
        <p className="text-sm text-muted-foreground">
          Busca en tablas, vistas, columnas, valores, SQL, procedures, functions y packages.
        </p>

        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: kms, VG_TIQUETES, cierre contable, ROWID…"
            className="h-11 pl-9 text-sm"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="w-40">
            <Select
              value={kind}
              onChange={setKind}
              options={[
                { value: ALL, label: "Todos los tipos" },
                ...Object.keys(KIND_LABELS).map((k) => ({ value: k, label: KIND_LABELS[k as ResultKind] })),
              ]}
            />
          </div>
          <div className="w-36">
            <Select
              value={schema}
              onChange={setSchema}
              options={[
                { value: ALL, label: "Todos los schemas" },
                ...schemas.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
          {modules.length > 0 && (
            <div className="w-36">
              <Select
                value={module}
                onChange={setModule}
                options={[
                  { value: ALL, label: "Módulos" },
                  ...modules.map((m) => ({ value: m, label: m })),
                ]}
              />
            </div>
          )}
          <div className="w-40">
            <Select
              value={environment}
              onChange={setEnvironment}
              options={[
                { value: ALL, label: "Ambientes" },
                ...ENVIRONMENTS.map((e) => ({ value: e, label: e })),
              ]}
            />
          </div>
          {tags.length > 0 && (
            <div className="w-40">
              <Select
                value={tagId}
                onChange={setTagId}
                options={[
                  { value: ALL, label: "Etiquetas" },
                  ...tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
                ]}
              />
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {query.trim()
              ? `Sin resultados para "${query}".`
              : "Escribe para buscar en todo el conocimiento técnico."}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {results.length} resultado(s){results.length === 200 ? " (limitado a 200)" : ""}
            </p>
            <ul className="space-y-1.5">
              {results.map((result) => (
                <li key={result.key}>
                  <Link
                    href={result.href}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-ring/40 hover:bg-muted/40"
                  >
                    <ResultIcon kind={result.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm font-medium">{result.name}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                            "bg-muted text-muted-foreground",
                          )}
                        >
                          {KIND_LABELS[result.kind]}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {result.context}
                        {result.description ? ` · ${result.description}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function ResultIcon({ kind }: { kind: ResultKind }) {
  const className = "h-4 w-4 shrink-0 text-muted-foreground";
  if (kind === "COLUMN") return <Hash className={className} />;
  if (kind === "VALUE") return <TagIcon className={className} />;
  if (kind === "SQL") return <FileCode2 className={className} />;
  if (kind === "TABLE" || kind === "VIEW") return <Database className={className} />;
  return <ObjectTypeBadge type={kind} />;
}
