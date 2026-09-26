import { tokenizeLines, type Token } from "@/lib/knowledge/highlight";

const BREAK_KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "ORDER",
  "HAVING",
  "UNION",
  "INTERSECT",
  "MINUS",
  "JOIN",
  "ON",
  "INSERT",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "MERGE",
  "BEGIN",
  "EXCEPTION",
  "LOOP",
  "IF",
  "ELSIF",
  "ELSE",
  "END",
  "THEN",
  "WHEN",
  "AND",
  "OR",
  "RETURN",
  "DECLARE",
]);

const NO_SPACE_BEFORE = new Set([",", ";", ")", "."]);

/**
 * Formateador SQL/PL/SQL ligero: separa por palabras clave mayores, pone en
 * mayúsculas las palabras clave y respeta strings y comentarios.
 * No altera el contenido de strings ni comentarios.
 */
export function formatSql(code: string): string {
  const tokens: Token[] = tokenizeLines(code).flat();
  if (tokens.length === 0) return code;

  const lines: string[] = [];
  let current = "";
  let prevKind: Token["kind"] | null = null;

  const flush = () => {
    const trimmed = current.trimEnd();
    if (trimmed.trim()) lines.push(trimmed);
    current = "";
  };

  for (const token of tokens) {
    if (token.kind === "comment") {
      current += (current ? " " : "") + token.text;
      if (token.text.startsWith("--")) flush();
      prevKind = token.kind;
      continue;
    }

    const upper = token.text.toUpperCase();
    const isBreak = token.kind === "keyword" && BREAK_KEYWORDS.has(upper);
    if (isBreak) flush();

    const text = token.kind === "keyword" ? upper : token.text;
    const tightBefore = NO_SPACE_BEFORE.has(token.text) || (token.text === "(" && prevKind === "function");
    current += (current && !tightBefore ? " " : "") + text;
    prevKind = token.kind;

    if (token.text === ";") flush();
  }
  flush();

  // Indenta las continuaciones que empiezan con AND/OR/ON/WHEN/THEN.
  return lines
    .map((line) => {
      const first = line.split(/\s+/)[0]?.toUpperCase() ?? "";
      if (["AND", "OR", "ON", "WHEN", "THEN", "ELSIF", "ELSE"].includes(first)) {
        return `  ${line}`;
      }
      return line;
    })
    .join("\n");
}
