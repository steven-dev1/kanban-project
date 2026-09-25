"use client";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useBoard } from "@/providers/board-provider";
import { Archive, ArchiveRestore, ListTree, Trash2 } from "lucide-react";

export function ArchivePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    archivedLists,
    archivedCards,
    archiveList,
    archiveCard,
    deleteList,
    deleteCard,
  } = useBoard();
  const confirm = useConfirm();
  const { toast } = useToast();

  async function restoreList(id: string) {
    await archiveList(id, false);
    toast("Lista restaurada");
  }

  async function removeList(id: string, title: string) {
    const ok = await confirm({
      title: "Eliminar lista",
      message: `¿Eliminar permanentemente "${title}"?`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    await deleteList(id);
    toast("Lista eliminada");
  }

  async function restoreCard(id: string) {
    await archiveCard(id, false);
    toast("Card restaurada");
  }

  async function removeCard(id: string) {
    const ok = await confirm({
      title: "Eliminar card",
      message: "¿Eliminar permanentemente esta card?",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    await deleteCard(id);
    toast("Card eliminada");
  }

  return (
    <Modal open={open} onClose={onClose} title="Archivados" size="lg">
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ListTree className="h-4 w-4" /> Listas archivadas ({archivedLists.length})
          </h3>
          {archivedLists.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
              No hay listas archivadas
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {archivedLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: list.color ?? "#94a3b8" }}
                  />
                  <span className="flex-1 truncate text-sm font-medium">{list.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreList(list.id)}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeList(list.id, list.title)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Archive className="h-4 w-4" /> Cards archivadas ({archivedCards.length})
          </h3>
          {archivedCards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
              No hay cards archivadas
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {archivedCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="flex-1 truncate text-sm">{card.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreCard(card.id)}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeCard(card.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
