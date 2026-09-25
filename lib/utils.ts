import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email || "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function isOverdue(value?: string | null, done = false) {
  if (!value || done) return false;
  const due = new Date(value);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export type DueState = "completed" | "overdue" | "soon" | "normal";

const SOON_DAYS = 3;

export function dueState(value?: string | null, completed = false): DueState {
  if (completed) return "completed";
  if (!value) return "normal";
  const due = new Date(value);
  due.setHours(23, 59, 59, 999);
  const now = Date.now();
  if (due.getTime() < now) return "overdue";
  if (due.getTime() <= now + SOON_DAYS * 24 * 60 * 60 * 1000) return "soon";
  return "normal";
}

export const DUE_STATE_COLORS: Record<DueState, string> = {
  completed: "#22c55e",
  overdue: "#ef4444",
  soon: "#f59e0b",
  normal: "transparent",
};

export interface AuthResult<
  U = { id: string; email?: string | null },
  S = { access_token: string } | null,
> {
  data: { user: U | null; session: S };
  error: { message: string } | null;
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 20000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            "No se pudo conectar con Supabase (tiempo de espera agotado). Revisa tu conexión, firewall o proxy.",
          ),
        ),
      ms,
    );
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export interface DateParts {
  y: number;
  m: number;
  d: number;
}

export function parseDateParts(value?: string | null): DateParts | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
}

export function todayParts(): DateParts {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

export function monthLabel(y: number, m: number) {
  const label = new Date(y, m, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthGrid(y: number, m: number): (number | null)[] {
  const startWeekday = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

export function isoAtNoon({ y, m, d }: DateParts) {
  return new Date(y, m, d, 12, 0, 0).toISOString();
}

export const LIST_COLORS = [
  { name: "Slate", value: "#94a3b8" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
];

export const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

export function positionBetween(before?: number | null, after?: number | null) {
  if (before == null && after == null) return 1000;
  if (before == null) return (after as number) - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}
