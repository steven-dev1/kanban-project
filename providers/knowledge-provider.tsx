"use client";

import { createClient } from "@/lib/supabase/client";
import {
  canAdminKnowledge,
  canEditKnowledge,
  objectFullName,
} from "@/lib/knowledge/constants";
import type {
  KnowledgeItemType,
  KnowledgeTag,
  OracleObjectType,
} from "@/lib/knowledge/types";
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

export interface ObjectLite {
  id: string;
  schema_name: string;
  object_name: string;
  object_type: OracleObjectType;
  label: string;
}

interface KnowledgeContextValue {
  userId: string | null;
  canEdit: boolean;
  canAdmin: boolean;
  loading: boolean;
  tags: KnowledgeTag[];
  createTag: (name: string, color: string) => Promise<KnowledgeTag | null>;
  deleteTag: (id: string) => Promise<void>;
  favorites: Set<string>;
  isFavorite: (itemId: string) => boolean;
  toggleFavorite: (itemType: KnowledgeItemType, itemId: string) => Promise<void>;
  trackView: (itemType: KnowledgeItemType, itemId: string) => Promise<void>;
  objects: ObjectLite[];
  schemas: string[];
  modules: string[];
  refresh: () => Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const { user, profile } = useAuth();

  const [tags, setTags] = useState<KnowledgeTag[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [objects, setObjects] = useState<ObjectLite[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const [tagsRes, favRes, objectsRes] = await Promise.all([
      supabase.from("knowledge_tags").select("*").order("name"),
      user
        ? supabase
            .from("knowledge_user_favorites")
            .select("item_id")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] as { item_id: string }[] }),
      supabase
        .from("oracle_objects")
        .select("id,schema_name,object_name,object_type,module")
        .order("object_name"),
    ]);

    setTags((tagsRes.data as KnowledgeTag[]) ?? []);
    setFavorites(
      new Set(((favRes.data as { item_id: string }[]) ?? []).map((f) => f.item_id)),
    );

    const rows =
      (objectsRes.data as (ObjectLite & { module: string | null })[]) ?? [];
    setObjects(
      rows.map((row) => ({
        id: row.id,
        schema_name: row.schema_name,
        object_name: row.object_name,
        object_type: row.object_type,
        label: objectFullName(row),
      })),
    );
    setModules(
      Array.from(
        new Set(rows.map((row) => row.module).filter((m): m is string => !!m)),
      ).sort(),
    );
    setLoading(false);
  }, [supabase, user]);

  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => refresh(), 150);
  }, [refresh]);

  useEffect(() => {
    queueMicrotask(() => refresh());
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel("knowledge-hub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "knowledge_tags" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oracle_objects" },
        scheduleRefresh,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [supabase, scheduleRefresh]);

  const createTag = useCallback(
    async (name: string, color: string) => {
      const { data, error } = await supabase
        .from("knowledge_tags")
        .insert({ name: name.trim(), color, created_by: user?.id ?? null })
        .select()
        .single();
      if (error || !data) return null;
      const tag = data as KnowledgeTag;
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      return tag;
    },
    [supabase, user],
  );

  const deleteTag = useCallback(
    async (id: string) => {
      await supabase.from("knowledge_tags").delete().eq("id", id);
      setTags((prev) => prev.filter((tag) => tag.id !== id));
    },
    [supabase],
  );

  const toggleFavorite = useCallback(
    async (itemType: KnowledgeItemType, itemId: string) => {
      const active = favorites.has(itemId);
      if (active) {
        await supabase
          .from("knowledge_user_favorites")
          .delete()
          .eq("user_id", user?.id ?? "")
          .eq("item_type", itemType)
          .eq("item_id", itemId);
      } else {
        await supabase.from("knowledge_user_favorites").insert({
          user_id: user?.id,
          item_type: itemType,
          item_id: itemId,
        });
      }
      setFavorites((prev) => {
        const next = new Set(prev);
        if (active) next.delete(itemId);
        else next.add(itemId);
        return next;
      });
    },
    [supabase, favorites, user],
  );

  const trackView = useCallback(
    async (itemType: KnowledgeItemType, itemId: string) => {
      if (!user) return;
      await supabase.from("knowledge_recent_views").upsert(
        {
          user_id: user.id,
          item_type: itemType,
          item_id: itemId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,item_type,item_id" },
      );
    },
    [supabase, user],
  );

  const schemas = useMemo(
    () =>
      Array.from(new Set(objects.map((object) => object.schema_name))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [objects],
  );

  const value = useMemo<KnowledgeContextValue>(
    () => ({
      userId: user?.id ?? null,
      canEdit: canEditKnowledge(profile),
      canAdmin: canAdminKnowledge(profile),
      loading,
      tags,
      createTag,
      deleteTag,
      favorites,
      isFavorite: (itemId: string) => favorites.has(itemId),
      toggleFavorite,
      trackView,
      objects,
      schemas,
      modules,
      refresh,
    }),
    [
      user,
      profile,
      loading,
      tags,
      createTag,
      deleteTag,
      favorites,
      toggleFavorite,
      trackView,
      objects,
      schemas,
      modules,
      refresh,
    ],
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error("useKnowledge debe usarse dentro de KnowledgeProvider");
  }
  return context;
}
