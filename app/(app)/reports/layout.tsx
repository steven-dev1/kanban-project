import { KnowledgeProvider } from "@/providers/knowledge-provider";
import type { ReactNode } from "react";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <KnowledgeProvider>{children}</KnowledgeProvider>;
}
