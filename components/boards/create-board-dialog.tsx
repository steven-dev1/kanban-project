"use client";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { LIST_COLORS } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DEFAULT_LISTS = ["Pendiente", "En progreso", "Hecho"];

export function CreateBoardDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sesión expirada");
        return;
      }

      // Generamos el id en el cliente para no usar RETURNING: la política SELECT
      // de boards llama a is_board_member(), que no ve la fila recién insertada.
      const boardId = crypto.randomUUID();
      const { error } = await supabase.from("boards").insert({
        id: boardId,
        title: title.trim(),
        description: description.trim() || null,
        owner_id: user.id,
      });

      if (error) {
        setError(error.message);
        return;
      }

      await supabase.from("lists").insert(
        DEFAULT_LISTS.map((name, index) => ({
          board_id: boardId,
          title: name,
          color: LIST_COLORS[index % LIST_COLORS.length].value,
          position: (index + 1) * 1000,
        })),
      );

      setTitle("");
      setDescription("");
      onClose();
      onCreated?.();
      router.push(`/boards/${boardId}`);
      router.refresh();
    } catch (err) {
      console.error("[create-board] error:", err);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo tablero">
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Título</label>
          <Input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Proyecto web"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Descripción (opcional)</label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿De qué se trata este tablero?"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creando..." : "Crear tablero"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
