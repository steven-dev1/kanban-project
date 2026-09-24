import { BoardWorkspace } from "@/components/board/board-workspace";
import { BoardProvider } from "@/providers/board-provider";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;

  return (
    <BoardProvider boardId={boardId}>
      <BoardWorkspace />
    </BoardProvider>
  );
}
