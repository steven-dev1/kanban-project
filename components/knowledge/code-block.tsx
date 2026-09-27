"use client";

import { copyText, downloadTextFile, sanitizeFileName } from "@/lib/knowledge/format";
import { formatSql } from "@/lib/knowledge/format-sql";
import { TOKEN_CLASS, tokenizeLines } from "@/lib/knowledge/highlight";
import { validateOracleCode } from "@/lib/knowledge/validate";
import { CodeEditor } from "@/components/knowledge/code-editor";
import { SyntaxReport, SyntaxStatusChip, useValidation } from "@/components/knowledge/syntax-report";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Maximize2,
  Minimize2,
  Pencil,
  Save,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  const [fullscreen, setFullscreen] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const dirty = editing && savedCode !== draft;

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const displayCode = editing ? draft : value;
  const validation = useValidation(displayCode);
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

  const persist = async (code: string, opts?: { force?: boolean }): Promise<boolean> => {
    if (!onChange) return false;
    if (savedCode === code) return true;
    const result = validateOracleCode(code);
    if (!opts?.force && result.errors.length > 0) {
      toast("Corrige los errores de sintaxis antes de guardar", "error");
      setShowValidation(true);
      return false;
    }
    setSaving(true);
    try {
      await onChange(code);
      setSavedCode(code);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo guardar", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    const ok = await persist(draft);
    if (ok) setEditing(false);
    return ok;
  };

  const handleSaveDraft = async () => {
    await persist(draft, { force: true });
  };

  // Autoguardado de borrador: si dejas de escribir 1.5s y el código no tiene
  // errores, se guarda solo. Los errores deben corregirse a mano.
  useEffect(() => {
    if (!editing || !onChange) return;
    if (savedCode === draft) return;
    if (validateOracleCode(draft).errors.length > 0) return;
    const id = window.setTimeout(() => {
      persist(draft);
    }, 1500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, editing, onChange, savedCode]);

  return (
    <div
      className={cn(
        fullscreen
          ? "fixed inset-0 z-[60] flex flex-col rounded-none border border-border bg-slate-50 text-slate-800 shadow-none dark:bg-[#0b1020] dark:text-slate-100"
          : "overflow-hidden rounded-xl border border-border bg-slate-50 text-slate-800 shadow-sm dark:bg-[#0b1020] dark:text-slate-100",
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 dark:border-white/10 dark:bg-[#0f1424]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
            {title ?? "Código"}
          </span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {lines.length} {lines.length === 1 ? "línea" : "líneas"}
          </span>
          <SyntaxStatusChip result={validation} className="bg-slate-200 dark:bg-white/10" />
          {dirty ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              Sin guardar
            </span>
          ) : (
            editing &&
            onChange && (
              <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                Borrador guardado
              </span>
            )
          )}
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
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={() => setDraft(formatSql(draft))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                title="Formatear SQL"
              >
                <Wand2 className="h-3.5 w-3.5" /> Formatear
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || validation.errors.length > 0}
                title={
                  validation.errors.length > 0
                    ? "Corrige los errores de sintaxis para guardar"
                    : "Guardar (Ctrl+S · Ctrl+Enter)"
                }
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                title="Guardar como borrador sin validar sintaxis"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <FileText className="h-3.5 w-3.5" /> Borrador
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(value);
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> Copiado
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
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" /> Descargar
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
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
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" /> Salir
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" /> Pantalla completa
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowValidation((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
            title="Validar sintaxis"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Validar
          </button>
        </div>
      </div>

      {showValidation && (
        <div className="border-b border-slate-200 p-2 dark:border-white/10">
          <SyntaxReport result={validation} />
        </div>
      )}

      {editing ? (
        <CodeEditor
          value={draft}
          onChange={setDraft}
          minLines={14}
          maxHeight={fullscreen ? 4000 : 460}
          autoFocus
          onFormat={() => setDraft(formatSql(draft))}
          onSave={({ close }) => {
            void handleSave().then((ok) => {
              if (ok && close) setEditing(false);
            });
          }}
        />
      ) : (
        <div
          className={cn("overflow-auto", fullscreen && "min-h-0 flex-1")}
          style={{ maxHeight: fullscreen ? undefined : expanded ? undefined : maxHeight }}
        >
          <pre className="m-0 flex min-w-full font-mono text-[12px] leading-5">
            <code className="sticky left-0 z-[1] shrink-0 select-none border-r border-slate-200 bg-slate-50 px-2.5 py-3 text-right text-slate-400 dark:border-white/10 dark:bg-[#0b1020] dark:text-slate-600">
              {lines.map((_, index) => (
                <span key={index} className="block">
                  {index + 1}
                </span>
              ))}
            </code>
            <code className="flex-1 px-3.5 py-3 whitespace-pre">
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
