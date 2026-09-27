export interface ParsedColumn {
  column_name: string;
  data_type: string | null;
  data_length: number | null;
  data_precision: number | null;
  data_scale: number | null;
  nullable: boolean;
  column_order: number;
  description: string | null;
  is_primary_key: boolean;
  is_unique: boolean;
  references_schema: string | null;
  references_table: string | null;
  references_column: string | null;
  check_expression: string | null;
}

export interface ParsedDdl {
  schema_name: string | null;
  object_name: string | null;
  object_type: "TABLE" | "VIEW" | null;
  columns: ParsedColumn[];
  warnings: string[];
}

const TABLE_RE = /CREATE\s+(?:GLOBAL\s+TEMPORARY\s+)?TABLE\s+(?:"?([A-Za-z0-9_$#]+)"?\s*\.\s*)?"?([A-Za-z0-9_$#]+)"?/i;
const VIEW_RE = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:FORCE\s+)?VIEW\s+(?:"?([A-Za-z0-9_$#]+)"?\s*\.\s*)?"?([A-Za-z0-9_$#]+)"?/i;

const CONSTRAINTS =
  /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|REFERENCES|KEY|INDEX|EXCLUDE|PERIOD|SUPPLEMENTAL|ORGANIZATION|TABLESPACE|STORAGE|PCTFREE|PCTUSED|INITRANS|MAXTRANS|LOGGING|NOLOGGING|CACHE|NOCACHE|PARALLEL|NOPARALLEL|ENABLE|DISABLE|NOCOMPRESS|COMPRESS|LOB|SEGMENT|INITIAL|NEXT|MINEXTENTS|MAXEXTENTS|MONITORING|NOMONITORING)\b/i;

const INLINE_KEYWORDS = new Set([
  "NOT",
  "NULL",
  "DEFAULT",
  "CONSTRAINT",
  "PRIMARY",
  "UNIQUE",
  "REFERENCES",
  "CHECK",
  "GENERATED",
  "IDENTITY",
  "COLLATE",
  "ENABLE",
  "DISABLE",
  "INVISIBLE",
  "VISIBLE",
  "STORAGE",
  "ENCRYPT",
]);

/** Quita el comentario de una línea (-- ...) respetando strings. */
function stripLineComment(line: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'") inString = !inString;
    if (!inString && ch === "-" && line[i + 1] === "-") break;
    out += ch;
  }
  return out;
}

function findBody(sql: string): { body: string; startIndex: number } | null {
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") inString = !inString;
    if (inString) continue;
    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      let inStr = false;
      for (; j < sql.length; j++) {
        const c = sql[j];
        if (c === "'") inStr = !inStr;
        if (inStr) continue;
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      return { body: sql.slice(i + 1, j), startIndex: i + 1 };
    }
  }
  return null;
}

/** Separa por comas de nivel superior respetando paréntesis y strings. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'") inString = !inString;
    if (!inString) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseType(raw: string): Pick<
  ParsedColumn,
  "data_type" | "data_length" | "data_precision" | "data_scale"
> {
  const match = raw.match(/^([A-Za-z0-9_ ]+?)\s*(?:\(([^)]*)\))?$/);
  if (!match) return { data_type: raw.toUpperCase(), data_length: null, data_precision: null, data_scale: null };
  const data_type = match[1].trim().toUpperCase().replace(/\s+/g, " ");
  const args = match[2];
  if (!args) return { data_type, data_length: null, data_precision: null, data_scale: null };
  const nums = args
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n));
  const isNumeric = /NUMBER|DECIMAL|NUMERIC|FLOAT|DOUBLE/.test(data_type);
  if (nums.length >= 2 && isNumeric) {
    return { data_type, data_length: null, data_precision: nums[0], data_scale: nums[1] };
  }
  if (nums.length === 1) {
    if (isNumeric) return { data_type, data_length: null, data_precision: nums[0], data_scale: null };
    return { data_type, data_length: nums[0], data_precision: null, data_scale: null };
  }
  // Tipos como VARCHAR2(50 CHAR)
  const charMatch = args.match(/(\d+)/);
  return {
    data_type,
    data_length: charMatch ? Number(charMatch[1]) : null,
    data_precision: null,
    data_scale: null,
  };
}

function parseColumn(definition: string): ParsedColumn | null {
  let def = definition.trim();
  if (!def) return null;

  // Comentario inline de columna
  let description: string | null = null;
  const commentMatch = def.match(/--\s*(.+)$/);
  if (commentMatch) {
    description = commentMatch[1].trim();
    def = def.slice(0, commentMatch.index).trim();
  }

  if (CONSTRAINTS.test(def)) return null;

  const nameMatch = def.match(/^"?([A-Za-z0-9_$#]+)"?\s+([\s\S]+)$/);
  if (!nameMatch) return null;
  const column_name = nameMatch[1].toUpperCase();
  let rest = nameMatch[2].trim();

  // Corta el resto en el primer keyword inline (NOT NULL, DEFAULT, ...)
  const words = rest.split(/\s+/);
  const typeWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toUpperCase().replace(/[(),]/g, "");
    if (i > 0 && INLINE_KEYWORDS.has(word)) break;
    typeWords.push(words[i]);
    if (/\)/.test(words[i])) break;
  }
  rest = typeWords.join(" ");

  const tail = nameMatch[2];
  const is_primary_key = /\bPRIMARY\s+KEY\b/i.test(tail);
  const is_unique = /\bUNIQUE\b/i.test(tail);
  const reference = parseReference(tail);
  const checkMatch = tail.match(/\bCHECK\s*\(([\s\S]*)\)/i);
  const nullable = is_primary_key ? false : !/\bNOT\s+NULL\b/i.test(tail);
  const type = parseType(rest.replace(/,\s*$/, "").trim());

  return {
    column_name,
    ...type,
    nullable,
    column_order: 0,
    description,
    is_primary_key,
    is_unique,
    references_schema: reference?.schema ?? null,
    references_table: reference?.table ?? null,
    references_column: reference?.column ?? null,
    check_expression: checkMatch ? checkMatch[1].trim() : null,
  };
}

function stripQuotes(raw: string): string {
  return raw.trim().replace(/^"|"$/g, "").replace(/'/g, "").toUpperCase();
}

/** Extrae el destino de una cláusula REFERENCES [schema.]tabla[(columna)]. */
function parseReference(
  text: string,
): { schema: string | null; table: string; column: string | null } | null {
  const match = text.match(
    /\bREFERENCES\s+(?:"?([A-Za-z0-9_$#]+)"?\s*\.\s*)?"?([A-Za-z0-9_$#]+)"?\s*(?:\(\s*"?([A-Za-z0-9_$#]+)"?\s*\))?/i,
  );
  if (!match) return null;
  return {
    schema: match[1] ? match[1].toUpperCase() : null,
    table: match[2].toUpperCase(),
    column: match[3] ? match[3].toUpperCase() : null,
  };
}

/** Aplica una restricción definida a nivel de tabla (PRIMARY, UNIQUE, FK, CHECK). */
function applyTableConstraint(part: string, columns: ParsedColumn[]): boolean {
  const body = part.trim().replace(/^CONSTRAINT\s+"?[A-Za-z0-9_$#]+"?\s+/i, "");
  const find = (name: string) => columns.find((c) => c.column_name === name);

  const pk = body.match(/^PRIMARY\s+KEY\s*\(([^)]*)\)/i);
  if (pk) {
    for (const raw of pk[1].split(",")) {
      const column = find(stripQuotes(raw));
      if (column) {
        column.is_primary_key = true;
        column.nullable = false;
      }
    }
    return true;
  }

  const unique = body.match(/^(?:UNIQUE|KEY)\s*\(([^)]*)\)/i);
  if (unique) {
    for (const raw of unique[1].split(",")) {
      const column = find(stripQuotes(raw));
      if (column) column.is_unique = true;
    }
    return true;
  }

  const fk = body.match(
    /^FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+(?:"?([A-Za-z0-9_$#]+)"?\s*\.\s*)?"?([A-Za-z0-9_$#]+)"?\s*(?:\(([^)]*)\))?/i,
  );
  if (fk) {
    const localColumns = fk[1].split(",").map(stripQuotes);
    const refSchema = fk[2] ? fk[2].toUpperCase() : null;
    const refTable = fk[3].toUpperCase();
    const refColumns = (fk[4] ?? "").split(",").map(stripQuotes);
    localColumns.forEach((name, index) => {
      const column = find(name);
      if (column) {
        column.references_schema = refSchema;
        column.references_table = refTable;
        column.references_column = refColumns[index] ?? refColumns[0] ?? null;
      }
    });
    return true;
  }

  const check = body.match(/^CHECK\s*\(([\s\S]*)\)/i);
  if (check) {
    const expression = check[1].trim();
    const referenced = expression.match(/"?([A-Za-z0-9_$#]+)"?/);
    const column = referenced ? find(referenced[1].toUpperCase()) : undefined;
    if (column) column.check_expression = expression;
    return true;
  }

  return false;
}

/**
 * Parsea el DDL de una tabla o vista y extrae nombre, schema y columnas.
 * No es un parser SQL completo: está orientado a scripts de creación típicos.
 */
export function parseTableDdl(sql: string): ParsedDdl {
  const warnings: string[] = [];
  const cleaned = sql
    .split("\n")
    .map(stripLineComment)
    .join("\n")
    .trim();

  if (!cleaned) {
    return {
      schema_name: null,
      object_name: null,
      object_type: null,
      columns: [],
      warnings: ["El DDL está vacío"],
    };
  }

  const tableMatch = cleaned.match(TABLE_RE);
  const viewMatch = cleaned.match(VIEW_RE);

  let schema_name: string | null = null;
  let object_name: string | null = null;
  let object_type: "TABLE" | "VIEW" | null = null;

  if (tableMatch) {
    schema_name = tableMatch[1] ?? null;
    object_name = tableMatch[2].toUpperCase();
    object_type = "TABLE";
  } else if (viewMatch) {
    schema_name = viewMatch[1] ?? null;
    object_name = viewMatch[2].toUpperCase();
    object_type = "VIEW";
  } else {
    return {
      schema_name: null,
      object_name: null,
      object_type: null,
      columns: [],
      warnings: ["No se encontró un CREATE TABLE o CREATE VIEW en el DDL"],
    };
  }

  const body = findBody(cleaned);
  if (!body) {
    warnings.push("No se encontró la definición de columnas entre paréntesis");
    return { schema_name, object_name, object_type, columns: [], warnings };
  }

  const columns: ParsedColumn[] = [];
  const constraintParts: string[] = [];
  for (const part of splitTopLevel(body.body)) {
    const column = parseColumn(part);
    if (column) {
      columns.push({ ...column, column_order: columns.length + 1 });
    } else if (CONSTRAINTS.test(part)) {
      constraintParts.push(part);
    } else {
      warnings.push(`No se pudo interpretar: ${part.slice(0, 60)}`);
    }
  }

  // Las restricciones a nivel de tabla pueden ir antes o después de las columnas.
  for (const part of constraintParts) {
    applyTableConstraint(part, columns);
  }

  if (columns.length === 0) {
    warnings.push("No se detectaron columnas");
  }

  return { schema_name, object_name, object_type, columns, warnings };
}
