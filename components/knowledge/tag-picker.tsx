"use client";

import { TagChip } from "@/components/knowledge/ui";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { TAG_COLORS } from "@/lib/knowledge/constants";
import type { KnowledgeTag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useKnowledge } from "@/providers/knowledge-provider";
import { Plus, Tag as TagIcon } from "lucide-react";
import { useState } from "react";

export function TagPicker({
  assigned,
  onToggle,
  canEdit,
}: {
  assigned: KnowledgeTag[];
  onToggle: (tagId: string, active: boolean) => void;
  canEdit: boolean;
}) {
  const { tags, createTag, deleteTag, isAdmin } = useKnowledge();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  const assignedIds = new Set(assigned.map((t) => t.id));
  const available = tags.filter((t) => !assignedIds.has(t.id));

  const handleCreate = async (close: () => void) => {
    if (!newName.trim()) return;
    try {
      const tag = await createTag(newName.trim(), newColor);
      if (tag) onToggle(tag.id, true);
      setNewName("");
      toast("Etiqueta creada");
      close();
    } catch (error) {
      toast(
        error instanceof Error && error.message.includes("duplicate")
          ? "Ya existe una etiqueta con ese nombre"
          : error instanceof Error
            ? error.message
            : "Error",
        "error",
      );
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {assigned.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          onRemove={canEdit ? () => onToggle(tag.id, false) : undefined}
        />
      ))}

      {canEdit && (
        <Dropdown
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Etiqueta
            </button>
          }
        >
          {(close) => (
            <div className="w-64">
              <div className="max-h-48 overflow-y-auto">
                {available.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    No hay etiquetas disponibles.
                  </p>
                )}
                {available.map((tag) => (
                  <div key={tag.id} className="group flex items-center">
                    <DropdownItem
                      onClick={() => {
                        onToggle(tag.id, true);
                        close();
                      }}
                      className="flex-1"
                    >
                      <TagIcon className="h-3.5 w-3.5" style={{ color: tag.color }} />
                      <span className="flex-1 truncate">{tag.name}</span>
                    </DropdownItem>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => deleteTag(tag.id).catch((e) => toast(e.message, "error"))}
                        className="mr-1 rounded px-1.5 py-1 text-[10px] text-muted-foreground opacity-0 hover:text-danger group-hover:opacity-100"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-1 border-t border-border pt-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input bg-transparent"
                    aria-label="Color de etiqueta"
                  />
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate(close);
                    }}
                    placeholder="Nueva etiqueta"
                    className="h-7 flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreate(close)}
                    className={cn(
                      "rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground",
                      !newName.trim() && "opacity-50",
                    )}
                  >
                    Crear
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dropdown>
      )}
    </div>
  );
}
