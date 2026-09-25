"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  Environment,
  EnvironmentStatus,
  KnowledgeFavorite,
  KnowledgeItemType,
  KnowledgeTag,
  ObjectRelation,
  ObjectSource,
  OracleArgument,
  OracleCodeVersion,
  OracleColumn,
  OracleColumnValue,
  OracleObject,
  OracleObjectEnvironment,
  OracleObjectWithRelations,
  Profile,
  RelationType,
  SourceType,
  SqlSnippet,
  SqlSnippetParameter,
  SqlSnippetWithRelations,
  SqlSnippetTag,
  OracleObjectTag,
} from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface NewObjectInput {
  schema_name: string;
  object_name: string;
  object_type: OracleObject["object_type"];
  description?: string | null;
  functional_description?: string | null;
  module?: string | null;
  owner?: string | null;
  notes?: string | null;
  source?: ObjectSource;
}

export interface NewColumnInput {
  column_name: string;
  data_type?: string | null;
  data_length?: number | null;
  data_precision?: number | null;
  data_scale?: number | null;
  nullable?: boolean;
  column_order?: number | null;
  description?: string | null;
  business_meaning?: string | null;
  notes?: string | null;
}

export interface NewColumnValueInput {
  value: string;
  meaning?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface NewCodeVersionInput {
  version_number: string;
  source_type: SourceType;
  source_code: string;
  environment: Environment;
  change_description?: string | null;
}

export interface NewArgumentInput {
  argument_name: string;
  position: number;
  data_type?: string | null;
  in_out: OracleArgument["in_out"];
  description?: string | null;
}

export interface NewRelationInput {
  source_object_id: string;
  target_object_id: string;
  relation_type: RelationType;
  description?: string | null;
}

export interface NewSnippetInput {
  title: string;
  description?: string | null;
  sql_code: string;
  category: SqlSnippet["category"];
  database_type: SqlSnippet["database_type"];
  schema_name?: string | null;
  environment?: Environment | null;
  notes?: string | null;
  warnings?: string | null;
}

export interface NewParameterInput {
  parameter_name: string;
  data_type?: string | null;
  description?: string | null;
  example_value?: string | null;
  required?: boolean;
}

interface KnowledgeContextValue {
  objects: OracleObjectWithRelations[];
  snippets: SqlSnippetWithRelations[];
  tags: KnowledgeTag[];
  profiles: Profile[];
  loading: boolean;
  loadError: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  createObject: (input: NewObjectInput) => Promise<OracleObject | null>;
  updateObject: (id: string, patch: Partial<OracleObject>) => Promise<void>;
  deleteObject: (id: string) => Promise<void>;
  toggleObjectFavorite: (id: string, favorite: boolean) => Promise<void>;
  upsertEnvironment: (
    objectId: string,
    environment: Environment,
    patch: Partial<Pick<OracleObjectEnvironment, "version" | "status" | "notes" | "last_verified_at">>,
  ) => Promise<void>;
  addColumn: (objectId: string, input: NewColumnInput) => Promise<void>;
  updateColumn: (id: string, patch: Partial<OracleColumn>) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  addColumnValue: (columnId: string, input: NewColumnValueInput) => Promise<void>;
  updateColumnValue: (id: string, patch: Partial<OracleColumnValue>) => Promise<void>;
  deleteColumnValue: (id: string) => Promise<void>;
  addCodeVersion: (objectId: string, input: NewCodeVersionInput) => Promise<void>;
  deleteCodeVersion: (id: string) => Promise<void>;
  addArgument: (objectId: string, input: NewArgumentInput) => Promise<void>;
  updateArgument: (id: string, patch: Partial<OracleArgument>) => Promise<void>;
  deleteArgument: (id: string) => Promise<void>;
  addRelation: (input: NewRelationInput) => Promise<void>;
  deleteRelation: (id: string) => Promise<void>;
  createTag: (name: string, color: string) => Promise<KnowledgeTag | null>;
  deleteTag: (id: string) => Promise<void>;
  toggleObjectTag: (objectId: string, tagId: string, active: boolean) => Promise<void>;
  toggleSnippetTag: (snippetId: string, tagId: string, active: boolean) => Promise<void>;
  createSnippet: (input: NewSnippetInput) => Promise<SqlSnippet | null>;
  updateSnippet: (id: string, patch: Partial<SqlSnippet>) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  toggleSnippetFavorite: (id: string, favorite: boolean) => Promise<void>;
  addSnippetParameter: (snippetId: string, input: NewParameterInput) => Promise<void>;
  deleteSnippetParameter: (id: string) => Promise<void>;
  addSnippetObject: (snippetId: string, objectId: string) => Promise<void>;
  removeSnippetObject: (snippetId: string, objectId: string) => Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

interface RawData {
  objects: OracleObject[];
  environments: OracleObjectEnvironment[];
  columns: OracleColumn[];
  columnValues: OracleColumnValue[];
  codeVersions: OracleCodeVersion[];
  arguments: OracleArgument[];
  snippets: SqlSnippet[];
  parameters: SqlSnippetParameter[];
  snippetObjects: { snippet_id: string; object_id: string }[];
  relations: ObjectRelation[];
  tags: KnowledgeTag[];
  objectTags: OracleObjectTag[];
  snippetTags: SqlSnippetTag[];
  favorites: KnowledgeFavorite[];
  profiles: Profile[];
}

const EMPTY: RawData = {
  objects: [],
  environments: [],
  columns: [],
  columnValues: [],
  codeVersions: [],
  arguments: [],
  snippets: [],
  parameters: [],
  snippetObjects: [],
  relations: [],
  tags: [],
  objectTags: [],
  snippetTags: [],
  favorites: [],
  profiles: [],
};

const KNOWLEDGE_TABLES = [
  "oracle_objects",
  "oracle_object_environments",
  "oracle_columns",
  "oracle_column_values",
  "oracle_code_versions",
  "oracle_arguments",
  "sql_snippets",
  "sql_snippet_parameters",
  "sql_snippet_objects",
  "object_relations",
  "knowledge_tags",
  "knowledge_object_tags",
  "knowledge_snippet_tags",
  "knowledge_user_favorites",
] as const;

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const { user } = useAuth();

  const [data, setData] = useState<RawData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const [
      objectsRes,
      environmentsRes,
      columnsRes,
      columnValuesRes,
      codeVersionsRes,
      argumentsRes,
      snippetsRes,
      parametersRes,
      snippetObjectsRes,
      relationsRes,
      tagsRes,
      objectTagsRes,
      snippetTagsRes,
      profilesRes,
    ] = await Promise.all([
      supabase.from("oracle_objects").select("*").order("object_name"),
      supabase.from("oracle_object_environments").select("*"),
      supabase.from("oracle_columns").select("*").order("column_order"),
      supabase.from("oracle_column_values").select("*"),
      supabase.from("oracle_code_versions").select("*").order("created_at", { ascending: false }),
      supabase.from("oracle_arguments").select("*").order("position"),
      supabase.from("sql_snippets").select("*").order("updated_at", { ascending: false }),
      supabase.from("sql_snippet_parameters").select("*").order("position"),
      supabase.from("sql_snippet_objects").select("*"),
      supabase.from("object_relations").select("*"),
      supabase.from("knowledge_tags").select("*").order("name"),
      supabase.from("knowledge_object_tags").select("*"),
      supabase.from("knowledge_snippet_tags").select("*"),
      supabase.from("profiles").select("*").order("full_name"),
    ]);

    const favoritesRes = user
      ? await supabase.from("knowledge_user_favorites").select("*").eq("user_id", user.id)
      : { data: [] as KnowledgeFavorite[], error: null };

    const firstError = [
      objectsRes,
      environmentsRes,
      columnsRes,
      columnValuesRes,
      codeVersionsRes,
      argumentsRes,
      snippetsRes,
      parametersRes,
      snippetObjectsRes,
      relationsRes,
      tagsRes,
      objectTagsRes,
      snippetTagsRes,
      profilesRes,
    ].find((r) => r.error)?.error;

    setLoadError(firstError ? firstError.message : null);

    setData({
      objects: (objectsRes.data as OracleObject[]) ?? [],
      environments: (environmentsRes.data as OracleObjectEnvironment[]) ?? [],
      columns: (columnsRes.data as OracleColumn[]) ?? [],
      columnValues: (columnValuesRes.data as OracleColumnValue[]) ?? [],
      codeVersions: (codeVersionsRes.data as OracleCodeVersion[]) ?? [],
      arguments: (argumentsRes.data as OracleArgument[]) ?? [],
      snippets: (snippetsRes.data as SqlSnippet[]) ?? [],
      parameters: (parametersRes.data as SqlSnippetParameter[]) ?? [],
      snippetObjects:
        (snippetObjectsRes.data as { snippet_id: string; object_id: string }[]) ?? [],
      relations: (relationsRes.data as ObjectRelation[]) ?? [],
      tags: (tagsRes.data as KnowledgeTag[]) ?? [],
      objectTags: (objectTagsRes.data as OracleObjectTag[]) ?? [],
      snippetTags: (snippetTagsRes.data as SqlSnippetTag[]) ?? [],
      favorites: (favoritesRes.data as KnowledgeFavorite[]) ?? [],
      profiles: (profilesRes.data as Profile[]) ?? [],
    });
    setLoading(false);
  }, [supabase, user]);

  const scheduleRefetch = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => refetch(), 150);
  }, [refetch]);

  useEffect(() => {
    queueMicrotask(() => refetch());
  }, [refetch]);

  useEffect(() => {
    const channel = supabase.channel("knowledge-hub");
    for (const table of KNOWLEDGE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefetch,
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [supabase, scheduleRefetch]);

  // Hub privado: cada usuario gestiona su propio contenido.
  const canEdit = !!user;
  const isAdmin = !!user;

  const favoriteKeys = useMemo(
    () => new Set(data.favorites.map((f) => `${f.item_type}:${f.item_id}`)),
    [data.favorites],
  );

  const objects = useMemo<OracleObjectWithRelations[]>(() => {
    const envByObject = groupBy(data.environments, (e) => e.object_id);
    const colsByObject = groupBy(data.columns, (c) => c.object_id);
    const valuesByColumn = groupBy(data.columnValues, (v) => v.column_id);
    const codeByObject = groupBy(data.codeVersions, (c) => c.object_id);
    const argsByObject = groupBy(data.arguments, (a) => a.object_id);
    const objectById = new Map(data.objects.map((o) => [o.id, o]));
    const tagById = new Map(data.tags.map((t) => [t.id, t]));
    const tagsByObject = new Map<string, KnowledgeTag[]>();
    for (const link of data.objectTags) {
      const tag = tagById.get(link.tag_id);
      if (!tag) continue;
      const list = tagsByObject.get(link.object_id) ?? [];
      list.push(tag);
      tagsByObject.set(link.object_id, list);
    }
    const snippetCountByObject = new Map<string, number>();
    for (const link of data.snippetObjects) {
      snippetCountByObject.set(link.object_id, (snippetCountByObject.get(link.object_id) ?? 0) + 1);
    }
    const relationsBySource = groupBy(data.relations, (r) => r.source_object_id);
    const relationsByTarget = groupBy(data.relations, (r) => r.target_object_id);

    return data.objects.map((object) => ({
      ...object,
      environments: (envByObject.get(object.id) ?? []).sort((a, b) =>
        a.environment.localeCompare(b.environment),
      ),
      columns: (colsByObject.get(object.id) ?? [])
        .sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0))
        .map((column) => ({
          ...column,
          values: valuesByColumn.get(column.id) ?? [],
        })),
      code_versions: codeByObject.get(object.id) ?? [],
      arguments: argsByObject.get(object.id) ?? [],
      tags: tagsByObject.get(object.id) ?? [],
      relations_as_source: (relationsBySource.get(object.id) ?? [])
        .map((relation) => ({ ...relation, target_object: objectById.get(relation.target_object_id) }))
        .filter((r) => r.target_object),
      relations_as_target: (relationsByTarget.get(object.id) ?? [])
        .map((relation) => ({ ...relation, source_object: objectById.get(relation.source_object_id) }))
        .filter((r) => r.source_object),
      snippet_count: snippetCountByObject.get(object.id) ?? 0,
      is_favorite: favoriteKeys.has(`OBJECT:${object.id}`),
    })) as OracleObjectWithRelations[];
  }, [data, favoriteKeys]);

  const snippets = useMemo<SqlSnippetWithRelations[]>(() => {
    const paramsBySnippet = groupBy(data.parameters, (p) => p.snippet_id);
    const objectById = new Map(data.objects.map((o) => [o.id, o]));
    const tagById = new Map(data.tags.map((t) => [t.id, t]));
    const tagsBySnippet = new Map<string, KnowledgeTag[]>();
    for (const link of data.snippetTags) {
      const tag = tagById.get(link.tag_id);
      if (!tag) continue;
      const list = tagsBySnippet.get(link.snippet_id) ?? [];
      list.push(tag);
      tagsBySnippet.set(link.snippet_id, list);
    }
    const objectsBySnippet = new Map<string, OracleObject[]>();
    for (const link of data.snippetObjects) {
      const object = objectById.get(link.object_id);
      if (!object) continue;
      const list = objectsBySnippet.get(link.snippet_id) ?? [];
      list.push(object);
      objectsBySnippet.set(link.snippet_id, list);
    }

    return data.snippets.map((snippet) => ({
      ...snippet,
      parameters: paramsBySnippet.get(snippet.id) ?? [],
      objects: objectsBySnippet.get(snippet.id) ?? [],
      tags: tagsBySnippet.get(snippet.id) ?? [],
      is_favorite: favoriteKeys.has(`SNIPPET:${snippet.id}`),
    }));
  }, [data, favoriteKeys]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createObject = useCallback(
    async (input: NewObjectInput) => {
      const { data: created, error } = await supabase
        .from("oracle_objects")
        .insert({
          schema_name: input.schema_name.trim().toUpperCase(),
          object_name: input.object_name.trim().toUpperCase(),
          object_type: input.object_type,
          description: input.description ?? null,
          functional_description: input.functional_description ?? null,
          module: input.module ?? null,
          owner: input.owner ?? null,
          notes: input.notes ?? null,
          source: input.source ?? "MANUAL",
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await refetch();
      return (created as OracleObject) ?? null;
    },
    [supabase, user, refetch],
  );

  const updateObject = useCallback(
    async (id: string, patch: Partial<OracleObject>) => {
      setData((prev) => ({
        ...prev,
        objects: prev.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      }));
      const { error } = await supabase
        .from("oracle_objects")
        .update({ ...patch, updated_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase, user],
  );

  const deleteObject = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("oracle_objects").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const toggleFavorite = useCallback(
    async (itemType: KnowledgeItemType, itemId: string, active: boolean) => {
      if (!user) return;
      if (active) {
        await supabase
          .from("knowledge_user_favorites")
          .upsert(
            { user_id: user.id, item_type: itemType, item_id: itemId },
            { onConflict: "user_id,item_type,item_id" },
          );
      } else {
        await supabase
          .from("knowledge_user_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("item_type", itemType)
          .eq("item_id", itemId);
      }
      await refetch();
    },
    [supabase, user, refetch],
  );

  const toggleObjectFavorite = useCallback(
    (id: string, favorite: boolean) => toggleFavorite("OBJECT", id, favorite),
    [toggleFavorite],
  );

  const upsertEnvironment = useCallback(
    async (
      objectId: string,
      environment: Environment,
      patch: Partial<
        Pick<OracleObjectEnvironment, "version" | "status" | "notes" | "last_verified_at">
      >,
    ) => {
      const { error } = await supabase.from("oracle_object_environments").upsert(
        {
          object_id: objectId,
          environment,
          version: patch.version ?? null,
          status: (patch.status as EnvironmentStatus) ?? "UNKNOWN",
          notes: patch.notes ?? null,
          last_verified_at: patch.last_verified_at ?? null,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        },
        { onConflict: "object_id,environment" },
      );
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, user, refetch],
  );

  const addColumn = useCallback(
    async (objectId: string, input: NewColumnInput) => {
      const { error } = await supabase.from("oracle_columns").insert({
        object_id: objectId,
        column_name: input.column_name.trim().toUpperCase(),
        data_type: input.data_type ?? null,
        data_length: input.data_length ?? null,
        data_precision: input.data_precision ?? null,
        data_scale: input.data_scale ?? null,
        nullable: input.nullable ?? true,
        column_order: input.column_order ?? null,
        description: input.description ?? null,
        business_meaning: input.business_meaning ?? null,
        notes: input.notes ?? null,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, user, refetch],
  );

  const updateColumn = useCallback(
    async (id: string, patch: Partial<OracleColumn>) => {
      setData((prev) => ({
        ...prev,
        columns: prev.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
      const { error } = await supabase
        .from("oracle_columns")
        .update({ ...patch, updated_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase, user],
  );

  const deleteColumn = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("oracle_columns").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const addColumnValue = useCallback(
    async (columnId: string, input: NewColumnValueInput) => {
      const { error } = await supabase.from("oracle_column_values").insert({
        column_id: columnId,
        value: input.value,
        meaning: input.meaning ?? null,
        notes: input.notes ?? null,
        is_active: input.is_active ?? true,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, user, refetch],
  );

  const updateColumnValue = useCallback(
    async (id: string, patch: Partial<OracleColumnValue>) => {
      setData((prev) => ({
        ...prev,
        columnValues: prev.columnValues.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      }));
      const { error } = await supabase
        .from("oracle_column_values")
        .update({ ...patch, updated_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase, user],
  );

  const deleteColumnValue = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("oracle_column_values").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const addCodeVersion = useCallback(
    async (objectId: string, input: NewCodeVersionInput) => {
      const versionNumber = Number(input.version_number);
      if (!Number.isFinite(versionNumber)) {
        throw new Error("El número de versión debe ser numérico (ej. 1 o 1.5)");
      }
      const { error } = await supabase.from("oracle_code_versions").insert({
        object_id: objectId,
        version_number: versionNumber,
        source_type: input.source_type,
        source_code: input.source_code,
        environment: input.environment,
        change_description: input.change_description ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, user, refetch],
  );

  const deleteCodeVersion = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("oracle_code_versions").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const addArgument = useCallback(
    async (objectId: string, input: NewArgumentInput) => {
      const { error } = await supabase.from("oracle_arguments").insert({
        object_id: objectId,
        argument_name: input.argument_name,
        position: input.position,
        data_type: input.data_type ?? null,
        in_out: input.in_out,
        description: input.description ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, user, refetch],
  );

  const updateArgument = useCallback(
    async (id: string, patch: Partial<OracleArgument>) => {
      setData((prev) => ({
        ...prev,
        arguments: prev.arguments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));
      const { error } = await supabase.from("oracle_arguments").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const deleteArgument = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("oracle_arguments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const addRelation = useCallback(
    async (input: NewRelationInput) => {
      const { error } = await supabase.from("object_relations").insert({
        source_object_id: input.source_object_id,
        target_object_id: input.target_object_id,
        relation_type: input.relation_type,
        description: input.description ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, user, refetch],
  );

  const deleteRelation = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("object_relations").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const createTag = useCallback(
    async (name: string, color: string) => {
      const { data: created, error } = await supabase
        .from("knowledge_tags")
        .insert({ name: name.trim(), color, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await refetch();
      return (created as KnowledgeTag) ?? null;
    },
    [supabase, user, refetch],
  );

  const deleteTag = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("knowledge_tags").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const toggleObjectTag = useCallback(
    async (objectId: string, tagId: string, active: boolean) => {
      if (active) {
        await supabase.from("oracle_object_tags").insert({ object_id: objectId, tag_id: tagId });
      } else {
        await supabase
          .from("oracle_object_tags")
          .delete()
          .eq("object_id", objectId)
          .eq("tag_id", tagId);
      }
      await refetch();
    },
    [supabase, refetch],
  );

  const toggleSnippetTag = useCallback(
    async (snippetId: string, tagId: string, active: boolean) => {
      if (active) {
        await supabase.from("sql_snippet_tags").insert({ snippet_id: snippetId, tag_id: tagId });
      } else {
        await supabase
          .from("sql_snippet_tags")
          .delete()
          .eq("snippet_id", snippetId)
          .eq("tag_id", tagId);
      }
      await refetch();
    },
    [supabase, refetch],
  );

  const createSnippet = useCallback(
    async (input: NewSnippetInput) => {
      const { data: created, error } = await supabase
        .from("sql_snippets")
        .insert({
          title: input.title.trim(),
          description: input.description ?? null,
          sql_code: input.sql_code,
          category: input.category,
          database_type: input.database_type,
          schema_name: input.schema_name ?? null,
          environment: input.environment ?? null,
          notes: input.notes ?? null,
          warnings: input.warnings ?? null,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await refetch();
      return (created as SqlSnippet) ?? null;
    },
    [supabase, user, refetch],
  );

  const updateSnippet = useCallback(
    async (id: string, patch: Partial<SqlSnippet>) => {
      setData((prev) => ({
        ...prev,
        snippets: prev.snippets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
      const { error } = await supabase
        .from("sql_snippets")
        .update({ ...patch, updated_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase, user],
  );

  const deleteSnippet = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("sql_snippets").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const toggleSnippetFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      setData((prev) => ({
        ...prev,
        snippets: prev.snippets.map((s) => (s.id === id ? { ...s, is_favorite: favorite } : s)),
      }));
      await supabase.from("sql_snippets").update({ is_favorite: favorite }).eq("id", id);
    },
    [supabase],
  );

  const addSnippetParameter = useCallback(
    async (snippetId: string, input: NewParameterInput) => {
      const { error } = await supabase.from("sql_snippet_parameters").insert({
        snippet_id: snippetId,
        parameter_name: input.parameter_name.trim(),
        data_type: input.data_type ?? null,
        description: input.description ?? null,
        example_value: input.example_value ?? null,
        required: input.required ?? false,
      });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const deleteSnippetParameter = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("sql_snippet_parameters").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const addSnippetObject = useCallback(
    async (snippetId: string, objectId: string) => {
      const { error } = await supabase
        .from("sql_snippet_objects")
        .insert({ snippet_id: snippetId, object_id: objectId });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const removeSnippetObject = useCallback(
    async (snippetId: string, objectId: string) => {
      const { error } = await supabase
        .from("sql_snippet_objects")
        .delete()
        .eq("snippet_id", snippetId)
        .eq("object_id", objectId);
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, refetch],
  );

  const value = useMemo<KnowledgeContextValue>(
    () => ({
      objects,
      snippets,
      tags: data.tags,
      profiles: data.profiles,
      loading,
      loadError,
      canEdit,
      isAdmin,
      refetch,
      createObject,
      updateObject,
      deleteObject,
      toggleObjectFavorite,
      upsertEnvironment,
      addColumn,
      updateColumn,
      deleteColumn,
      addColumnValue,
      updateColumnValue,
      deleteColumnValue,
      addCodeVersion,
      deleteCodeVersion,
      addArgument,
      updateArgument,
      deleteArgument,
      addRelation,
      deleteRelation,
      createTag,
      deleteTag,
      toggleObjectTag,
      toggleSnippetTag,
      createSnippet,
      updateSnippet,
      deleteSnippet,
      toggleSnippetFavorite,
      addSnippetParameter,
      deleteSnippetParameter,
      addSnippetObject,
      removeSnippetObject,
    }),
    [
      objects,
      snippets,
      data.tags,
      data.profiles,
      loading,
      loadError,
      canEdit,
      isAdmin,
      refetch,
      createObject,
      updateObject,
      deleteObject,
      toggleObjectFavorite,
      upsertEnvironment,
      addColumn,
      updateColumn,
      deleteColumn,
      addColumnValue,
      updateColumnValue,
      deleteColumnValue,
      addCodeVersion,
      deleteCodeVersion,
      addArgument,
      updateArgument,
      deleteArgument,
      addRelation,
      deleteRelation,
      createTag,
      deleteTag,
      toggleObjectTag,
      toggleSnippetTag,
      createSnippet,
      updateSnippet,
      deleteSnippet,
      toggleSnippetFavorite,
      addSnippetParameter,
      deleteSnippetParameter,
      addSnippetObject,
      removeSnippetObject,
    ],
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error("useKnowledge must be used within KnowledgeProvider");
  return ctx;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
