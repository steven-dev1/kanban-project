import { ensureTrailingNewline, objectCodeFileName, sanitizeFileName } from "@/lib/knowledge/format";
import { createZip, type ZipEntry } from "@/lib/knowledge/zip";
import type { OracleObjectWithRelations, SqlSnippetWithRelations } from "@/lib/types";

const FOLDER_BY_TYPE: Record<string, string> = {
  TABLE: "tables",
  VIEW: "views",
  PROCEDURE: "procedures",
  FUNCTION: "functions",
  PACKAGE: "packages",
  TRIGGER: "triggers",
};

const CODE_TYPES = new Set(["PROCEDURE", "FUNCTION", "PACKAGE"]);

function latestCode(object: OracleObjectWithRelations, sourceType: "SOURCE" | "SPECIFICATION" | "BODY") {
  const versions = object.code_versions
    .filter((v) => v.source_type === sourceType)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return versions[versions.length - 1] ?? null;
}

function documentationFor(object: OracleObjectWithRelations) {
  const lines: string[] = [
    `${object.schema_name}.${object.object_name} (${object.object_type})`,
    object.description ? `Descripción: ${object.description}` : "",
    object.functional_description ? `Funcional: ${object.functional_description}` : "",
    object.module ? `Módulo: ${object.module}` : "",
    object.owner ? `Responsable: ${object.owner}` : "",
    "",
    "COLUMNAS",
  ];
  if (object.columns.length === 0) lines.push("(sin columnas documentadas)");
  for (const column of object.columns) {
    const type = `${column.data_type ?? ""}${column.data_length ? `(${column.data_length})` : ""}`;
    lines.push(
      `- ${column.column_name} ${type} ${column.nullable ? "NULL" : "NOT NULL"}${
        column.description ? ` — ${column.description}` : ""
      }`,
    );
  }
  const values = object.columns.flatMap((c) => c.values);
  if (values.length) {
    lines.push("", "VALORES DOCUMENTADOS");
    for (const column of object.columns) {
      for (const value of column.values) {
        lines.push(`- ${column.column_name} = ${value.value}${value.meaning ? ` → ${value.meaning}` : ""}`);
      }
    }
  }
  if (object.notes) lines.push("", "NOTAS", object.notes);
  return lines.join("\n");
}

export function exportEntryForObject(object: OracleObjectWithRelations): ZipEntry {
  const folder = FOLDER_BY_TYPE[object.object_type] ?? "objects";
  if (CODE_TYPES.has(object.object_type)) {
    if (object.object_type === "PACKAGE") {
      const spec = latestCode(object, "SPECIFICATION");
      const body = latestCode(object, "BODY");
      const content = [spec?.source_code, body?.source_code]
        .filter(Boolean)
        .map((code) => ensureTrailingNewline(code as string))
        .join("\n");
      return {
        path: `${folder}/${sanitizeFileName(object.object_name, "PACKAGE")}.sql`,
        content: content || `-- ${object.schema_name}.${object.object_name}\n`,
      };
    }
    const source = latestCode(object, "SOURCE");
    return {
      path: `${folder}/${sanitizeFileName(object.object_name, "OBJECT")}.sql`,
      content: source?.source_code ?? `-- ${object.schema_name}.${object.object_name}\n`,
    };
  }
  return {
    path: `${folder}/${sanitizeFileName(object.object_name, "OBJECT")}_doc.txt`,
    content: documentationFor(object),
  };
}

export function buildObjectsZip(
  objects: OracleObjectWithRelations[],
  date = new Date(),
): { blob: Blob; fileName: string } {
  const entries = objects.map(exportEntryForObject);
  return { blob: createZip(entries, date), fileName: zipName(date) };
}

export function exportEntryForSnippet(snippet: SqlSnippetWithRelations): ZipEntry {
  const name = snippetFileNameBase(snippet.title);
  return { path: `sql/${name}.sql`, content: snippet.sql_code };
}

export function buildSnippetsZip(
  snippets: SqlSnippetWithRelations[],
  date = new Date(),
): { blob: Blob; fileName: string } {
  const entries = snippets.map(exportEntryForSnippet);
  return { blob: createZip(entries, date), fileName: zipName(date) };
}

export function snippetFileNameBase(title: string) {
  return sanitizeFileName(title, "CONSULTA").toUpperCase();
}

export function zipName(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `oracle_export_${y}${m}${d}.zip`;
}

export { objectCodeFileName };
