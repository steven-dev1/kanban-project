"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  Attachment,
  Board,
  BoardInvitation,
  BoardList,
  BoardMember,
  Card,
  CardWithLabels,
  Label,
  Profile,
  Role,
} from "@/lib/types";
import { positionBetween } from "@/lib/utils";
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

type MemberWithProfile = BoardMember & { profile: Profile | null };

interface BoardContextValue {
  boardId: string;
  board: Board | null;
  lists: (BoardList & { cards: CardWithLabels[] })[];
  archivedLists: BoardList[];
  archivedCards: CardWithLabels[];
  labels: Label[];
  members: MemberWithProfile[];
  ownerProfile: Profile | null;
  invitations: BoardInvitation[];
  loading: boolean;
  loadError: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  refetch: () => Promise<void>;
  addList: (title: string, color: string) => Promise<void>;
  updateList: (id: string, patch: Partial<BoardList>) => Promise<void>;
  archiveList: (id: string, archived: boolean) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  moveList: (id: string, beforePos: number | null, afterPos: number | null) => Promise<void>;
  addCard: (listId: string, title: string, description?: string) => Promise<Card | null>;
  updateCard: (id: string, patch: Partial<Card>) => Promise<void>;
  toggleCardComplete: (cardId: string, completed: boolean) => Promise<void>;
  addChecklistItem: (cardId: string, text: string) => Promise<void>;
  toggleChecklistItem: (id: string, done: boolean) => Promise<void>;
  updateChecklistItem: (id: string, text: string) => Promise<void>;
  deleteChecklistItem: (id: string) => Promise<void>;
  duplicateCard: (cardId: string) => Promise<string | null>;
  archiveCard: (id: string, archived: boolean) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (
    cardId: string,
    targetListId: string,
    beforePos: number | null,
    afterPos: number | null,
  ) => Promise<void>;
  createLabel: (name: string, color: string) => Promise<Label | null>;
  updateLabel: (id: string, patch: Partial<Label>) => Promise<void>;
  deleteLabel: (id: string) => Promise<void>;
  toggleCardLabel: (cardId: string, labelId: string, active: boolean) => Promise<void>;
  toggleAssignee: (cardId: string, userId: string, active: boolean) => Promise<void>;
  addAttachment: (cardId: string, file: File) => Promise<string | null>;
  deleteAttachment: (attachment: Attachment) => Promise<void>;
  getAttachmentUrl: (path: string) => Promise<string | null>;
  inviteMember: (
    email: string,
    role: Role,
  ) => Promise<{ error: string | null; warning: string | null }>;
  updateMemberRole: (memberId: string, role: Role) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  cancelInvitation: (id: string) => Promise<void>;
  togglePause: () => Promise<void>;
}

const BoardContext = createContext<BoardContextValue | null>(null);

const byPosition = (a: { position: number }, b: { position: number }) =>
  a.position - b.position;

export function BoardProvider({
  boardId,
  children,
}: {
  boardId: string;
  children: ReactNode;
}) {
  const supabase = createClient();
  const { user } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<(BoardList & { cards: CardWithLabels[] })[]>([]);
  const [archivedLists, setArchivedLists] = useState<BoardList[]>([]);
  const [archivedCards, setArchivedCards] = useState<CardWithLabels[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [invitations, setInvitations] = useState<BoardInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const [boardRes, listsRes, cardsRes, labelsRes, membersRes, invitesRes] =
      await Promise.all([
        supabase.from("boards").select("*").eq("id", boardId).maybeSingle(),
        supabase.from("lists").select("*").eq("board_id", boardId).order("position"),
        supabase
          .from("cards")
          .select(
            "*, card_labels(label_id, labels(*)), card_assignees(user_id, profile:profiles(*)), attachments(*), card_checklist_items(*)",
          )
          .eq("board_id", boardId)
          .order("position"),
        supabase.from("labels").select("*").eq("board_id", boardId).order("created_at"),
        supabase
          .from("board_members")
          .select("*, profile:profiles(*)")
          .eq("board_id", boardId),
        supabase
          .from("board_invitations")
          .select("*")
          .eq("board_id", boardId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

    const firstError = [
      boardRes,
      listsRes,
      cardsRes,
      labelsRes,
      membersRes,
      invitesRes,
    ].find((r) => r.error)?.error;
    setLoadError(firstError ? firstError.message : null);

    const boardData = (boardRes.data as Board) ?? null;
    setBoard(boardData);
    if (boardData) {
      const { data: owner } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", boardData.owner_id)
        .maybeSingle();
      setOwnerProfile((owner as Profile) ?? null);
    } else {
      setOwnerProfile(null);
    }

    const allLists = (listsRes.data as BoardList[]) ?? [];
    const allCards = (cardsRes.data as CardWithLabels[]) ?? [];
    const activeLists = allLists.filter((l) => !l.is_archived).sort(byPosition);

    setLists(
      activeLists.map((list) => ({
        ...list,
        cards: allCards
          .filter((card) => card.list_id === list.id && !card.is_archived)
          .sort(byPosition),
      })),
    );
    setArchivedLists(allLists.filter((l) => l.is_archived).sort(byPosition));
    setArchivedCards(allCards.filter((c) => c.is_archived).sort(byPosition));
    setLabels((labelsRes.data as Label[]) ?? []);
    setMembers((membersRes.data as MemberWithProfile[]) ?? []);
    setInvitations((invitesRes.data as BoardInvitation[]) ?? []);
    setLoading(false);
  }, [supabase, boardId]);

  const scheduleRefetch = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => refetch(), 120);
  }, [refetch]);

  useEffect(() => {
    queueMicrotask(() => refetch());
  }, [refetch]);

  useEffect(() => {
    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boards", filter: `id=eq.${boardId}` },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lists", filter: `board_id=eq.${boardId}` },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "labels", filter: `board_id=eq.${boardId}` },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_labels" },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_assignees" },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_checklist_items" },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attachments", filter: `board_id=eq.${boardId}` },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${boardId}` },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_invitations", filter: `board_id=eq.${boardId}` },
        scheduleRefetch,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [supabase, boardId, scheduleRefetch]);

  const canEdit = !!board && !board.is_paused;
  const isOwner = !!board && !!user && board.owner_id === user.id;
  const myMembership = members.find((m) => m.user_id === user?.id);
  const isAdmin = isOwner || myMembership?.role === "admin";

  const addList = useCallback(
    async (title: string, color: string) => {
      const max = lists.reduce((acc, l) => Math.max(acc, l.position), 0);
      await supabase
        .from("lists")
        .insert({ board_id: boardId, title, color, position: max + 1000 });
      await refetch();
    },
    [supabase, boardId, lists, refetch],
  );

  const updateList = useCallback(
    async (id: string, patch: Partial<BoardList>) => {
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      await supabase.from("lists").update(patch).eq("id", id);
    },
    [supabase],
  );

  const archiveList = useCallback(
    async (id: string, archived: boolean) => {
      await supabase
        .from("lists")
        .update({ is_archived: archived, archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      await refetch();
    },
    [supabase, refetch],
  );

  const deleteList = useCallback(
    async (id: string) => {
      await supabase.from("lists").delete().eq("id", id);
      await refetch();
    },
    [supabase, refetch],
  );

  const moveList = useCallback(
    async (id: string, beforePos: number | null, afterPos: number | null) => {
      const position = positionBetween(beforePos, afterPos);
      setLists((prev) =>
        prev.map((l) => (l.id === id ? { ...l, position } : l)).sort(byPosition),
      );
      await supabase.from("lists").update({ position }).eq("id", id);
    },
    [supabase],
  );

  const addCard = useCallback(
    async (listId: string, title: string, description?: string) => {
      const list = lists.find((l) => l.id === listId);
      const max = list?.cards.reduce((acc, c) => Math.max(acc, c.position), 0) ?? 0;
      const { data, error } = await supabase
        .from("cards")
        .insert({
          board_id: boardId,
          list_id: listId,
          title,
          description: description ?? null,
          position: max + 1000,
          created_by: user?.id ?? null,
        })
        .select(
          "*, card_labels(label_id, labels(*)), card_assignees(user_id, profile:profiles(*)), attachments(*), card_checklist_items(*)",
        )
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        const card = data as CardWithLabels;
        setLists((prev) =>
          prev.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, card] } : l)),
        );
      }
      return (data as Card) ?? null;
    },
    [supabase, boardId, lists, user],
  );

  const updateCard = useCallback(
    async (id: string, patch: Partial<Card>) => {
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      );
      await supabase.from("cards").update(patch).eq("id", id);
    },
    [supabase],
  );

  const toggleCardComplete = useCallback(
    async (cardId: string, completed: boolean) => {
      const previous = lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
      if (!previous) return;
      const patch = {
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
      };

      const sourceList = lists.find((l) => l.id === previous.list_id);
      const targetId = completed ? (sourceList?.completed_list_id ?? null) : null;
      const shouldMove = !!targetId && targetId !== previous.list_id;
      const targetList = shouldMove ? lists.find((l) => l.id === targetId) : null;
      const position = shouldMove
        ? (targetList?.cards ?? []).reduce((acc, c) => Math.max(acc, c.position), 0) + 1000
        : previous.position;
      const moved = {
        ...previous,
        ...patch,
        list_id: shouldMove ? (targetId as string) : previous.list_id,
        position,
      };

      // Optimista: se ve al instante.
      setLists((prev) =>
        prev.map((l) => {
          const without = l.cards.filter((c) => c.id !== cardId);
          if (l.id === moved.list_id) {
            return { ...l, cards: [...without, moved].sort(byPosition) };
          }
          return { ...l, cards: without };
        }),
      );

      const update = shouldMove ? { ...patch, list_id: targetId, position } : patch;
      const { error } = await supabase.from("cards").update(update).eq("id", cardId);
      if (error) {
        // No se guardó: resincronizamos con la base.
        await refetch();
        throw new Error(error.message);
      }
    },
    [supabase, lists, refetch],
  );

  const addChecklistItem = useCallback(
    async (cardId: string, text: string) => {
      const card = lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
      const items = card?.card_checklist_items ?? [];
      const position = items.reduce((acc, i) => Math.max(acc, i.position), 0) + 1000;
      const { error } = await supabase
        .from("card_checklist_items")
        .insert({ card_id: cardId, text, position });
      if (error) throw new Error(error.message);
      await refetch();
    },
    [supabase, lists, refetch],
  );

  const toggleChecklistItem = useCallback(
    async (id: string, done: boolean) => {
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) => ({
            ...c,
            card_checklist_items: c.card_checklist_items.map((i) =>
              i.id === id ? { ...i, is_done: done } : i,
            ),
          })),
        })),
      );
      const { error } = await supabase
        .from("card_checklist_items")
        .update({ is_done: done })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const updateChecklistItem = useCallback(
    async (id: string, text: string) => {
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) => ({
            ...c,
            card_checklist_items: c.card_checklist_items.map((i) =>
              i.id === id ? { ...i, text } : i,
            ),
          })),
        })),
      );
      const { error } = await supabase
        .from("card_checklist_items")
        .update({ text })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const deleteChecklistItem = useCallback(
    async (id: string) => {
      setLists((prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) => ({
            ...c,
            card_checklist_items: c.card_checklist_items.filter((i) => i.id !== id),
          })),
        })),
      );
      const { error } = await supabase.from("card_checklist_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const duplicateCard = useCallback(
    async (cardId: string) => {
      const source = lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
      if (!source) return null;
      const list = lists.find((l) => l.id === source.list_id);
      const siblings = [...(list?.cards ?? [])].sort(byPosition);
      const index = siblings.findIndex((c) => c.id === cardId);
      const next = siblings[index + 1];
      const position = positionBetween(source.position, next ? next.position : null);

      const { data, error } = await supabase
        .from("cards")
        .insert({
          board_id: boardId,
          list_id: source.list_id,
          title: `${source.title} (copia)`,
          description: source.description,
          position,
          due_date: source.due_date,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "No se pudo duplicar la card");
      }

      const newId = data.id as string;

      if (source.card_labels?.length) {
        await supabase
          .from("card_labels")
          .insert(source.card_labels.map((cl) => ({ card_id: newId, label_id: cl.label_id })));
      }

      if (source.card_assignees?.length) {
        await supabase
          .from("card_assignees")
          .insert(source.card_assignees.map((a) => ({ card_id: newId, user_id: a.user_id })));
      }

      if (source.attachments?.length) {
        for (const att of source.attachments) {
          const safeName = att.name.replace(/[^\w.\-]+/g, "_");
          const newPath = `${boardId}/${newId}/${crypto.randomUUID()}-${safeName}`;
          const { error: copyError } = await supabase.storage
            .from("attachments")
            .copy(att.path, newPath);
          if (!copyError) {
            await supabase.from("attachments").insert({
              card_id: newId,
              board_id: boardId,
              name: att.name,
              path: newPath,
              size: att.size,
              mime_type: att.mime_type,
              uploaded_by: user?.id ?? null,
            });
          }
        }
      }

      if (source.card_checklist_items?.length) {
        await supabase.from("card_checklist_items").insert(
          source.card_checklist_items.map((item) => ({
            card_id: newId,
            text: item.text,
            is_done: item.is_done,
            position: item.position,
          })),
        );
      }

      await refetch();
      return newId;
    },
    [supabase, lists, boardId, user, refetch],
  );

  const archiveCard = useCallback(
    async (id: string, archived: boolean) => {
      await supabase
        .from("cards")
        .update({ is_archived: archived, archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      await refetch();
    },
    [supabase, refetch],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      await supabase.from("cards").delete().eq("id", id);
      await refetch();
    },
    [supabase, refetch],
  );

  const moveCard = useCallback(
    async (
      cardId: string,
      targetListId: string,
      beforePos: number | null,
      afterPos: number | null,
    ) => {
      const position = positionBetween(beforePos, afterPos);
      const moved = lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
      if (!moved) return;
      const updated: CardWithLabels = { ...moved, list_id: targetListId, position };
      setLists((prev) =>
        prev.map((l) => {
          if (l.id === targetListId) {
            const others = l.cards.filter((c) => c.id !== cardId);
            return { ...l, cards: [...others, updated].sort(byPosition) };
          }
          return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
        }),
      );
      await supabase
        .from("cards")
        .update({ list_id: targetListId, position })
        .eq("id", cardId);
    },
    [supabase, lists],
  );

  const createLabel = useCallback(
    async (name: string, color: string) => {
      const { data } = await supabase
        .from("labels")
        .insert({ board_id: boardId, name, color })
        .select()
        .single();
      if (data) setLabels((prev) => [...prev, data as Label]);
      return (data as Label) ?? null;
    },
    [supabase, boardId],
  );

  const updateLabel = useCallback(
    async (id: string, patch: Partial<Label>) => {
      setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      await supabase.from("labels").update(patch).eq("id", id);
    },
    [supabase],
  );

  const deleteLabel = useCallback(
    async (id: string) => {
      await supabase.from("labels").delete().eq("id", id);
      await refetch();
    },
    [supabase, refetch],
  );

  const toggleCardLabel = useCallback(
    async (cardId: string, labelId: string, active: boolean) => {
      if (active) {
        await supabase.from("card_labels").insert({ card_id: cardId, label_id: labelId });
      } else {
        await supabase
          .from("card_labels")
          .delete()
          .eq("card_id", cardId)
          .eq("label_id", labelId);
      }
      await refetch();
    },
    [supabase, refetch],
  );

  const toggleAssignee = useCallback(
    async (cardId: string, userId: string, active: boolean) => {
      if (active) {
        await supabase.from("card_assignees").insert({ card_id: cardId, user_id: userId });
      } else {
        await supabase
          .from("card_assignees")
          .delete()
          .eq("card_id", cardId)
          .eq("user_id", userId);
      }
      await refetch();
    },
    [supabase, refetch],
  );

  const addAttachment = useCallback(
    async (cardId: string, file: File) => {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${boardId}/${cardId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) return uploadError.message;

      const { error: dbError } = await supabase.from("attachments").insert({
        card_id: cardId,
        board_id: boardId,
        name: file.name,
        path,
        size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      });
      if (dbError) {
        await supabase.storage.from("attachments").remove([path]);
        return dbError.message;
      }
      await refetch();
      return null;
    },
    [supabase, boardId, user, refetch],
  );

  const deleteAttachment = useCallback(
    async (attachment: Attachment) => {
      await supabase.storage.from("attachments").remove([attachment.path]);
      await supabase.from("attachments").delete().eq("id", attachment.id);
      await refetch();
    },
    [supabase, refetch],
  );

  const getAttachmentUrl = useCallback(
    async (path: string) => {
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
    [supabase],
  );

  const inviteMember = useCallback(
    async (email: string, role: Role) => {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return { error: "Escribe un correo", warning: null };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
        return { error: "El correo no es válido", warning: null };
      }
      if (members.some((m) => m.profile?.email?.toLowerCase() === normalized)) {
        return { error: "Ese usuario ya es miembro de este tablero", warning: null };
      }
      if (invitations.some((i) => i.email.toLowerCase() === normalized)) {
        return { error: "Ya hay una invitación pendiente para ese correo", warning: null };
      }

      try {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", normalized)
          .maybeSingle();

        const { error } = await supabase.from("board_invitations").insert({
          board_id: boardId,
          email: normalized,
          role,
          invited_by: user?.id ?? null,
        });
        if (error) return { error: error.message, warning: null };

        await refetch();

        if (!existingProfile) {
          return {
            error: null,
            warning:
              "El correo aún no está registrado. La invitación queda pendiente y se le notificará al crear su cuenta.",
          };
        }
        return { error: null, warning: null };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Error de red",
          warning: null,
        };
      }
    },
    [supabase, boardId, user, members, invitations, refetch],
  );

  const updateMemberRole = useCallback(
    async (memberId: string, role: Role) => {
      await supabase.from("board_members").update({ role }).eq("id", memberId);
      await refetch();
    },
    [supabase, refetch],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      await supabase.from("board_members").delete().eq("id", memberId);
      await refetch();
    },
    [supabase, refetch],
  );

  const cancelInvitation = useCallback(
    async (id: string) => {
      await supabase.from("board_invitations").delete().eq("id", id);
      await refetch();
    },
    [supabase, refetch],
  );

  const togglePause = useCallback(async () => {
    if (!board) return;
    await supabase
      .from("boards")
      .update({ is_paused: !board.is_paused })
      .eq("id", board.id);
    await refetch();
  }, [supabase, board, refetch]);

  const value = useMemo<BoardContextValue>(
    () => ({
      boardId,
      board,
      lists,
      archivedLists,
      archivedCards,
      labels,
      members,
      ownerProfile,
      invitations,
      loading,
      loadError,
      canEdit,
      isAdmin,
      isOwner,
      refetch,
      addList,
      updateList,
      archiveList,
      deleteList,
      moveList,
      addCard,
      updateCard,
      toggleCardComplete,
      addChecklistItem,
      toggleChecklistItem,
      updateChecklistItem,
      deleteChecklistItem,
      duplicateCard,
      archiveCard,
      deleteCard,
      moveCard,
      createLabel,
      updateLabel,
      deleteLabel,
      toggleCardLabel,
      toggleAssignee,
      addAttachment,
      deleteAttachment,
      getAttachmentUrl,
      inviteMember,
      updateMemberRole,
      removeMember,
      cancelInvitation,
      togglePause,
    }),
    [
      boardId,
      board,
      lists,
      archivedLists,
      archivedCards,
      labels,
      members,
      ownerProfile,
      invitations,
      loading,
      loadError,
      canEdit,
      isAdmin,
      isOwner,
      refetch,
      addList,
      updateList,
      archiveList,
      deleteList,
      moveList,
      addCard,
      updateCard,
      toggleCardComplete,
      addChecklistItem,
      toggleChecklistItem,
      updateChecklistItem,
      deleteChecklistItem,
      duplicateCard,
      archiveCard,
      deleteCard,
      moveCard,
      createLabel,
      updateLabel,
      deleteLabel,
      toggleCardLabel,
      toggleAssignee,
      addAttachment,
      deleteAttachment,
      getAttachmentUrl,
      inviteMember,
      updateMemberRole,
      removeMember,
      cancelInvitation,
      togglePause,
    ],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used within BoardProvider");
  return ctx;
}
