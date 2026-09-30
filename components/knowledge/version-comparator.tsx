"use client";

import { AiMenuItem, AiTextDialog, type AiTextRequest } from "@/components/knowledge/ai-dialog";
import { EnvironmentBadge } from "@/components/knowledge/ui";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/select";
import { aiDiffExplain } from "@/lib/ai/client";
import { diffLines, diffStats, type DiffLine } from "@/lib/knowledge/diff";
import type { OracleCodeVersion } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
  type: "same" | "changed" | "removed" | "added";
}

function toRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type === "same") {
      rows.push({ left: lines[i], right: lines[i], type: "same" });
      i++;
      continue;
    }
    const removed: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (i < lines.length && lines[i].type !== "same") {
      if (lines[i].type === "removed") removed.push(lines[i]);
      else added.push(lines[i]);
      i++;
    }
    const max = Math.max(removed.length, added.length);
    for (let k = 0; k < max; k++) {
      const left = removed[k] ?? null;
      const right = added[k] ?? null;
      rows.push({
        left,
        right,
        type: left && right ? "changed" : left ? "removed" : "added",
      });
    }
  }
  return rows;
}

export function VersionComparator({ versions }: { versions: OracleCodeVersion[] }) {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [versions],
  );
  const [leftId, setLeftId] = useState(sorted[0]?.id ?? "");
  const [rightId, setRightId] = useState(sorted[sorted.length - 1]?.id ?? "");
  const [view, setView] = useState<"split" | "unified">("split");
  const [aiRequest, setAiRequest] = useState<AiTextRequest | null>(null);

  const left = sorted.find((v) => v.id === leftId) ?? null;
  const right = sorted.find((v) => v.id === rightId) ?? null;

  const result = useMemo(() => {
    if (!left || !right) return null;
    const lines = diffLines(left.source_code, right.source_code);
    return { lines, stats: diffStats(lines), rows: toRows(lines) };
  }, [left, right]);

  const label = (version: OracleCodeVersion) =>
    `v${version.version_number}${version.environment ? ` · ${version.environment}` : ""} · ${
      formatDate(version.created_at) ?? ""
    }`;

  if (sorted.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
        Necesitas al menos dos versiones para comparar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Select
          value={leftId}
          onChange={setLeftId}
          options={sorted.map((v) => ({ value: v.id, label: label(v) }))}
          placeholder="Versión base"
        />
        <span className="hidden pb-2 text-center text-xs font-semibold text-muted-foreground sm:block">
          ←→
        </span>
        <Select
          value={rightId}
          onChange={setRightId}
          options={sorted.map((v) => ({ value: v.id, label: label(v) }))}
          placeholder="Versión a comparar"
        />
      </div>

      {left && right && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            {left.environment && <EnvironmentBadge environment={left.environment} />}
            <span className="text-muted-foreground">v{left.version_number}</span>
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="flex items-center gap-1.5">
            {right.environment && <EnvironmentBadge environment={right.environment} />}
            <span className="text-muted-foreground">v{right.version_number}</span>
          </span>
          {result && (
            <span className="ml-auto flex items-center gap-3">
              <span className="text-green-600 dark:text-green-400">+{result.stats.added} agregadas</span>
              <span className="text-danger">-{result.stats.removed} eliminadas</span>
              <span className="text-amber-600 dark:text-amber-400">
                ~{result.stats.modified} modificadas
              </span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        {left && right ? (
          <Dropdown
            trigger={
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 text-primary" /> Explicar diferencias
              </Button>
            }
          >
            {(close) => (
              <div className="w-56">
                <AiMenuItem
                  label="Explicar cambios con IA"
                  onClick={() => {
                    close();
                    setAiRequest({
                      title: "Diferencias entre versiones",
                      description: "Qué cambió funcionalmente, riesgos y posibles regresiones.",
                      run: () =>
                        aiDiffExplain({
                          previous: left.source_code,
                          current: right.source_code,
                        }),
                    });
                  }}
                />
              </div>
            )}
          </Dropdown>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView("split")}
            className={cn(
              "rounded-md px-2 py-1",
              view === "split" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Lado a lado
          </button>
          <button
            type="button"
            onClick={() => setView("unified")}
            className={cn(
              "rounded-md px-2 py-1",
              view === "unified" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Unificado
          </button>
        </div>
      </div>

      {!result ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Selecciona dos versiones diferentes.
        </p>
      ) : view === "unified" ? (
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-slate-50 font-mono text-[12.5px] leading-5 dark:bg-[#0b1020]">
          <pre className="m-0 min-w-full p-0">
            <code className="block">
              {result.lines.map((line, index) => {
                const styles =
                  line.type === "added"
                    ? "bg-green-500/10 text-green-700 dark:text-green-300"
                    : line.type === "removed"
                      ? "bg-red-500/10 text-red-700 dark:text-red-300"
                      : "text-slate-700 dark:text-slate-300";
                const marker = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
                return (
                  <span key={index} className={`flex min-w-max ${styles}`}>
                    <span className="w-10 shrink-0 select-none border-r border-slate-200 px-2 text-right text-slate-400 dark:border-white/10 dark:text-slate-600">
                      {line.oldNumber ?? ""}
                    </span>
                    <span className="w-10 shrink-0 select-none border-r border-slate-200 px-2 text-right text-slate-400 dark:border-white/10 dark:text-slate-600">
                      {line.newNumber ?? ""}
                    </span>
                    <span className="w-6 shrink-0 select-none px-1 text-center">{marker}</span>
                    <span className="flex-1 whitespace-pre px-2 pr-4">{line.text || "\u00a0"}</span>
                  </span>
                );
              })}
            </code>
          </pre>
        </div>
      ) : (
        <div className="flex overflow-hidden rounded-xl border border-border bg-slate-50 dark:bg-[#0b1020]">
          <SplitPane side="left" version={left} rows={result.rows} />
          <SplitPane side="right" version={right} rows={result.rows} />
        </div>
      )}
      <AiTextDialog request={aiRequest} onClose={() => setAiRequest(null)} />
    </div>
  );
}

function SplitPane({
  side,
  version,
  rows,
}: {
  side: "left" | "right";
  version: OracleCodeVersion | null;
  rows: SplitRow[];
}) {
  return (
    <div
      className={cn(
        "flex w-1/2 min-w-0 flex-col",
        side === "right" && "border-l border-slate-200 dark:border-white/10",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-100 px-2 py-1 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
        <span className="font-mono">{version ? `v${version.version_number}` : ""}</span>
        {version?.environment && (
          <span className="rounded bg-slate-200 px-1 py-0.5 dark:bg-white/10">
            {version.environment}
          </span>
        )}
        <span className="ml-auto text-slate-400 dark:text-slate-500">{rows.length} líneas</span>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="border-collapse font-mono text-[12.5px] leading-5">
          <tbody>
            {rows.map((row, index) => {
              const line = side === "left" ? row.left : row.right;
              const isRemoved =
                side === "left" && (row.type === "removed" || row.type === "changed");
              const isAdded =
                side === "right" && (row.type === "added" || row.type === "changed");
              const number = line ? (side === "left" ? line.oldNumber : line.newNumber) : null;
              return (
                <tr
                  key={index}
                  className={cn(
                    isRemoved && "bg-red-500/10",
                    isAdded && "bg-green-500/10",
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 w-10 min-w-[2.5rem] select-none border-r border-slate-200 px-2 text-right align-top tabular-nums dark:border-white/10",
                      isRemoved ? "bg-red-100 text-red-500 dark:bg-[#2a0f14] dark:text-red-300/60" : "",
                      isAdded
                        ? "bg-green-100 text-green-600 dark:bg-[#0f2417] dark:text-green-300/60"
                        : "",
                      !isRemoved && !isAdded
                        ? "bg-slate-50 text-slate-400 dark:bg-[#0b1020] dark:text-slate-600"
                        : "",
                    )}
                  >
                    {number ?? ""}
                  </td>
                  <td
                    className={cn(
                      "whitespace-pre px-2 pr-6 align-top",
                      isRemoved && "text-red-700 dark:text-red-300",
                      isAdded && "text-green-700 dark:text-green-300",
                      !isRemoved && !isAdded && "text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {line ? line.text || "\u00a0" : "\u00a0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
