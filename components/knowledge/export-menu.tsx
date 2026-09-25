"use client";

import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { copyText, downloadTextFile } from "@/lib/knowledge/format";
import { Copy, Download, FileCode2 } from "lucide-react";
import type { ReactNode } from "react";

export interface ExportAction {
  label: string;
  content: string;
  /** When set the action downloads a file; otherwise it copies to the clipboard. */
  fileName?: string;
}

export function ExportMenu({
  actions,
  label = "Exportar",
  trigger,
  className,
}: {
  actions: ExportAction[];
  label?: string;
  trigger?: ReactNode;
  className?: string;
}) {
  const { toast } = useToast();

  const run = async (action: ExportAction) => {
    if (action.fileName) {
      downloadTextFile(action.fileName, action.content, "text/plain");
      toast(`Exportado: ${action.fileName}`);
      return;
    }
    const ok = await copyText(action.content);
    toast(ok ? "Código copiado" : "No se pudo copiar", ok ? "success" : "error");
  };

  if (actions.length === 0) return null;

  return (
    <Dropdown
      className={className}
      trigger={
        trigger ?? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> {label}
          </button>
        )
      }
    >
      {() => (
        <div>
          {actions.map((action) => (
            <DropdownItem key={action.label} onClick={() => run(action)}>
              {action.fileName ? (
                <>
                  <FileCode2 className="h-4 w-4 text-muted-foreground" />
                  {action.label}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  {action.label}
                </>
              )}
            </DropdownItem>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
