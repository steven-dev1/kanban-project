"use client";

import { EmptyState, ObjectTypeBadge, Skeleton } from "@/components/knowledge/ui";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useKnowledge } from "@/providers/knowledge-provider";
import { Columns3, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const ALL = "__all__";

export function ColumnsCatalog() {
  const { objects, loading } = useKnowledge();
  const [query, setQuery] = useState("");
  const [schema, setSchema] = useState(ALL);
  const [type, setType] = useState(ALL);

  const flat = useMemo(
    () =>
      objects
        .filter((o) => o.object_type === "TABLE" || o.object_type === "VIEW")
        .flatMap((object) =>
          object.columns.map((column) => ({
            column,
            object,
          })),
        ),
    [objects],
  );

  const schemas = useMemo(
    () => Array.from(new Set(flat.map((item) => item.object.schema_name))).sort(),
    [flat],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flat.filter(({ column, object }) => {
      if (schema !== ALL && object.schema_name !== schema) return false;
      if (type !== ALL && object.object_type !== type) return false;
      if (!q) return true;
      return (
        column.column_name.toLowerCase().includes(q) ||
        (column.description ?? "").toLowerCase().includes(q) ||
        (column.business_meaning ?? "").toLowerCase().includes(q) ||
        object.object_name.toLowerCase().includes(q)
      );
    });
  }, [flat, query, schema, type]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <h1 className="text-lg font-semibold">Diccionario de columnas</h1>
        <p className="text-sm text-muted-foreground">
          {flat.length} columnas documentadas en tablas y vistas.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar columna, descripción o significado…"
              className="pl-8"
            />
          </div>
          <div className="w-40">
            <Select
              value={schema}
              onChange={setSchema}
              options={[
                { value: ALL, label: "Todos los schemas" },
                ...schemas.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
          <div className="w-36">
            <Select
              value={type}
              onChange={setType}
              options={[
                { value: ALL, label: "Tablas y vistas" },
                { value: "TABLE", label: "Solo tablas" },
                { value: "VIEW", label: "Solo vistas" },
              ]}
            />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Columns3 className="h-6 w-6" />}
            title="Sin columnas"
            description="Documenta columnas dentro de cada tabla o vista."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Columna</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Objeto</th>
                  <th className="px-3 py-2 font-medium">Nullable</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Descripción</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Valores</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ column, object }) => (
                  <tr key={column.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-mono text-xs font-medium">
                      {column.column_name}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {[column.data_type, column.data_length ? `(${column.data_length})` : ""]
                        .filter(Boolean)
                        .join("") || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/knowledge/objects/${object.id}`}
                        className="flex items-center gap-2 font-mono text-xs hover:text-primary"
                      >
                        <ObjectTypeBadge type={object.object_type} />
                        <span className="truncate">
                          {object.schema_name}.{object.object_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {column.nullable ? "Sí" : "No"}
                    </td>
                    <td className="hidden max-w-[280px] px-3 py-2.5 text-xs text-muted-foreground lg:table-cell">
                      <span className="line-clamp-1">
                        {column.description || column.business_meaning || "—"}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell">
                      {column.values.length || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
