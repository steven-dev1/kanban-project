"use client";

import {
  ENVIRONMENT_COLORS,
  ENVIRONMENT_SHORT,
  ENVIRONMENT_STATUS_LABELS,
  OBJECT_TYPE_COLORS,
  OBJECT_TYPE_LABELS,
} from "@/lib/knowledge/constants";
import type {
  Environment,
  EnvironmentStatus,
  KnowledgeTag,
  OracleObjectType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ObjectTypeBadge({
  type,
  className,
}: {
  type: OracleObjectType;
  className?: string;
}) {
  const color = OBJECT_TYPE_COLORS[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        className,
      )}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {type}
      <span className="sr-only"> {OBJECT_TYPE_LABELS[type]}</span>
    </span>
  );
}

export function EnvironmentBadge({
  environment,
  className,
}: {
  environment: Environment;
  className?: string;
}) {
  const color = ENVIRONMENT_COLORS[environment];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
        className,
      )}
      style={{ backgroundColor: `${color}1f`, color }}
      title={environment}
    >
      {ENVIRONMENT_SHORT[environment]}
    </span>
  );
}

export function StatusBadge({ status }: { status: EnvironmentStatus }) {
  const styles: Record<EnvironmentStatus, string> = {
    ACTIVE: "bg-green-500/15 text-green-600 dark:text-green-400",
    INACTIVE: "bg-muted text-muted-foreground",
    UNKNOWN: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", styles[status])}>
      {ENVIRONMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function TagChip({
  tag,
  onRemove,
  onClick,
  active,
}: {
  tag: KnowledgeTag;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        onClick && "cursor-pointer hover:opacity-80",
        active ? "ring-2 ring-offset-1 ring-offset-background" : "",
      )}
      style={{
        borderColor: `${tag.color}66`,
        backgroundColor: `${tag.color}1a`,
        color: tag.color,
      }}
      onClick={onClick}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-60 hover:opacity-100"
          aria-label={`Quitar ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
