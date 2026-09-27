"use client";

import { Avatar } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { CardWithLabels, Profile } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useBoard } from "@/providers/board-provider";
import { History, MessageSquare, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

function renderMentions(body: string, people: { id: string; label: string }[]) {
  const byLabel = new Map(people.map((p) => [`@${p.label.split(" ")[0].toLowerCase()}`, p.label]));
  return body.split(/(@\w+)/g).map((part, index) => {
    if (part.startsWith("@") && byLabel.has(part.toLowerCase())) {
      return (
        <span key={index} className="rounded bg-primary/10 px-1 font-medium text-primary">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function CardComments({ card, canEdit }: { card: CardWithLabels; canEdit: boolean }) {
  const { commentsFor, addComment, deleteComment, activityFor, members, ownerProfile, board } =
    useBoard();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);

  const people = useMemo(() => {
    const list: { id: string; label: string; profile: Profile | null }[] = [];
    if (board) list.push({ id: board.owner_id, label: ownerProfile?.full_name || ownerProfile?.email || "Propietario", profile: ownerProfile });
    for (const m of members) {
      if (!list.some((p) => p.id === m.user_id)) {
        list.push({ id: m.user_id, label: m.profile?.full_name || m.profile?.email || "Usuario", profile: m.profile });
      }
    }
    return list;
  }, [board, ownerProfile, members]);

  const comments = commentsFor(card.id);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    // Menciones: busca @Nombre o @email de la gente del tablero.
    const mentioned = people
      .filter((p) => {
        const handle = p.label.split(" ")[0].toLowerCase();
        return new RegExp(`@${handle}\\b`, "i").test(text) || text.includes(`@${p.label}`);
      })
      .map((p) => p.id);
    setSending(true);
    try {
      await addComment(card.id, text, mentioned);
      setBody("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo comentar", "error");
    } finally {
      setSending(false);
    }
  };

  const activity = activityFor(card.id);
  const actorName = (id: string | null) =>
    people.find((p) => p.id === id)?.label ?? "Usuario";

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Comentarios ({comments.length})
        </label>

        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <Avatar
                  name={people.find((p) => p.id === comment.author_id)?.label}
                  size={20}
                />
                <span className="text-xs font-medium">
                  {people.find((p) => p.id === comment.author_id)?.label ?? "Usuario"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(comment.created_at)}
                </span>
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="ml-auto rounded p-1 text-muted-foreground hover:text-danger"
                  title="Eliminar comentario"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                {renderMentions(comment.body, people)}
              </p>
            </li>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin comentarios todavía.</p>
          )}
        </ul>

        {canEdit && (
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <textarea
                value={body}
                rows={2}
                onChange={(e) => {
                  setBody(e.target.value);
                  setShowMentions(/@\w*$/.test(e.target.value));
                }}
                placeholder="Escribe un comentario… usa @ para mencionar"
                className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none"
              />
              {showMentions && people.length > 0 && (
                <div className="absolute bottom-full mb-1 max-h-40 w-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
                  {people.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setBody((prev) => prev.replace(/@\w*$/, `@${p.label.split(" ")[0]} `));
                        setShowMentions(false);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted"
                    >
                      <Avatar name={p.label} size={16} /> {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="sm"
              onClick={submit}
              disabled={sending || !body.trim()}
              className="w-fit"
            >
              <Send className="h-3.5 w-3.5" /> {sending ? "Enviando…" : "Comentar"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Actividad
        </label>
        <ul className="flex flex-col gap-1.5">
          {activity.map((event) => (
            <li key={event.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar name={actorName(event.actor_id)} size={16} />
              <span className="text-foreground">{actorName(event.actor_id)}</span>
              <span className="truncate">{event.detail ?? event.action}</span>
              <span className="ml-auto shrink-0 text-[10px]">{formatDate(event.created_at)}</span>
            </li>
          ))}
          {activity.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin actividad registrada.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
