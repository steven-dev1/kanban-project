"use client";

import { validateOracleCode, type ValidationResult } from "@/lib/knowledge/validate";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useMemo } from "react";

export function useValidation(code: string): ValidationResult {
  return useMemo(() => validateOracleCode(code), [code]);
}

export function SyntaxReport({ result }: { result: ValidationResult }) {
  const { errors, warnings, isPlsql } = result;
  const ok = errors.length === 0 && warnings.length === 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs">
        {errors.length > 0 ? (
          <XCircle className="h-3.5 w-3.5 text-danger" />
        ) : warnings.length > 0 ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        )}
        <span className="font-medium text-foreground">
          {ok
            ? `Sin problemas de sintaxis detectados${isPlsql ? " (PL/SQL)" : ""}`
            : `${errors.length} error(es), ${warnings.length} aviso(s)`}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Validación heurística (no es un compilador Oracle)
        </span>
      </div>

      {!ok && (
        <ul className="divide-y divide-border">
          {errors.map((issue, index) => (
            <li key={`e-${index}`} className="flex items-start gap-2 px-3 py-1.5 text-xs">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
              <span className="w-14 shrink-0 text-muted-foreground">Línea {issue.line}</span>
              <span className="text-danger">{issue.message}</span>
            </li>
          ))}
          {warnings.map((issue, index) => (
            <li key={`w-${index}`} className="flex items-start gap-2 px-3 py-1.5 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="w-14 shrink-0 text-muted-foreground">Línea {issue.line}</span>
              <span className="text-muted-foreground">{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SyntaxStatusChip({
  result,
  className,
}: {
  result: ValidationResult;
  className?: string;
}) {
  const { errors, warnings } = result;
  if (errors.length > 0) {
    return (
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold text-danger", className)}>
        {errors.length} error(es)
      </span>
    );
  }
  if (warnings.length > 0) {
    return (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400",
          className,
        )}
      >
        {warnings.length} aviso(s)
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400",
        className,
      )}
    >
      OK
    </span>
  );
}
