"use client";

import { copyText, downloadTextFile, sanitizeFileName } from "@/lib/knowledge/format";
import { TOKEN_CLASS, tokenizeLines } from "@/lib/knowledge/highlight";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

export function CodeBlock({
  value,
  title,
  fileName,
  editable = false,
  onChange,
  maxHeight = 460,
  className,
  actions,
}: {
  value: string;
  title?: string;
  fileName?: string;
  editable?: boolean;
  onChange?: (value: string) => Promise<void> | void;
  maxHeight?: number;
  className?: string;
  actions?: React.ReactNode;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const displayCode = editing ? draft : value;
  const lines = useMemo(() => tokenizeLines(displayCode), [displayCode]);

  const handleCopy = async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast("No se pudo copiar al portapapeles", "error");
    }
  };

  const handleDownload = () => {
    if (!fileName) return;
    downloadTextFile(fileName, value, "text/plain");
  };

  const handleSave = async () => {
    if (!onChange) return;
    setSaving(true);
    try {
      await onChange(draft);
      setEditing(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-[#0b1020] text-slate-100 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-slate-300">
            {title ?? "Código"}
          </span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
            {lines.length} {lines.length === 1 ? "línea" : "líneas"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {editable && !editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(value);
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </button>
          {fileName && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" /> Descargar
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Contraer
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> Expandir
              </>
            )}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="h-[420px] w-full resize-y bg-transparent p-4 font-mono text-[12.5px] leading-5 text-slate-100 outline-none"
        />
      ) : (
        <div
          className="overflow-auto"
          style={{ maxHeight: expanded ? undefined : maxHeight }}
        >
          <pre className="m-0 flex min-w-full font-mono text-[12.5px] leading-5">
            <code className="shrink-0 select-none border-r border-white/10 px-3 py-3 text-right text-slate-600">
              {lines.map((_, index) => (
                <span key={index} className="block">
                  {index + 1}
                </span>
              ))}
            </code>
            <code className="flex-1 px-4 py-3 whitespace-pre">
              {lines.map((tokens, index) => (
                <span key={index} className="block">
                  {tokens.length === 0 ? (
                    "\u00a0"
                  ) : (
                    tokens.map((token, tokenIndex) => (
                      <span key={tokenIndex} className={TOKEN_CLASS[token.kind]}>
                        {token.text}
                      </span>
                    ))
                  )}
                </span>
              ))}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

export function CodeBlockActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>;
}

export { sanitizeFileName };
