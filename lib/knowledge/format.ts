import type { Environment, SourceType } from "@/lib/types";

/** Removes characters that are invalid in file names and collapses spaces. */
export function sanitizeFileName(name: string, fallback = "archivo") {
  const cleaned = (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

/** YYYYMMDD used in exported file names. */
export function fileDateStamp(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

const SOURCE_TYPE_SUFFIX: Record<SourceType, string> = {
  SOURCE: "",
  SPECIFICATION: "SPEC",
  BODY: "BODY",
};

/** Builds "<OBJECT>_<SPEC|BODY>_<ENV>_<DATE>.sql" style names. */
export function objectCodeFileName(
  objectName: string,
  sourceType: SourceType,
  environment: Environment,
  extension: "sql" | "txt" = "sql",
  date: Date = new Date(),
) {
  const parts = [sanitizeFileName(objectName, "OBJETO").toUpperCase()];
  const suffix = SOURCE_TYPE_SUFFIX[sourceType];
  if (suffix) parts.push(suffix);
  parts.push(environment);
  parts.push(fileDateStamp(date));
  return `${parts.join("_")}.${extension}`;
}

/** Builds "<TITLE>_<DATE>.sql" for SQL snippets. */
export function snippetFileName(
  title: string,
  extension: "sql" | "txt" = "sql",
  date: Date = new Date(),
) {
  return `${sanitizeFileName(title, "CONSULTA").toUpperCase()}_${fileDateStamp(date)}.${extension}`;
}

export function zipFileName(date: Date = new Date()) {
  return `oracle_export_${fileDateStamp(date)}.zip`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function downloadTextFile(fileName: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Ensures a single trailing newline without touching internal whitespace. */
export function ensureTrailingNewline(text: string) {
  if (!text) return text;
  return text.endsWith("\n") ? text : `${text}\n`;
}
