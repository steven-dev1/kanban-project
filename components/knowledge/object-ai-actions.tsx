"use client";

import {
  AiDocumentDialog,
  AiMenuItem,
  AiTextDialog,
  type AiDocumentRequest,
  type AiTextRequest,
} from "@/components/knowledge/ai-dialog";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { aiDocument, aiExplain, aiSummarize } from "@/lib/ai/client";
import type { SourceType } from "@/lib/types";
import { useKnowledge } from "@/providers/knowledge-provider";
import { BookOpen, FileText, ScrollText, Sparkles } from "lucide-react";
import { useState } from "react";

const ROUTINE_TYPES = ["PACKAGE", "PROCEDURE", "FUNCTION", "TRIGGER"];

export function ObjectAiActions({ objectId }: { objectId: string }) {
  const { objects, updateObject, canEdit } = useKnowledge();
  const [textRequest, setTextRequest] = useState<AiTextRequest | null>(null);
  const [docRequest, setDocRequest] = useState<AiDocumentRequest | null>(null);

  const object = objects.find((item) => item.id === objectId);
  if (!object) return null;

  const latestFor = (type: SourceType) =>
    object.code_versions
      .filter((version) => version.source_type === type)
      .sort((a, b) => b.version_number - a.version_number)[0];

  const source = latestFor("SOURCE")?.source_code ?? "";
  const specification = latestFor("SPECIFICATION")?.source_code ?? "";
  const body = latestFor("BODY")?.source_code ?? "";
  const combined =
    [specification, body].filter(Boolean).join("\n\n/\n\n") || source;
  const hasCode = combined.trim().length > 0;
  const isRoutine = ROUTINE_TYPES.includes(object.object_type);

  function explain() {
    setTextRequest({
      title: `Explicar ${object!.object_name}`,
      description: "Propósito, lógica paso a paso, objetos usados y riesgos.",
      run: () =>
        aiExplain({
          code: combined || object!.description || "",
          objectName: object!.object_name,
          schema: object!.schema_name,
          objectType: object!.object_type,
        }),
    });
  }

  function summarize() {
    setTextRequest({
      title: `Resumir ${object!.object_name}`,
      description: "Resumen general, rutinas/parámetros y dependencias.",
      run: () =>
        aiSummarize({
          code: combined,
          objectName: object!.object_name,
          schema: object!.schema_name,
          objectType: object!.object_type,
        }),
    });
  }

  function document() {
    setDocRequest({
      title: `Documentar ${object!.object_name}`,
      run: () =>
        aiDocument({
          objectName: object!.object_name,
          schema: object!.schema_name,
          objectType: object!.object_type,
          description: object!.description ?? undefined,
          columns: object!.columns.map((column) => ({
            name: column.column_name,
            dataType: column.data_type,
            description: column.description ?? column.business_meaning,
          })),
          code: combined || undefined,
        }),
      onApply: canEdit
        ? async (values) => {
            await updateObject(object!.id, {
              description: values.description,
              functional_description: values.functional_description,
            });
          }
        : undefined,
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
              label="Explicar código"
              icon={<FileText className="h-4 w-4 text-primary" />}
              disabled={!hasCode}
              onClick={() => {
                close();
                explain();
              }}
            />
            <AiMenuItem
              label="Generar documentación"
              icon={<BookOpen className="h-4 w-4 text-primary" />}
              onClick={() => {
                close();
                document();
              }}
            />
            <AiMenuItem
              label={`Resumir ${isRoutine ? "rutina" : "objeto"}`}
              icon={<ScrollText className="h-4 w-4 text-primary" />}
              disabled={!hasCode || !isRoutine}
              onClick={() => {
                close();
                summarize();
              }}
            />
          </div>
        )}
      </Dropdown>

      <AiTextDialog request={textRequest} onClose={() => setTextRequest(null)} />
      <AiDocumentDialog request={docRequest} onClose={() => setDocRequest(null)} />
    </>
  );
}
