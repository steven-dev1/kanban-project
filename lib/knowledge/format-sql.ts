import { KNOWN_FUNCTIONS, tokenizeLines, type Token } from "@/lib/knowledge/highlight";

/**
 * Palabras que comienzan una cláusula mayor y por tanto van en su propia línea.
 */
const MAJOR_CLAUSES = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "ORDER",
  "HAVING",
  "UNION",
  "INTERSECT",
  "MINUS",
  "INSERT",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "MERGE",
  "RETURNING",
  "CONNECT",
  "START",
  "FETCH",
  "WITH",
]);

/** Cláusulas de dos palabras que viajan juntas. */
const CLAUSE_PAIRS = new Set(["GROUP BY", "ORDER BY", "UNION ALL", "INSERT INTO"]);

/** Modificadores de JOIN que deben preceder a JOIN en la misma línea. */
const JOIN_MODIFIERS = /^(INNER|LEFT|RIGHT|FULL|CROSS|NATURAL|OUTER)$/;

const NO_SPACE_BEFORE = new Set([",", ";", ")", "."]);
const NO_SPACE_AFTER = new Set(["(", "."]);

const OPEN_BLOCK = new Set(["BEGIN", "LOOP"]);
const DECLARE_BLOCK = new Set(["DECLARE", "IS", "AS"]);
const IF_BLOCK = new Set(["IF", "ELSIF"]);

interface Piece {
  text: string;
  kind: Token["kind"];
}

function toPieces(code: string): Piece[] {
  const pieces: Piece[] = [];
  for (const token of tokenizeLines(code).flat()) {
    if (token.kind === "plain" && /^\s+$/.test(token.text)) continue;
    pieces.push({ text: token.text, kind: token.kind });
  }
  return pieces;
}

/**
 * Formateador SQL/PL/SQL legible:
 *  - Palabras clave en MAYÚSCULAS.
 *  - Cláusulas mayores (SELECT/FROM/WHERE/JOIN...) en su propia línea, solo a
 *    nivel del statement (no dentro de una subconsulta en línea).
 *  - Columnas y condiciones indentadas 2 espacios; AND/OR al inicio de línea.
 *  - Subconsultas indentadas según la profundidad de paréntesis.
 *  - Bloques PL/SQL (BEGIN/IF/LOOP) indentados por nivel.
 * Respeta strings, comentarios y su contenido.
 */
export function formatSql(code: string): string {
  const pieces = toPieces(code);
  if (pieces.length === 0) return code;

  const out: string[] = [];
  let blockIndent = 0; // nivel de bloque PL/SQL
  let parenDepth = 0; // profundidad de paréntesis
  let line = "";
  let prev: Piece | null = null;
  let expressionCase = false;

  const indentStr = () => "  ".repeat(Math.max(0, blockIndent + parenDepth));
  const startLine = (extra = 0) => {
    line = "  ".repeat(Math.max(0, blockIndent + parenDepth + extra));
  };
  const push = (text: string, spaceBefore: boolean) => {
    if (!line) startLine();
    if (line.trim() && spaceBefore && !line.endsWith(" ")) line += " ";
    line += text;
  };
  const flush = () => {
    const trimmed = line.replace(/\s+$/, "");
    if (trimmed.trim()) out.push(trimmed);
    line = "";
  };

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const text = piece.kind === "keyword" ? piece.text.toUpperCase() : piece.text;
    const upper = piece.text.toUpperCase();
    const prevUpper = prev?.text.toUpperCase() ?? "";
    const nextUpper = pieces[i + 1]?.text.toUpperCase() ?? "";
    const pair = nextUpper ? `${upper} ${nextUpper}` : "";

    // Comentarios
    if (piece.kind === "comment") {
      if (text.startsWith("--")) {
        push(text, true);
        flush();
      } else {
        flush();
        out.push(`${indentStr()}${text}`);
      }
      prev = piece;
      continue;
    }

    // Paréntesis: ajustan la profundidad para indentar subconsultas.
    if (piece.text === "(") {
      const funcParen = !!prev && KNOWN_FUNCTIONS.has(prev.text.toLowerCase());
      push("(", !funcParen);
      // Los paréntesis de una lista de columnas (SELECT a, b) o de una función
      // no abren bloque; los de una subconsulta sí. Detectamos subconsulta por
      // el siguiente token.
      const isSubquery =
        nextUpper === "SELECT" || nextUpper === "WITH" || nextUpper === "SELECT\n";
      if (isSubquery) {
        flush();
        parenDepth++;
      }
      prev = piece;
      continue;
    }
    if (piece.text === ")") {
      const closesSubquery = parenDepth > 0;
      if (closesSubquery) {
        flush();
        parenDepth = Math.max(0, parenDepth - 1);
        startLine();
        push(")", false);
      } else {
        push(")", false);
      }
      prev = piece;
      continue;
    }

    // Fin de sentencia
    if (piece.text === ";") {
      push(";", false);
      flush();
      prev = piece;
      continue;
    }
    if (piece.text === ",") {
      push(",", false);
      prev = piece;
      continue;
    }

    // `END IF` / `END LOOP` / `END CASE` juntos.
    if (prevUpper === "END" && (upper === "IF" || upper === "LOOP" || upper === "CASE")) {
      push(text, true);
      prev = piece;
      continue;
    }
    if (upper === "END") {
      flush();
      blockIndent = Math.max(0, blockIndent - 1);
      startLine();
      push(text, false);
      prev = piece;
      continue;
    }

    // `BEGIN` al nivel de DECLARE.
    if (upper === "BEGIN") {
      flush();
      blockIndent = Math.max(0, blockIndent - 1);
      startLine();
      push(text, false);
      flush();
      blockIndent++;
      prev = piece;
      continue;
    }

    if (IF_BLOCK.has(upper)) {
      flush();
      startLine();
      push(text, false);
      prev = piece;
      continue;
    }
    if (upper === "THEN") {
      push(text, true);
      flush();
      blockIndent++;
      prev = piece;
      continue;
    }
    if (upper === "ELSE") {
      flush();
      blockIndent = Math.max(0, blockIndent - 1);
      startLine();
      push(text, false);
      flush();
      blockIndent++;
      prev = piece;
      continue;
    }

    if (OPEN_BLOCK.has(upper) || DECLARE_BLOCK.has(upper)) {
      push(text, true);
      flush();
      blockIndent++;
      prev = piece;
      continue;
    }

    // JOIN y modificadores: agrupar "LEFT OUTER JOIN" en una línea.
    if (JOIN_MODIFIERS.test(upper)) {
      // Si ya empezamos una línea con otro modificador, se añade a esa línea;
      // si el anterior no era modificador, abrimos nueva línea.
      if (!JOIN_MODIFIERS.test(prevUpper)) {
        flush();
        startLine();
      }
      push(text, true);
      prev = piece;
      continue;
    }
    if (upper === "JOIN") {
      if (JOIN_MODIFIERS.test(prevUpper)) {
        push(text, true);
      } else {
        flush();
        startLine();
        push(text, false);
      }
      prev = piece;
      continue;
    }

    // Cláusulas mayores: nueva línea (solo a nivel del statement, no dentro de
    // paréntesis, para no romper subconsultas en línea).
    if (MAJOR_CLAUSES.has(upper) || CLAUSE_PAIRS.has(pair)) {
      flush();
      startLine();
      if (CLAUSE_PAIRS.has(pair) && nextUpper) {
        push(`${text} ${nextUpper}`, false);
        i++;
        prev = { text: nextUpper, kind: pieces[i].kind };
        continue;
      }
      push(text, false);
      prev = piece;
      continue;
    }

    // AND/OR/ON: nueva línea indentada.
    if (upper === "AND" || upper === "OR" || upper === "ON") {
      flush();
      startLine(1);
      push(text, false);
      prev = piece;
      continue;
    }

    // CASE: si es expresión (dentro de sum(...), =, etc.) se mantiene en línea;
    // si es sentencia, las ramas WHEN van en líneas indentadas.
    if (upper === "CASE") {
      expressionCase = prev ? prev.text === "(" || prev.text === "," || prev.text === "=" : false;
      push(text, !expressionCase);
      prev = piece;
      continue;
    }
    if (upper === "WHEN") {
      if (expressionCase) {
        push(text, true);
      } else {
        flush();
        startLine();
        push(text, false);
      }
      prev = piece;
      continue;
    }

    const noSpaceAfterPrev = prev ? NO_SPACE_AFTER.has(prev.text) : false;
    const tight = NO_SPACE_BEFORE.has(piece.text);
    // Signo unario: "-12" no lleva espacio entre el signo y el número.
    const afterUnarySign = prev?.text === "-" || prev?.text === "+";
    push(text, !tight && !noSpaceAfterPrev && !afterUnarySign);
    prev = piece;
  }

  flush();

  return out
    .join("\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, (m, offset) => (offset === 0 ? m : " ")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
