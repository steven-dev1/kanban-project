import { KnowledgeTopbar } from "@/components/knowledge/knowledge-topbar";
import { KnowledgeProvider } from "@/providers/knowledge-provider";
import type { ReactNode } from "react";

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
  return (
    <KnowledgeProvider>
      <div className="flex h-full flex-col">
        <KnowledgeTopbar />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </KnowledgeProvider>
  );
}
