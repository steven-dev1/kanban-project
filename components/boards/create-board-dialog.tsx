"use client";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { toDatabaseError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/client";
import { LIST_COLORS } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DEFAULT_LISTS = ["Pendiente", "En progreso", "Hecho"];

interface TemplateOption {
  id: string;
  title: string;
}

/** Copia listas, etiquetas, campos y tarjetas de una plantilla a un tablero nuevo. */
async function cloneTemplate(
  supabase: ReturnType<typeof createClient>,
  templateId: string,
  newBoardId: string,
) {
  const { data: lists } = await supabase
    .from("lists")
    .select("*")
    .eq("board_id", templateId)
    .order("position");
  const { data: labels } = await supabase.from("labels").select("*").eq("board_id", templateId);
  const { data: fields } = await supabase
    .from("board_fields")
    .select("*")
    .eq("board_id", templateId)
    .order("position");
  const { data: cards } = await supabase
    .from("cards")
    .select("*, card_labels(label_id)")
    .eq("board_id", templateId);

  const labelMap = new Map<string, string>();
  for (const label of labels ?? []) {
    const id = crypto.randomUUID();
    labelMap.set(label.id, id);
    await supabase
      .from("labels")
      .insert({ id, board_id: newBoardId, name: label.name, color: label.color });
  }
  for (const field of fields ?? []) {
    await supabase.from("board_fields").insert({
      board_id: newBoardId,
      name: field.name,
      field_type: field.field_type,
      options: field.options,
      position: field.position,
    });
  }
  const listMap = new Map<string, string>();
  for (const list of lists ?? []) {
    const id = crypto.randomUUID();
    listMap.set(list.id, id);
    await supabase.from("lists").insert({
      id,
      board_id: newBoardId,
      title: list.title,
      color: list.color,
      position: list.position,
    });
  }
  for (const card of cards ?? []) {
    const targetList = listMap.get(card.list_id);
    if (!targetList) continue;
    const id = crypto.randomUUID();
    await supabase.from("cards").insert({
      id,
      board_id: newBoardId,
      list_id: targetList,
      title: card.title,
      description: card.description,
      position: card.position,
    });
    const links = (card.card_labels ?? [])
      .map((cl: { label_id: string }) => labelMap.get(cl.label_id))
      .filter((v: string | undefined): v is string => Boolean(v));
    if (links.length > 0) {
      await supabase
        .from("card_labels")
        .insert(links.map((labelId: string) => ({ card_id: id, label_id: labelId })));
    }
  }
}

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
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("__none__");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const supabase = createClient();
    supabase
      .from("boards")
      .select("id, title")
      .eq("is_template", true)
      .order("updated_at", { ascending: false })
      .then((res: { data: unknown }) => {
        if (active) setTemplates((res.data as TemplateOption[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [open]);

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
        setError(toDatabaseError(error).message);
        return;
      }

      if (templateId !== "__none__") {
        await cloneTemplate(supabase, templateId, boardId);
      } else {
        await supabase.from("lists").insert(
          DEFAULT_LISTS.map((name, index) => ({
            board_id: boardId,
            title: name,
            color: LIST_COLORS[index % LIST_COLORS.length].value,
            position: (index + 1) * 1000,
          })),
        );
      }

      setTitle("");
      setDescription("");
      setTemplateId("__none__");
      onClose();
      onCreated?.();
      toast("Tablero creado");
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
        {templates.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Empezar desde plantilla</label>
            <Select
              value={templateId}
              onChange={setTemplateId}
              options={[
                { value: "__none__", label: "Tablero vacío (listas por defecto)" },
                ...templates.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
          </div>
        )}
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
