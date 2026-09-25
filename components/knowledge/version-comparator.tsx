"use client";

import { Select } from "@/components/ui/select";
import { EnvironmentBadge } from "@/components/knowledge/ui";
import { diffLines, diffStats } from "@/lib/knowledge/diff";
import type { OracleCodeVersion } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useMemo, useState } from "react";

export function VersionComparator({ versions }: { versions: OracleCodeVersion[] }) {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [versions],
  );
  const [leftId, setLeftId] = useState(sorted[0]?.id ?? "");
  const [rightId, setRightId] = useState(sorted[sorted.length - 1]?.id ?? "");

  const left = sorted.find((v) => v.id === leftId) ?? null;
  const right = sorted.find((v) => v.id === rightId) ?? null;

  const result = useMemo(() => {
    if (!left || !right || left.id === right.id) return null;
    const lines = diffLines(left.source_code, right.source_code);
    return { lines, stats: diffStats(lines) };
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

      {!result ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Selecciona dos versiones diferentes.
        </p>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-[#0b1020] font-mono text-[12.5px] leading-5">
          <pre className="m-0 min-w-full p-0">
            <code className="block">
              {result.lines.map((line, index) => {
                const styles =
                  line.type === "added"
                    ? "bg-green-500/10 text-green-300"
                    : line.type === "removed"
                      ? "bg-red-500/10 text-red-300"
                      : "text-slate-300";
                const marker = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
                return (
                  <span key={index} className={`flex ${styles}`}>
                    <span className="w-10 shrink-0 select-none border-r border-white/10 px-2 text-right text-slate-600">
                      {line.oldNumber ?? ""}
                    </span>
                    <span className="w-10 shrink-0 select-none border-r border-white/10 px-2 text-right text-slate-600">
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
      )}
    </div>
  );
}
