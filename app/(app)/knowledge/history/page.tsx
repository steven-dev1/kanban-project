"use client";

import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { KnowledgeActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const ALL = "__all__";

const ENTITY_LABELS: Record<string, string> = {
  oracle_objects: "Objeto",
  oracle_columns: "Columna",
  oracle_column_values: "Valor",
  oracle_code_versions: "Versión de código",
  oracle_arguments: "Argumento",
  object_relations: "Relación",
  sql_snippets: "Consulta SQL",
  sql_snippet_parameters: "Parámetro SQL",
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Creó",
  UPDATE: "Editó",
  DELETE: "Eliminó",
};

export default function KnowledgeHistoryPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const [items, setItems] = useState<KnowledgeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState(ALL);
  const [action, setAction] = useState(ALL);

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("knowledge_activity")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as KnowledgeActivity[]) ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    queueMicrotask(() => load());
    if (!userId) return;
    const channel = supabase
      .channel(`activity-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "knowledge_activity", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const entityOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.entity));
    return Array.from(set).sort();
  }, [items]);

  const filtered = items.filter((i) => {
    if (entity !== ALL && i.entity !== entity) return false;
    if (action !== ALL && i.action !== action) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <h1 className="text-lg font-semibold">Historial de cambios</h1>
        <p className="text-sm text-muted-foreground">
          Registro de lo que has creado, editado o eliminado en el diccionario.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="w-48">
            <Select
              value={entity}
              onChange={setEntity}
              options={[
                { value: ALL, label: "Todo tipo de entidad" },
                ...entityOptions.map((e) => ({ value: e, label: ENTITY_LABELS[e] ?? e })),
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={action}
              onChange={setAction}
              options={[
                { value: ALL, label: "Todas las acciones" },
                { value: "INSERT", label: "Creaciones" },
                { value: "UPDATE", label: "Ediciones" },
                { value: "DELETE", label: "Eliminaciones" },
              ]}
            />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
            <History className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((item) => {
              const Icon =
                item.action === "INSERT" ? Plus : item.action === "DELETE" ? Trash2 : Pencil;
              const color =
                item.action === "INSERT"
                  ? "text-green-600 dark:text-green-400"
                  : item.action === "DELETE"
                    ? "text-danger"
                    : "text-amber-600 dark:text-amber-400";
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{ACTION_LABELS[item.action] ?? item.action}</span>{" "}
                      <span className="text-muted-foreground">
                        {ENTITY_LABELS[item.entity] ?? item.entity}
                      </span>{" "}
                      {item.label && <span className="font-mono text-xs">{item.label}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
