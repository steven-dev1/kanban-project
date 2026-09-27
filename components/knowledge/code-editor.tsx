"use client";

import { TOKEN_CLASS, tokenizeLines } from "@/lib/knowledge/highlight";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef } from "react";

const INDENT = "  ";
const LINE_HEIGHT = 22; // leading-[22px]
const PADDING_Y = 8; // py-2

/**
 * Estilos tipográficos idénticos para la capa visible (<pre>) y el textarea
 * transparente. Si difieren en una sola propiedad (fuente, ligaduras, espaciado)
 * el cursor queda desfasado respecto al texto pintado.
 */
const CODE_TEXT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "13px",
  lineHeight: "22px",
  letterSpacing: "normal",
  wordSpacing: "normal",
  tabSize: 2,
  fontVariantLigatures: "none",
  fontFeatureSettings: "normal",
  fontKerning: "none",
  padding: `${PADDING_Y}px 12px`,
} as React.CSSProperties;

export function CodeEditor({
  value,
  onChange,
  placeholder,
  minLines = 8,
  maxHeight = 460,
  className,
  disabled,
  autoFocus,
  onSave,
  onFormat,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLines?: number;
  maxHeight?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Ctrl+S (close=false) / Ctrl+Enter (close=true). */
  onSave?: (options: { close: boolean }) => void;
  /** Shift+Alt+F. */
  onFormat?: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  // Aplica la posición del cursor después de que React actualice el valor.
  useEffect(() => {
    const sel = pendingSelection.current;
    if (sel && taRef.current) {
      taRef.current.selectionStart = sel.start;
      taRef.current.selectionEnd = sel.end;
      pendingSelection.current = null;
    }
  }, [value]);

  const lines = useMemo(() => tokenizeLines(value), [value]);
  const lineCount = Math.max(lines.length, minLines);
  const height = Math.min(
    lineCount * LINE_HEIGHT + PADDING_Y * 2,
    Math.max(maxHeight, minLines * LINE_HEIGHT + PADDING_Y * 2),
  );
  const gutterWidth = `${Math.max(2, String(lines.length).length)}ch`;

  const sync = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    // Se desplaza el contenido del <pre> con transform: es más fiable que
    // asignar scrollTop/scrollLeft a un elemento con overflow:hidden y evita
    // que el texto visible se desincronice del cursor al hacer scroll.
    if (codeRef.current) {
      codeRef.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  }, []);

  // Listener nativo: onScroll de React puede llegar con retraso y desincronizar
  // el texto visible respecto al cursor. Un listener directo es inmediato.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const onScroll = () => sync();
    ta.addEventListener("scroll", onScroll, { passive: true });
    return () => ta.removeEventListener("scroll", onScroll);
  }, [sync]);

  useEffect(() => {
    sync();
  }, [value, sync]);

  const applyChange = (next: string, selection: { start: number; end: number }) => {
    pendingSelection.current = selection;
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const ta = taRef.current;
    if (!ta) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      onSave?.({ close: false });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSave?.({ close: true });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      onFormat?.();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.key === "7")) {
      e.preventDefault();
      toggleLineComment(ta);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: start, selectionEnd: end } = ta;
      if (start === end) {
        const next = value.slice(0, start) + INDENT + value.slice(end);
        applyChange(next, { start: start + INDENT.length, end: start + INDENT.length });
        return;
      }
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const blockLines = block.split("\n");
      const newBlock = e.shiftKey
        ? blockLines
            .map((l) => (l.startsWith(INDENT) ? l.slice(INDENT.length) : l.replace(/^ {1,2}/, "")))
            .join("\n")
        : blockLines.map((l) => INDENT + l).join("\n");
      const next = value.slice(0, lineStart) + newBlock + value.slice(end);
      applyChange(next, { start: lineStart, end: lineStart + newBlock.length });
      return;
    }

    if (e.key === "Enter") {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      let indent = (currentLine.match(/^\s*/) ?? [""])[0];
      const trimmed = currentLine.trimEnd().toUpperCase();
      if (/\b(BEGIN|THEN|LOOP|IS|AS|DECLARE|ELSE|EXCEPTION)$/.test(trimmed)) {
        indent += INDENT;
      }
      e.preventDefault();
      const insert = `\n${indent}`;
      const next = value.slice(0, start) + insert + value.slice(end);
      applyChange(next, { start: start + insert.length, end: start + insert.length });
      return;
    }

    if (e.key === "}" || e.key === ")") return; // por si se agrega auto-cierre luego
  };

  /** Comenta o descomenta las líneas seleccionadas con `--`. */
  const toggleLineComment = (ta: HTMLTextAreaElement) => {
    const { selectionStart: start, selectionEnd: end, value: text } = ta;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = text.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
    const block = text.slice(lineStart, lineEnd);
    const blockLines = block.split("\n");
    const allCommented = blockLines.every((l) => /^\s*--/.test(l));
    const nextBlock = blockLines
      .map((line) =>
        allCommented ? line.replace(/^(\s*)--\s?/, "$1") : line.replace(/^(\s*)/, "$1-- "),
      )
      .join("\n");
    const next = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd);
    applyChange(next, { start: lineStart, end: lineStart + nextBlock.length });
  };

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-lg border border-input bg-slate-50 font-mono text-[13px] leading-[22px] text-slate-800 dark:bg-[#0b1020] dark:text-slate-100",
        disabled && "opacity-60",
        className,
      )}
      style={{ height }}
    >
      <div
        ref={gutterRef}
        className="shrink-0 overflow-hidden border-r border-slate-200 bg-slate-100 text-right text-slate-400 select-none dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-600"
        style={{ ...CODE_TEXT_STYLE, width: `calc(${gutterWidth} + 1.5rem)` }}
        aria-hidden
      >
        {lines.map((_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden
          style={CODE_TEXT_STYLE}
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden"
        >
          <code
            ref={codeRef}
            className="block w-max whitespace-pre"
            style={{ font: "inherit", willChange: "transform" }}
          >
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
            {value.endsWith("\n") && <span className="block">{"\u00a0"}</span>}
          </code>
        </pre>

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          wrap="off"
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          style={CODE_TEXT_STYLE}
          className="relative block h-full w-full resize-none overflow-auto border-0 bg-transparent whitespace-pre text-transparent caret-slate-900 outline-none placeholder:text-slate-400 dark:caret-white dark:placeholder:text-slate-500"
        />
      </div>
    </div>
  );
}
