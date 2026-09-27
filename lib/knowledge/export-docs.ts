import type { OracleColumnWithValues, OracleObjectWithRelations } from "@/lib/types";

function typeLabel(object: OracleObjectWithRelations) {
  return object.object_type;
}

function keyLabel(column: OracleColumnWithValues): string {
  const parts: string[] = [];
  if (column.is_primary_key) parts.push("PK");
  if (column.is_unique) parts.push("UNIQUE");
  if (column.references_table) {
    const target = [column.references_schema, column.references_table].filter(Boolean).join(".");
    parts.push(`FK→${target}${column.references_column ? `(${column.references_column})` : ""}`);
  }
  if (column.check_expression) parts.push(`CHECK ${column.check_expression}`);
  return parts.join(", ");
}

export function documentationMarkdown(objects: OracleObjectWithRelations[]): string {
  const out: string[] = ["# Diccionario de datos", ""];
  for (const object of objects) {
    out.push(`## ${object.schema_name}.${object.object_name}`);
    out.push("");
    out.push(`- **Tipo:** ${typeLabel(object)}`);
    if (object.module) out.push(`- **Módulo:** ${object.module}`);
    if (object.description) out.push(`- **Descripción:** ${object.description}`);
    const envs = object.environments.map((e) => `${e.environment}${e.version ? ` v${e.version}` : ""}`);
    if (envs.length) out.push(`- **Ambientes:** ${envs.join(", ")}`);
    if (object.tags.length) out.push(`- **Etiquetas:** ${object.tags.map((t) => t.name).join(", ")}`);
    out.push("");

    if (object.columns.length) {
      out.push("| Columna | Tipo | Nullable | Claves | Descripción |");
      out.push("| --- | --- | --- | --- | --- |");
      for (const column of object.columns) {
        const type = `${column.data_type ?? ""}${column.data_length ? `(${column.data_length})` : ""}`;
        const desc = (column.description ?? column.business_meaning ?? "").replace(/\|/g, "\\|");
        const keys = keyLabel(column).replace(/\|/g, "\\|") || "—";
        out.push(
          `| ${column.column_name} | ${type} | ${column.nullable ? "Sí" : "No"} | ${keys} | ${desc} |`,
        );
      }
      out.push("");
    }

    const values = object.columns.flatMap((c) => c.values.map((v) => ({ column: c.column_name, ...v })));
    if (values.length) {
      out.push("**Valores documentados**");
      out.push("");
      for (const value of values) {
        out.push(`- \`${value.column}\` = \`${value.value}\`${value.meaning ? ` → ${value.meaning}` : ""}`);
      }
      out.push("");
    }
    out.push("---");
    out.push("");
  }
  return out.join("\n");
}

export function documentationCsv(objects: OracleObjectWithRelations[]): string {
  const header = [
    "SCHEMA",
    "OBJETO",
    "TIPO",
    "MODULO",
    "COLUMNA",
    "TIPO_DATO",
    "LONGITUD",
    "NULLABLE",
    "CLAVES",
    "DESCRIPCION",
    "VALORES",
  ];
  const escape = (value: string | null | undefined) => {
    const text = (value ?? "").replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  };

  const rows: string[] = [header.join(",")];
  for (const object of objects) {
    if (object.columns.length === 0) {
      rows.push(
        [
          object.schema_name,
          object.object_name,
          object.object_type,
          object.module,
          "",
          "",
          "",
          "",
          "",
          object.description,
          "",
        ]
          .map(escape)
          .join(","),
      );
      continue;
    }
    for (const column of object.columns) {
      const values = column.values
        .map((v) => `${v.value}${v.meaning ? `=${v.meaning}` : ""}`)
        .join(" | ");
      rows.push(
        [
          object.schema_name,
          object.object_name,
          object.object_type,
          object.module,
          column.column_name,
          column.data_type,
          column.data_length != null ? String(column.data_length) : "",
          column.nullable ? "SI" : "NO",
          keyLabel(column),
          column.description ?? column.business_meaning,
          values,
        ]
          .map(escape)
          .join(","),
      );
    }
  }
  return rows.join("\n");
}
