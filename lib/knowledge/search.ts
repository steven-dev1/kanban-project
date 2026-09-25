import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Environment,
  OracleColumn,
  OracleColumnValue,
  OracleObject,
  OracleObjectType,
  SearchResult,
  SqlSnippet,
} from "@/lib/knowledge/types";

export interface SearchFilters {
  types?: OracleObjectType[];
  schema?: string;
  environment?: Environment;
  module?: string;
  tagId?: string;
  limit?: number;
}

interface MinimalObject {
  id: string;
  schema_name: string;
  object_name: string;
  object_type: OracleObjectType;
}

const escapeLike = (term: string) => term.replace(/[%_\\]/g, (m) => `\\${m}`);

function fieldScore(term: string, value: string | null | undefined, weight: number) {
  if (!value) return 0;
  const haystack = value.toLowerCase();
  const needle = term.toLowerCase();
  if (haystack === needle) return 100 * weight;
  if (haystack.startsWith(needle)) return 70 * weight;
  if (haystack.includes(needle)) return 40 * weight;
  return 0;
}

function bestScore(
  term: string,
  fields: [string, string | null | undefined, number][],
): { score: number; field?: string } {
  let score = 0;
  let field: string | undefined;
  for (const [name, value, weight] of fields) {
    const current = fieldScore(term, value, weight);
    if (current > score) {
      score = current;
      field = name;
    }
  }
  return { score, field };
}

async function objectsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, MinimalObject>> {
  const map = new Map<string, MinimalObject>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("oracle_objects")
    .select("id,schema_name,object_name,object_type")
    .in("id", Array.from(new Set(ids)));
  for (const row of (data as MinimalObject[]) ?? []) map.set(row.id, row);
  return map;
}

/** Restringe los ids de objetos según ambiente y tag. Devuelve null si no aplica. */
async function resolveObjectIdFilter(
  supabase: SupabaseClient,
  filters: SearchFilters,
): Promise<Set<string> | null> {
  let ids: Set<string> | null = null;

  if (filters.environment) {
    const { data } = await supabase
      .from("oracle_object_environments")
      .select("object_id")
      .eq("environment", filters.environment);
    ids = new Set((data as { object_id: string }[])?.map((r) => r.object_id) ?? []);
  }

  if (filters.tagId) {
    const { data } = await supabase
      .from("knowledge_object_tags")
      .select("object_id")
      .eq("tag_id", filters.tagId);
    const tagIds = new Set(
      (data as { object_id: string }[])?.map((r) => r.object_id) ?? [],
    );
    ids = ids ? new Set([...ids].filter((id) => tagIds.has(id))) : tagIds;
  }

  return ids;
}

/**
 * Búsqueda global del Oracle Knowledge Hub.
 * Consulta objetos, columnas, valores documentados, consultas SQL, código
 * PL/SQL y tags en paralelo, y devuelve una lista normalizada y puntuada.
 */
export async function searchKnowledge(
  supabase: SupabaseClient,
  rawTerm: string,
  filters: SearchFilters = {},
): Promise<SearchResult[]> {
  const term = rawTerm.trim();
  if (!term) return [];

  const limit = filters.limit ?? 60;
  const pattern = `%${escapeLike(term)}%`;
  const idFilter = await resolveObjectIdFilter(supabase, filters);
  if (idFilter && idFilter.size === 0) return [];

  const objectQuery = supabase.from("oracle_objects").select(
    "id,schema_name,object_name,object_type,description,functional_description,module,notes",
  );

  const snippetQuery = supabase
    .from("sql_snippets")
    .select("id,title,description,sql_code,category,schema_name,environment,notes");

  const [objectsRes, columnsRes, valuesRes, snippetsRes, codeRes, tagsRes] =
    await Promise.all([
      (() => {
        let q = objectQuery.or(
          `object_name.ilike.${pattern},schema_name.ilike.${pattern},description.ilike.${pattern},functional_description.ilike.${pattern},module.ilike.${pattern},notes.ilike.${pattern}`,
        );
        if (filters.types?.length) q = q.in("object_type", filters.types);
        if (filters.schema) q = q.ilike("schema_name", filters.schema);
        if (filters.module) q = q.ilike("module", pattern);
        if (idFilter) q = q.in("id", Array.from(idFilter));
        return q.limit(limit).order("updated_at", { ascending: false });
      })(),
      supabase
        .from("oracle_columns")
        .select("id,object_id,column_name,description,business_meaning")
        .or(
          `column_name.ilike.${pattern},description.ilike.${pattern},business_meaning.ilike.${pattern}`,
        )
        .limit(limit),
      term.length >= 2
        ? supabase
            .from("oracle_column_values")
            .select("id,column_id,value,meaning")
            .eq("is_active", true)
            .or(`value.ilike.${pattern},meaning.ilike.${pattern}`)
            .limit(limit)
        : Promise.resolve({ data: [] as OracleColumnValue[] }),
      (() => {
        let q = snippetQuery.or(
          `title.ilike.${pattern},description.ilike.${pattern},sql_code.ilike.${pattern},notes.ilike.${pattern}`,
        );
        if (filters.schema) q = q.ilike("schema_name", filters.schema);
        if (filters.environment) q = q.eq("environment", filters.environment);
        return q.limit(limit).order("updated_at", { ascending: false });
      })(),
      term.length >= 3
        ? supabase
            .from("oracle_code_versions")
            .select("id,object_id,source_type,version_number,environment")
            .ilike("source_code", pattern)
            .limit(25)
        : Promise.resolve({ data: [] as { id: string; object_id: string }[] }),
      supabase.from("knowledge_tags").select("id,name,color").ilike("name", pattern).limit(10),
    ]);

  const results: SearchResult[] = [];

  // Objetos Oracle -----------------------------------------------------------
  const objects = (objectsRes.data as OracleObject[]) ?? [];
  const objectMap = new Map<string, MinimalObject>(
    objects.map((o) => ({
      id: o.id,
      schema_name: o.schema_name,
      object_name: o.object_name,
      object_type: o.object_type,
    })),
  );

  for (const object of objects) {
    const { score, field } = bestScore(term, [
      ["object_name", object.object_name, 1],
      ["schema_name", object.schema_name, 0.8],
      ["description", object.description, 0.6],
      ["functional_description", object.functional_description, 0.6],
      ["module", object.module, 0.5],
      ["notes", object.notes, 0.3],
    ]);
    if (score === 0) continue;
    results.push({
      kind: object.object_type,
      id: object.id,
      title: object.object_name,
      subtitle: `${object.schema_name}.${object.object_name}${
        object.module ? ` · ${object.module}` : ""
      }`,
      href: `/hub/objects/${object.id}`,
      matchField: field,
      score,
    });
  }

  // Columnas -----------------------------------------------------------------
  const columns = (columnsRes.data as OracleColumn[]) ?? [];
  const columnObjectMap = await objectsByIds(
    supabase,
    columns.map((c) => c.object_id),
  );
  objectMap.forEach((value, key) => {
    if (!columnObjectMap.has(key)) columnObjectMap.set(key, value);
  });

  for (const column of columns) {
    const parent = columnObjectMap.get(column.object_id);
    if (!parent) continue;
    if (filters.types?.length && !filters.types.includes(parent.object_type)) continue;
    if (filters.schema && parent.schema_name !== filters.schema) continue;
    if (idFilter && !idFilter.has(parent.id)) continue;

    const { score, field } = bestScore(term, [
      ["column_name", column.column_name, 1],
      ["description", column.description, 0.6],
      ["business_meaning", column.business_meaning, 0.7],
    ]);
    if (score === 0) continue;
    results.push({
      kind: "COLUMN",
      id: column.id,
      title: column.column_name,
      subtitle: `${parent.schema_name}.${parent.object_name}`,
      href: `/hub/columns/${column.id}`,
      matchField: field,
      score: score * 0.95,
    });
  }

  // Valores documentados -----------------------------------------------------
  const values = (valuesRes.data as OracleColumnValue[]) ?? [];
  if (values.length > 0) {
    const { data: valueColumns } = await supabase
      .from("oracle_columns")
      .select("id,object_id,column_name")
      .in(
        "id",
        values.map((v) => v.column_id),
      );
    const columnById = new Map(
      ((valueColumns as OracleColumn[]) ?? []).map((c) => [c.id, c]),
    );
    const valueObjectMap = await objectsByIds(
      supabase,
      Array.from(columnById.values()).map((c) => c.object_id),
    );

    for (const value of values) {
      const column = columnById.get(value.column_id);
      const parent = column ? valueObjectMap.get(column.object_id) : undefined;
      if (!column || !parent) continue;
      if (filters.types?.length && !filters.types.includes(parent.object_type)) continue;
      if (filters.schema && parent.schema_name !== filters.schema) continue;
      if (idFilter && !idFilter.has(parent.id)) continue;

      const { score, field } = bestScore(term, [
        ["value", value.value, 1],
        ["meaning", value.meaning, 0.8],
      ]);
      if (score === 0) continue;
      results.push({
        kind: "VALUE",
        id: value.id,
        title: `${value.value}${value.meaning ? ` → ${value.meaning}` : ""}`,
        subtitle: `${parent.schema_name}.${parent.object_name}.${column.column_name}`,
        href: `/hub/columns/${column.id}`,
        matchField: field,
        score: score * 0.9,
      });
    }
  }

  // Consultas SQL ------------------------------------------------------------
  for (const snippet of (snippetsRes.data as SqlSnippet[]) ?? []) {
    if (filters.types?.length) continue; // el filtro de tipo aplica a objetos
    const { score, field } = bestScore(term, [
      ["title", snippet.title, 1],
      ["description", snippet.description, 0.6],
      ["sql_code", snippet.sql_code, 0.5],
      ["notes", snippet.notes, 0.3],
    ]);
    if (score === 0) continue;
    results.push({
      kind: "SQL",
      id: snippet.id,
      title: snippet.title,
      subtitle: `${snippet.category}${snippet.schema_name ? ` · ${snippet.schema_name}` : ""}`,
      href: `/hub/sql/${snippet.id}`,
      matchField: field,
      score: score * 0.9,
    });
  }

  // Código PL/SQL ------------------------------------------------------------
  const codeHits =
    (codeRes.data as {
      id: string;
      object_id: string;
      source_type: string;
      version_number: number;
    }[]) ?? [];
  if (codeHits.length > 0) {
    const codeObjectMap = await objectsByIds(
      supabase,
      codeHits.map((hit) => hit.object_id),
    );
    for (const hit of codeHits) {
      const parent = codeObjectMap.get(hit.object_id);
      if (!parent) continue;
      if (filters.types?.length && !filters.types.includes(parent.object_type)) continue;
      if (idFilter && !idFilter.has(parent.id)) continue;
      results.push({
        kind: parent.object_type,
        id: hit.id,
        title: `${parent.object_name} · código (${hit.source_type} v${hit.version_number})`,
        subtitle: `${parent.schema_name}.${parent.object_name}`,
        href: `/hub/objects/${parent.id}?tab=versions`,
        matchField: "source_code",
        score: 35,
      });
    }
  }

  // Tags ---------------------------------------------------------------------
  for (const tag of (tagsRes.data as { id: string; name: string }[]) ?? []) {
    const { score } = bestScore(term, [["name", tag.name, 1]]);
    if (score === 0) continue;
    results.push({
      kind: "SQL",
      id: tag.id,
      title: `#${tag.name}`,
      subtitle: "Tag",
      href: `/hub/search?q=${encodeURIComponent(tag.name)}`,
      matchField: "tag",
      score: score * 0.5,
    });
  }

  const seen = new Set<string>();
  return results
    .filter((result) => {
      const key = `${result.kind}:${result.id}:${result.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
