"use client";

import { useSyncExternalStore } from "react";

export type RecentKind = "object" | "snippet";

export interface RecentEntry {
  kind: RecentKind;
  id: string;
  label: string;
  href: string;
  at: number;
}

const STORAGE_KEY = "oracle-knowledge-recent";
const MAX_ENTRIES = 12;
const EMPTY: RecentEntry[] = [];

let cachedRaw: string | null = null;
let cached: RecentEntry[] = EMPTY;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Stable snapshot for useSyncExternalStore: only re-parses when storage changed. */
export function getRecentSnapshot(): RecentEntry[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      cached = Array.isArray(parsed) ? (parsed as RecentEntry[]) : EMPTY;
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
}

function getServerSnapshot(): RecentEntry[] {
  return EMPTY;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("oracle-recent-changed", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("oracle-recent-changed", callback);
    window.removeEventListener("storage", callback);
  };
}

export function recordRecent(entry: Omit<RecentEntry, "at">) {
  if (typeof window === "undefined") return;
  const current = getRecentSnapshot().filter(
    (e) => !(e.kind === entry.kind && e.id === entry.id),
  );
  current.unshift({ ...entry, at: Date.now() });
  const next = current.slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedRaw = null; // force re-read on next snapshot
  cached = EMPTY;
  window.dispatchEvent(new Event("oracle-recent-changed"));
}

export function useRecent() {
  return useSyncExternalStore(subscribe, getRecentSnapshot, getServerSnapshot);
}
