"use client";

import { Button } from "@/components/ui/button";
import { ExportMenu, type ExportVariant } from "@/components/knowledge/export-menu";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/knowledge/export";
import { tokenizeLines, type TokenKind } from "@/lib/knowledge/highlight";
import { Check, ChevronsDownUp, ChevronsUpDown, Copy, Pencil } from "lucide-react";
import { useMemo, useState } from "react";

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: "text-muted-foreground italic",
  string: "text-green-600 dark:text-green-400",
  number: "text-amber-600 dark:text-amber-400",
  keyword: "text-indigo-600 dark:text-indigo-400 font-semibold",
  builtin: "text-sky-600 dark:text-sky-400",
  identifier: "text-foreground",
  operator: "text-pink-600 dark:text-pink-400",
  plain: "text-foreground",
};

export function CodeBlock({
  code,
  title,
  maxHeight = 420,
  variants,
  onEdit,
  emptyLabel = "Sin código registrado",
  className,
}: {
  code: string;
  title?: string;
  maxHeight?: number;
  variants?: ExportVariant[];
  onEdit?: () => void;
  emptyLabel?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => tokenizeLines(code ?? ""), [code]);
  const overflow = lines.length > 18;

  async function handleCopy() {
    const ok = await copyText(code ?? "");
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  if (!code) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {title ?? "SQL / PLSQL"}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </Button>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
          {variants && variants.length > 0 && <ExportMenu variants={variants} />}
          {overflow && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Contraer" : "Expandir"}
            >
              {expanded ? (
                <ChevronsDownUp className="h-4 w-4" />
              ) : (
                <ChevronsUpDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      <div
        className="overflow-auto bg-muted/20"
        style={{ maxHeight: expanded ? "70vh" : maxHeight }}
      >
        <div className="min-w-full font-mono text-xs leading-5">
          {lines.map((tokens, index) => (
            <div
              key={index}
              className="grid grid-cols-[3.25rem_1fr] hover:bg-muted/40"
            >
              <span className="select-none pr-3 text-right text-muted-foreground/60 tabular-nums">
                {index + 1}
              </span>
              <pre className="pr-4 whitespace-pre">
                {tokens.length === 0 ? (
                  <span> </span>
                ) : (
                  tokens.map((token, tokenIndex) => (
                    <span key={tokenIndex} className={TOKEN_CLASS[token.kind]}>
                      {token.value}
                    </span>
                  ))
                )}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
