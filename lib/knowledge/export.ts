import { createZip, type ZipEntry } from "@/lib/knowledge/zip";

const INVALID_CHARS = /[\\/:*?"<>|\u0000-\u001f]+/g;

/** Limpia caracteres inválidos para nombres de archivo. */
export function sanitizeFileName(name: string): string {
  return (name ?? "")
    .replace(INVALID_CHARS, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "archivo";
}

/** YYYYMMDD en hora local. */
export function todayStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * NOMBRE_OBJETO_AMBIENTE_FECHA.sql
 * Las partes vacías se omiten: CONSULTA_TIQUETES_20260925.sql
 */
export function buildExportName(
  parts: (string | null | undefined)[],
  ext: "sql" | "txt" = "sql",
): string {
  const cleaned = parts
    .filter((part): part is string => !!part && part.trim().length > 0)
    .map((part) => sanitizeFileName(part.trim().toUpperCase()));
  cleaned.push(todayStamp());
  return `${cleaned.join("_")}.${ext}`;
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): void {
  downloadBlobFile(filename, new Blob([content], { type: mime }));
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // continúa con el fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Package completo: Specification primero y Body después. */
export function packageFullSource(
  specification: string | null | undefined,
  body: string | null | undefined,
): string {
  return [specification?.trim() ?? "", body?.trim() ?? ""]
    .filter(Boolean)
    .join("\n\n/\n\n");
}

export interface ExportFolderItem {
  folder: string;
  fileName: string;
  content: string;
}

/** Exportación múltiple a .zip (sin servicios externos). */
export function exportManyAsZip(items: ExportFolderItem[], zipName?: string): void {
  const entries: ZipEntry[] = items.map((item) => ({
    path: `${item.folder}/${item.fileName}`,
    content: item.content,
  }));
  downloadBlobFile(zipName ?? `oracle_export_${todayStamp()}.zip`, createZip(entries));
}
