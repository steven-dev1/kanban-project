import type { OracleObjectType } from "@/lib/types";

export interface ParsedArgument {
  argument_name: string;
  data_type: string | null;
  in_out: "IN" | "OUT" | "IN OUT";
  position: number;
}

export interface ParsedPlsql {
  schema_name: string | null;
  object_name: string | null;
  object_type: OracleObjectType | null;
  /** Bloque del paquete: PACKAGE (spec) o PACKAGE BODY. */
  is_package_body: boolean;
  specification: string | null;
  body: string | null;
  source: string;
  /** Argumentos detectados en la cabecera (procedure/función). */
  arguments: ParsedArgument[];
}

/** Quita comentarios (-- y /* *​/) conservando los saltos de línea. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

/** Extrae el bloque de parámetros de una cabecera `NOMBRE (...)`. */
function extractParamBlock(header: string): string | null {
  const open = header.indexOf("(");
  if (open === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = open; i < header.length; i++) {
    const ch = header[i];
    if (ch === "'") inString = !inString;
    if (inString) continue;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return header.slice(open + 1, i);
    }
  }
  return header.slice(open + 1);
}

/** Separa por comas de nivel superior respetando paréntesis y strings. */
function splitParams(block: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (const ch of block) {
    if (ch === "'") inString = !inString;
    if (!inString) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (ch === "," && depth === 0 && !inString) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Detecta los argumentos de la cabecera de un procedure o función:
 * nombre, tipo, dirección (IN/OUT/IN OUT) y posición. El `RETURN` de una
 * función NO es un argumento, por lo que no se incluye.
 */
export function parseArguments(code: string, objectType: OracleObjectType | null): ParsedArgument[] {
  const sql = stripComments((code ?? "").replace(/\r\n?/g, "\n"));
  if (objectType !== "PROCEDURE" && objectType !== "FUNCTION") return [];

  const headerMatch = sql.match(
    /(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:EDITIONABLE\s+|NONEDITIONABLE\s+)?)?(PROCEDURE|FUNCTION)\s+"?[A-Za-z0-9_$#]+"?/i,
  );
  if (!headerMatch) return [];
  const header = sql.slice(headerMatch.index ?? 0);

  const args: ParsedArgument[] = [];
  const block = extractParamBlock(header);
  if (block) {
    for (const param of splitParams(block)) {
      const m = param.match(
        /^"?([A-Za-z0-9_$#]+)"?\s+(?:(IN\s+OUT|INOUT|IN|OUT)\s+)?([\s\S]+)$/i,
      );
      if (!m) continue;
      const inOutRaw = (m[2] ?? "IN").toUpperCase().replace(/\s+/g, " ");
      const in_out = inOutRaw === "INOUT" ? "IN OUT" : (inOutRaw as "IN" | "OUT" | "IN OUT");
      // El tipo termina en DEFAULT, :=, o fin de texto.
      let dataType = m[3]
        .replace(/\s+(DEFAULT|:=)[\s\S]*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (dataType.length > 60) dataType = dataType.slice(0, 60);
      args.push({
        argument_name: m[1].toUpperCase(),
        data_type: dataType || null,
        in_out,
        position: args.length + 1,
      });
    }
  }

  return args;
}

const UNIT_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:EDITIONABLE\s+|NONEDITIONABLE\s+)?(PROCEDURE|FUNCTION|PACKAGE\s+BODY|PACKAGE|TRIGGER|TYPE\s+BODY|TYPE)\s+(?:"?([A-Za-z0-9_$#]+)"?\s*\.\s*)?"?([A-Za-z0-9_$#]+)"?/i;

/** Tamaño mínimo para considerar que un fragmento es un body real. */
const MIN_BODY_LENGTH = 200;

/**
 * Adivina el tipo a partir del prefijo del nombre (heurística útil cuando el
 * código no trae el `CREATE OR REPLACE`).
 */
export function guessObjectTypeFromName(name: string): OracleObjectType | null {
  const n = name.toUpperCase();
  if (/^PKG(_|$)/.test(n) || n.includes("PACKAGE")) return "PACKAGE";
  if (/^(P|SP|PRC|PROC)_/.test(n)) return "PROCEDURE";
  if (/^(F|FN|FUN|FNC)_/.test(n)) return "FUNCTION";
  if (/^(TRG|TR|T)_/.test(n)) return "TRIGGER";
  if (/^(SEQ|SQ)_/.test(n)) return "SEQUENCE";
  if (/^(VW|V)_/.test(n)) return "VIEW";
  if (/^(MV|MVIEW)_/.test(n)) return "MATERIALIZED_VIEW";
  if (/^(T|TB|TBL)_/.test(n)) return "TABLE";
  return null;
}

function toObjectType(unit: string): OracleObjectType | null {
  const u = unit.toUpperCase().replace(/\s+/g, " ");
  if (u === "PROCEDURE") return "PROCEDURE";
  if (u === "FUNCTION") return "FUNCTION";
  if (u.startsWith("PACKAGE")) return "PACKAGE";
  if (u === "TRIGGER") return "TRIGGER";
  if (u.startsWith("TYPE")) return "TABLE";
  return null;
}

export function isPlsqlObjectType(type: OracleObjectType | null): boolean {
  return ["PROCEDURE", "FUNCTION", "PACKAGE", "TRIGGER"].includes(type ?? "");
}

/**
 * Separa un script en sentencias `CREATE OR REPLACE` de forma tolerante:
 * se apoya en las cabeceras y en la marca de fin de cada unidad.
 */
export function splitPlsqlStatements(sql: string): string[] {
  const normalized = (sql ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const headerRe = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:EDITIONABLE\s+|NONEDITIONABLE\s+)?(PROCEDURE|FUNCTION|PACKAGE\s+BODY|PACKAGE|TRIGGER)\b/gi;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(normalized)) !== null) {
    // Ignora ocurrencias que no empiecen en una frontera de sentencia.
    const before = normalized.slice(0, match.index).trimEnd();
    if (before.length === 0 || before.endsWith(";") || before.endsWith("/")) {
      starts.push(match.index);
    }
  }
  if (starts.length === 0) return [normalized];

  const statements: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : normalized.length;
    const chunk = normalized.slice(start, end).replace(/\s*\/\s*$/, "").trim();
    if (chunk) statements.push(chunk);
  }
  return statements;
}

function findMatchingEnd(code: string, name: string): number {
  const re = new RegExp(`\\bEND\\s+(?:"?${name}"?)\\s*;`, "i");
  const match = re.exec(code);
  return match ? match.index + match[0].length : code.length;
}

/**
 * Divide un PACKAGE / PACKAGE BODY en spec y body cuando vienen en el mismo
 * script o cuando solo hay uno de los dos.
 */
function splitPackage(
  sql: string,
): { specification: string | null; body: string | null } {
  const headerRe =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:EDITIONABLE\s+|NONEDITIONABLE\s+)?PACKAGE\s+(BODY\s+)?/gi;
  const positions: { index: number; isBody: boolean }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(sql)) !== null) {
    positions.push({ index: match.index, isBody: Boolean(match[1]) });
  }

  if (positions.length >= 2) {
    // Hay dos bloques: separa por la posición del segundo.
    const first = positions[0];
    const second = positions[1];
    const firstChunk = sql.slice(first.index, second.index).replace(/\s*\/\s*$/, "").trim();
    const secondChunk = sql.slice(second.index).replace(/\s*\/\s*$/, "").trim();
    if (first.isBody) return { specification: secondChunk, body: firstChunk };
    return { specification: firstChunk, body: secondChunk };
  }

  const trimmed = sql.trim();
  const isBody = /\bPACKAGE\s+BODY\b/i.test(trimmed);
  if (isBody) return { specification: null, body: trimmed };
  return { specification: trimmed, body: null };
}

/** Parsea un `CREATE OR REPLACE` de PL/SQL (procedure/función/package/trigger). */
export function parsePlsqlDdl(raw: string): ParsedPlsql {
  const sql = (raw ?? "").replace(/\r\n?/g, "\n").trim();
  const empty: ParsedPlsql = {
    schema_name: null,
    object_name: null,
    object_type: null,
    is_package_body: false,
    specification: null,
    body: null,
    source: sql,
    arguments: [],
  };
  if (!sql) return empty;

  const match = sql.match(UNIT_RE);
  if (!match) return empty;

  const unit = match[1];
  const schema_name = match[2] ? match[2].toUpperCase() : null;
  const object_name = match[3].toUpperCase();
  const object_type = toObjectType(unit);
  const isPackage = object_type === "PACKAGE";

  if (isPackage) {
    const { specification, body } = splitPackage(sql);
    return {
      schema_name,
      object_name,
      object_type,
      is_package_body: /\bPACKAGE\s+BODY\b/i.test(sql.slice(0, match[0].length + 20)),
      specification,
      body,
      source: sql,
      arguments: [],
    };
  }

  return {
    schema_name,
    object_name,
    object_type,
    is_package_body: false,
    specification: null,
    body: null,
    source: sql,
    arguments: parseArguments(sql, object_type),
  };
}

export { findMatchingEnd, MIN_BODY_LENGTH };
