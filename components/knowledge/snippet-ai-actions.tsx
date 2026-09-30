"use client";

import { AiMenuItem, AiTextDialog, type AiTextRequest } from "@/components/knowledge/ai-dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dropdown } from "@/components/ui/dropdown";
import { aiDiagnose, aiExplain } from "@/lib/ai/client";
import { useKnowledge } from "@/providers/knowledge-provider";
import { FileText, Sparkles, Stethoscope } from "lucide-react";
import { useState } from "react";

export function SnippetAiActions({ snippetId }: { snippetId: string }) {
  const { snippets, updateSnippet, canEdit } = useKnowledge();
  const confirm = useConfirm();
  const [request, setRequest] = useState<AiTextRequest | null>(null);

  const snippet = snippets.find((item) => item.id === snippetId);
  if (!snippet) return null;

  function explain() {
    setRequest({
      title: `Explicar: ${snippet!.title}`,
      description: "Qué hace la consulta, tablas/objetos que usa y advertencias.",
      run: () =>
        aiExplain({
          code: snippet!.sql_code,
          objectName: snippet!.title,
          objectType: "SQL",
          schema: snippet!.schema_name ?? undefined,
        }),
    });
  }

  function diagnose() {
    setRequest({
      title: "Consulta de diagnóstico",
      description: "SQL sugerido para investigar el problema descrito.",
      renderAs: "code",
      applyLabel: canEdit ? "Usar como código" : undefined,
      onApply: canEdit
        ? async (text: string) => {
            const ok = await confirm({
              title: "Reemplazar consulta",
              message: "¿Reemplazar el SQL de esta consulta con el generado por la IA?",
              danger: true,
              confirmLabel: "Reemplazar",
            });
            if (!ok) return false;
            await updateSnippet(snippet!.id, { sql_code: text });
            return true;
          }
        : undefined,
      run: () =>
        aiDiagnose({
          problem: snippet!.description ?? snippet!.title,
          code: snippet!.sql_code,
          schema: snippet!.schema_name ?? undefined,
        }),
    });
  }

  return (
    <>
      <Dropdown
        trigger={
          <Button variant="outline" size="sm">
            <Sparkles className="h-4 w-4 text-primary" /> IA
          </Button>
        }
      >
        {(close) => (
          <div className="w-56">
            <AiMenuItem
              label="Explicar consulta"
              icon={<FileText className="h-4 w-4 text-primary" />}
              onClick={() => {
                close();
                explain();
              }}
            />
            <AiMenuItem
              label="Generar diagnóstico"
              icon={<Stethoscope className="h-4 w-4 text-primary" />}
              onClick={() => {
                close();
                diagnose();
              }}
            />
          </div>
        )}
      </Dropdown>

      <AiTextDialog request={request} onClose={() => setRequest(null)} />
    </>
  );
}
