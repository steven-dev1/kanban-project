"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { toDatabaseError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/client";
import type { Profile, SharedItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { Check, ExternalLink, Inbox, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function MessagesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [busy, setBusy] = useState<string | null>(null);

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const [messagesRes, profilesRes] = await Promise.all([
      supabase
        .from("shared_items")
        .select("*")
        .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("profiles").select("*"),
    ]);
    setItems((messagesRes.data as SharedItem[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    queueMicrotask(() => load());
    if (!userId) return;
    const channel = supabase
      .channel(`messages-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_items" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );
  const nameFor = (id: string) => {
    const p = profileById.get(id);
    return p?.full_name || p?.email || "Usuario";
  };

  const received = items.filter((i) => i.recipient_id === userId);
  const sent = items.filter((i) => i.sender_id === userId);
  const list = tab === "received" ? received : sent;
  const unread = received.filter((i) => !i.is_read).length;

  const itemHref = (item: SharedItem) => {
    const id =
      item.recipient_id === userId && item.accepted_item_id ? item.accepted_item_id : item.item_id;
    return item.item_type === "OBJECT" ? `/knowledge/objects/${id}` : `/knowledge/sql/${id}`;
  };

  const accept = async (item: SharedItem) => {
    setBusy(item.id);
    const { data, error } = await supabase.rpc("accept_shared_item", { p_id: item.id });
    setBusy(null);
    if (error) {
      toast(toDatabaseError(error).message, "error");
      return;
    }
    if (data) {
      router.push(
        item.item_type === "SNIPPET" ? `/knowledge/sql/${data}` : `/knowledge/objects/${data}`,
      );
      return;
    }
    load();
  };

  const decline = async (item: SharedItem) => {
    setBusy(item.id);
    const { error } = await supabase.rpc("decline_shared_item", { p_id: item.id });
    setBusy(null);
    if (error) toast(toDatabaseError(error).message, "error");
    load();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Mensajes</h1>
            <p className="text-sm text-muted-foreground">
              Objetos y consultas que te han compartido ({unread} sin leer).
            </p>
          </div>
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button
              onClick={() => setTab("received")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1",
                tab === "received" ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              <Inbox className="h-3.5 w-3.5" /> Recibidos
            </button>
            <button
              onClick={() => setTab("sent")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1",
                tab === "sent" ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              <Send className="h-3.5 w-3.5" /> Enviados
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === "received"
                ? "No has recibido objetos todavía."
                : "No has enviado objetos todavía."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-xl border border-border bg-card p-4",
                  tab === "received" && !item.is_read && "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {item.item_type}
                      </span>
                      {tab === "sent" || item.status === "ACCEPTED" ? (
                        <>
                          <Link
                            href={itemHref(item)}
                            className="truncate font-mono text-sm font-medium hover:text-primary"
                          >
                            {item.item_label}
                          </Link>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </>
                      ) : (
                        <span className="truncate font-mono text-sm font-medium">
                          {item.item_label}
                        </span>
                      )}
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          item.status === "ACCEPTED" && "bg-green-500/15 text-green-600 dark:text-green-400",
                          item.status === "REJECTED" && "bg-danger/15 text-danger",
                          item.status === "PENDING" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {item.status === "ACCEPTED"
                          ? "Aceptado"
                          : item.status === "REJECTED"
                            ? "Rechazado"
                            : "Pendiente"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tab === "received"
                        ? `De ${nameFor(item.sender_id)}`
                        : `Para ${nameFor(item.recipient_id)}`}{" "}
                      · {new Date(item.created_at).toLocaleString()}
                    </p>
                    {item.message && (
                      <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">{item.message}</p>
                    )}
                  </div>
                  {tab === "received" && item.status === "PENDING" && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" disabled={busy === item.id} onClick={() => accept(item)}>
                        <Check className="h-3.5 w-3.5" /> Aceptar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === item.id}
                        onClick={() => decline(item)}
                      >
                        <X className="h-3.5 w-3.5" /> Rechazar
                      </Button>
                    </div>
                  )}
                  {tab === "received" && item.status === "ACCEPTED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => router.push(itemHref(item))}
                    >
                      Ver copia
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
