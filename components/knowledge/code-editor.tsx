"use client";

import { TOKEN_CLASS, tokenizeLines } from "@/lib/knowledge/highlight";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef } from "react";

const INDENT = "  ";
const LINE_HEIGHT = 22; // leading-[22px]
const PADDING_Y = 8; // py-2

export function CodeEditor({
  value,
  onChange,
  placeholder,
  minLines = 8,
  maxHeight = 460,
  className,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLines?: number;
  maxHeight?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
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

  const sync = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const applyChange = (next: string, selection: { start: number; end: number }) => {
    pendingSelection.current = selection;
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const ta = taRef.current;
    if (!ta) return;

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

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-lg border border-input bg-[#0b1020] font-mono text-[13px] leading-[22px]",
        disabled && "opacity-60",
        className,
      )}
      style={{ height }}
    >
      <div
        ref={gutterRef}
        className="shrink-0 overflow-hidden border-r border-white/10 bg-white/[0.02] py-2 text-right text-[12px] text-slate-600 select-none"
        style={{ width: `calc(${gutterWidth} + 1.5rem)` }}
        aria-hidden
      >
        {lines.map((_, index) => (
          <div key={index} className="px-3">
            {index + 1}
          </div>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden px-3 py-2"
        >
          <code className="whitespace-pre">
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
          onScroll={sync}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          wrap="off"
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="relative block h-full w-full resize-none overflow-auto bg-transparent px-3 py-2 whitespace-pre text-transparent caret-white outline-none placeholder:text-slate-500"
        />
      </div>
    </div>
  );
}
