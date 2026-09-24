"use client";

import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function Notifications({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as AppNotification[]) ?? []);
  }, [supabase, userId]);

  useEffect(() => {
    queueMicrotask(() => load());
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: AppNotification }) => {
          setItems((prev) => [payload.new, ...prev].slice(0, 30));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const unread = items.filter((n) => !n.is_read).length;

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function respond(n: AppNotification, accept: boolean) {
    const invitationId = n.metadata?.invitation_id as string | undefined;
    setBusy(n.id);
    if (invitationId) {
      const { data, error } = accept
        ? await supabase.rpc("accept_invitation", { p_invitation_id: invitationId })
        : { data: null, error: null };
      if (!accept) {
        await supabase.rpc("decline_invitation", { p_invitation_id: invitationId });
      }
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setBusy(null);
      if (accept && !error && data) {
        router.push(`/boards/${data}`);
        return;
      }
      router.refresh();
      return;
    }
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setBusy(null);
    router.refresh();
  }

  return (
    <Dropdown
      panelClassName="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      trigger={
        <button
          className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      }
    >
      {() => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-sm font-semibold">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No tienes notificaciones
              </p>
            )}
            {items.map((n) => {
              const isInvite =
                n.type === "board_invite" && !!n.metadata?.invitation_id;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border px-3 py-3 last:border-0",
                    !n.is_read && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                      {isInvite && (
                        <div className="mt-2 flex gap-2">
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
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
