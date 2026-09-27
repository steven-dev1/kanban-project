import type { OracleColumnWithValues, OracleObjectWithRelations } from "@/lib/types";

const MAX_IDENTIFIER = 30;

function clampIdentifier(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9_$#]/g, "_").toUpperCase();
  if (clean.length <= MAX_IDENTIFIER) return clean;
  return clean.slice(0, MAX_IDENTIFIER);
}

/** Formatea el tipo de dato de una columna (LONGITUD o PRECISIÓN, ESCALA). */
export function columnType(column: OracleColumnWithValues): string {
  const type = (column.data_type ?? "").toUpperCase();
  if (!type) return "";
  if (column.data_precision != null) {
    return `${type}(${column.data_precision}${
      column.data_scale != null ? `,${column.data_scale}` : ""
    })`;
  }
  if (column.data_length != null) return `${type}(${column.data_length})`;
  return type;
}

function constraintName(objectName: string, suffix: string, column?: string) {
  return clampIdentifier(`${objectName}${column ? `_${column}` : ""}_${suffix}`);
}

/**
 * Reconstruye un CREATE TABLE a partir de la documentación: columnas con su
 * tipo y NOT NULL, más PRIMARY KEY, UNIQUE, FOREIGN KEY y CHECK.
 */
export function objectToDdl(object: OracleObjectWithRelations): string {
  if (object.object_type !== "TABLE" || object.columns.length === 0) return "";

  const statements: string[] = [];
  for (const column of object.columns) {
    let line = `  ${column.column_name} ${columnType(column)}`.trimEnd();
    if (!column.nullable) line += " NOT NULL";
    statements.push(line);
  }

  const primaryKey = object.columns.filter((c) => c.is_primary_key).map((c) => c.column_name);
  if (primaryKey.length > 0) {
    statements.push(
      `  CONSTRAINT ${constraintName(object.object_name, "PK")} PRIMARY KEY (${primaryKey.join(", ")})`,
    );
  }

  for (const column of object.columns) {
    if (column.is_unique && !column.is_primary_key) {
      statements.push(
        `  CONSTRAINT ${constraintName(object.object_name, "UK", column.column_name)} UNIQUE (${column.column_name})`,
      );
    }
    if (column.references_table) {
      const target = [column.references_schema, column.references_table].filter(Boolean).join(".");
      const targetColumn = column.references_column ? ` (${column.references_column})` : "";
      statements.push(
        `  CONSTRAINT ${constraintName(
          object.object_name,
          "FK",
          column.column_name,
        )} FOREIGN KEY (${column.column_name}) REFERENCES ${target}${targetColumn}`,
      );
    }
    if (column.check_expression) {
      statements.push(
        `  CONSTRAINT ${constraintName(
          object.object_name,
          "CK",
          column.column_name,
        )} CHECK (${column.check_expression})`,
      );
    }
  }

  return `CREATE TABLE ${object.schema_name}.${object.object_name} (\n${statements.join(
    ",\n",
  )}\n);\n`;
}

/** Concatena el DDL de varios objetos (solo tablas con columnas). */
export function objectsToDdl(objects: OracleObjectWithRelations[]): string {
  return objects
    .map(objectToDdl)
    .filter((ddl) => ddl.length > 0)
    .join("\n");
}

export function ddlFileName(object: OracleObjectWithRelations): string {
  return `${clampIdentifier(object.object_name)}.sql`;
}
