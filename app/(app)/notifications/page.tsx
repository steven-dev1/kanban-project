"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { Bell, Check, CheckCheck, Inbox, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as AppNotification[]) ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    queueMicrotask(() => load());
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const unread = items.filter((n) => !n.is_read).length;
  const filtered = filter === "unread" ? items.filter((n) => !n.is_read) : items;

  async function markRead(n: AppNotification) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function removeNotification(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function respond(n: AppNotification, accept: boolean) {
    const invitationId = n.metadata?.invitation_id as string | undefined;
    const sharedId = n.metadata?.shared_item_id as string | undefined;
    setBusy(n.id);

    try {
      if (sharedId) {
        const itemType = n.metadata?.item_type as string | undefined;
        if (accept) {
          const { data, error } = await supabase.rpc("accept_shared_item", { p_id: sharedId });
          if (error) throw new Error(error.message);
          await removeNotification(n.id);
          if (data) {
            router.push(
              itemType === "SNIPPET" ? `/knowledge/sql/${data}` : `/knowledge/objects/${data}`,
            );
          }
        } else {
          const { error } = await supabase.rpc("decline_shared_item", { p_id: sharedId });
          if (error) throw new Error(error.message);
          await removeNotification(n.id);
        }
        return;
      }

      if (invitationId) {
        if (accept) {
          const { data, error } = await supabase.rpc("accept_invitation", {
            p_invitation_id: invitationId,
          });
          if (error) throw new Error(error.message);
          await removeNotification(n.id);
          if (data) router.push(`/boards/${data}`);
        } else {
          const { error } = await supabase.rpc("decline_invitation", {
            p_invitation_id: invitationId,
          });
          if (error) throw new Error(error.message);
          await removeNotification(n.id);
        }
        return;
      }

      await removeNotification(n.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo completar la acción", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              {unread} sin leer de {items.length}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5 text-xs">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1",
                  filter === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={cn(
                  "rounded-md px-2.5 py-1",
                  filter === "unread" ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                Sin leer
              </button>
            </div>
            {unread > 0 && (
              <Button size="sm" variant="outline" onClick={markAllRead}>
                <CheckCheck className="h-3.5 w-3.5" /> Marcar todas leídas
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
            <Bell className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {filter === "unread" ? "No tienes notificaciones sin leer." : "No tienes notificaciones."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((n) => {
              const isInvite = n.type === "board_invite" && !!n.metadata?.invitation_id;
              const isShared = n.type === "item_shared";
              return (
                <li
                  key={n.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-4",
                    !n.is_read && "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      {isShared ? (
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Bell className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" aria-label="Sin leer" />
                        )}
                      </div>
                      {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(isInvite || isShared) && (
                          <>
                            <Button
                              size="sm"
                              disabled={busy === n.id}
                              onClick={() => respond(n, true)}
                            >
                              <Check className="h-3.5 w-3.5" /> Aceptar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === n.id}
                              onClick={() => respond(n, false)}
                            >
                              <X className="h-3.5 w-3.5" /> Rechazar
                            </Button>
                          </>
                        )}
                        {isShared && (
                          <Button size="sm" variant="ghost" onClick={() => router.push("/messages")}>
                            <Inbox className="h-3.5 w-3.5" /> Ver en Mensajes
                          </Button>
                        )}
                        {!n.is_read && !isInvite && !isShared && (
                          <Button size="sm" variant="ghost" onClick={() => markRead(n)}>
                            Marcar como leída
                          </Button>
                        )}
                      </div>
                    </div>
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
