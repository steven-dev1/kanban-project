import { BoardsDashboard } from "@/components/boards/boards-dashboard";
import { Suspense } from "react";

export default function BoardsPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-muted-foreground">Cargando...</div>}
    >
      <BoardsDashboard />
    </Suspense>
  );
}
