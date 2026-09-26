export type IssueSeverity = "error" | "warning";

export interface SyntaxIssue {
  severity: IssueSeverity;
  line: number;
  message: string;
}

export interface ValidationResult {
  isPlsql: boolean;
  errors: SyntaxIssue[];
  warnings: SyntaxIssue[];
}

const PLSQL_RE = /(\bBEGIN\b|\bDECLARE\b|CREATE\s+OR\s+REPLACE|\bPACKAGE\b|\bPROCEDURE\b|\bFUNCTION\b|\bTRIGGER\b)/i;

interface ScanResult {
  cleaned: string;
  issues: SyntaxIssue[];
}

/**
 * Recorre el código quitando strings y comentarios (los reemplaza por espacios
 * conservando los saltos de línea) y a la vez valida paréntesis, comillas y
 * comentarios de bloque.
 */
function scan(code: string): ScanResult {
  const chars = code.replace(/\r\n?/g, "\n").split("");
  const cleaned = chars.slice();
  const issues: SyntaxIssue[] = [];
  const parenStack: { line: number }[] = [];
  let line = 1;
  let i = 0;
  const n = chars.length;

  while (i < n) {
    const c = chars[i];

    if (c === "\n") {
      line++;
      i++;
      continue;
    }

    // Comentario de línea: -- ...
    if (c === "-" && chars[i + 1] === "-") {
      while (i < n && chars[i] !== "\n") {
        cleaned[i] = " ";
        i++;
      }
      continue;
    }

    // Comentario de bloque: /* ... */
    if (c === "/" && chars[i + 1] === "*") {
      const startLine = line;
      cleaned[i] = " ";
      cleaned[i + 1] = " ";
      i += 2;
      let closed = false;
      while (i < n) {
        if (chars[i] === "\n") line++;
        if (chars[i] === "*" && chars[i + 1] === "/") {
          cleaned[i] = " ";
          cleaned[i + 1] = " ";
          i += 2;
          closed = true;
          break;
        }
        cleaned[i] = " ";
        i++;
      }
      if (!closed) {
        issues.push({ severity: "error", line: startLine, message: "Comentario /* sin cerrar" });
      }
      continue;
    }

    // Cadena: '...' (con '' como escape)
    if (c === "'") {
      const startLine = line;
      cleaned[i] = " ";
      i++;
      let closed = false;
      while (i < n) {
        if (chars[i] === "\n") line++;
        if (chars[i] === "'") {
          if (chars[i + 1] === "'") {
            cleaned[i] = " ";
            cleaned[i + 1] = " ";
            i += 2;
            continue;
          }
          cleaned[i] = " ";
          i++;
          closed = true;
          break;
        }
        cleaned[i] = " ";
        i++;
      }
      if (!closed) {
        issues.push({ severity: "error", line: startLine, message: "Cadena sin cerrar (falta ')" });
      }
      continue;
    }

    if (c === "(") {
      parenStack.push({ line });
      i++;
      continue;
    }
    if (c === ")") {
      if (parenStack.length === 0) {
        issues.push({ severity: "error", line, message: 'Paréntesis ")" sin abrir' });
      } else {
        parenStack.pop();
      }
      i++;
      continue;
    }

    i++;
  }

  for (const open of parenStack) {
    issues.push({ severity: "error", line: open.line, message: 'Paréntesis "(" sin cerrar' });
  }

  return { cleaned: cleaned.join(""), issues };
}

interface Token {
  value: string;
  line: number;
}

function tokenize(cleaned: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let buffer = "";
  let startLine = 1;

  const flush = () => {
    if (buffer) {
      tokens.push({ value: buffer, line: startLine });
      buffer = "";
    }
  };

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "\n") {
      flush();
      line++;
      continue;
    }
    if (/[A-Za-z0-9_$#]/.test(ch)) {
      if (!buffer) startLine = line;
      buffer += ch;
    } else {
      flush();
      if (!/\s/.test(ch)) tokens.push({ value: ch, line });
    }
  }
  flush();
  return tokens;
}

function analyzeBlocks(cleaned: string): SyntaxIssue[] {
  const issues: SyntaxIssue[] = [];
  const tokens = tokenize(cleaned);
  const stack: { kw: "BEGIN" | "IF" | "LOOP" | "CASE"; line: number }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const up = tokens[i].value.toUpperCase();

    if (up === "BEGIN") {
      stack.push({ kw: "BEGIN", line: tokens[i].line });
      continue;
    }
    if (up === "IF") {
      stack.push({ kw: "IF", line: tokens[i].line });
      continue;
    }
    if (up === "LOOP") {
      stack.push({ kw: "LOOP", line: tokens[i].line });
      continue;
    }
    if (up === "CASE") {
      // Puede ser CASE statement (END CASE) o CASE expression (END).
      stack.push({ kw: "CASE", line: tokens[i].line });
      continue;
    }
    if (up === "END") {
      const next = tokens[i + 1]?.value.toUpperCase();
      if (next === "IF" || next === "LOOP" || next === "CASE") {
        closeBlock(stack, next, tokens[i].line, issues);
        i++;
        continue;
      }
      const top = stack[stack.length - 1];
      if (top?.kw === "BEGIN" || top?.kw === "CASE") {
        stack.pop();
      } else if (top) {
        issues.push({
          severity: "error",
          line: tokens[i].line,
          message: `END inesperado: falta END ${top.kw} (abierto en la línea ${top.line})`,
        });
      } else {
        issues.push({
          severity: "warning",
          line: tokens[i].line,
          message:
            "END sin BEGIN (normal en package specification o en la unidad de programa)",
        });
      }
      continue;
    }
  }

  for (const open of stack) {
    if (open.kw === "BEGIN" || open.kw === "CASE") {
      issues.push({
        severity: "warning",
        line: open.line,
        message: `${open.kw === "CASE" ? "CASE" : "BEGIN"} sin END`,
      });
    } else {
      issues.push({
        severity: "error",
        line: open.line,
        message: `${open.kw} sin cerrar (falta END ${open.kw})`,
      });
    }
  }

  return issues;
}

function closeBlock(
  stack: { kw: "BEGIN" | "IF" | "LOOP" | "CASE"; line: number }[],
  kw: "IF" | "LOOP" | "CASE",
  line: number,
  issues: SyntaxIssue[],
) {
  const top = stack[stack.length - 1];
  if (top?.kw === kw) {
    stack.pop();
  } else {
    issues.push({
      severity: "error",
      line,
      message: top
        ? `END ${kw} inesperado: se esperaba cerrar ${top.kw} (línea ${top.line})`
        : `END ${kw} sin ${kw} correspondiente`,
    });
  }
}

function analyzeStatements(cleaned: string): SyntaxIssue[] {
  const issues: SyntaxIssue[] = [];
  const tokens = tokenize(cleaned);
  const up = (i: number) => tokens[i]?.value.toUpperCase();

  // ELSE IF (debe ser ELSIF)
  for (let i = 0; i < tokens.length; i++) {
    if (up(i) === "ELSE" && up(i + 1) === "IF") {
      issues.push({
        severity: "error",
        line: tokens[i].line,
        message: "Usa ELSIF en lugar de ELSE IF",
      });
    }

    // IF / ELSIF deben llevar THEN
    const t = up(i);
    if (t === "IF" || t === "ELSIF") {
      let j = i + 1;
      let hasThen = false;
      while (j < tokens.length) {
        const v = up(j);
        if (v === "THEN") {
          hasThen = true;
          break;
        }
        if (v === ";" || v === "END") break;
        j++;
      }
      if (!hasThen) {
        issues.push({ severity: "error", line: tokens[i].line, message: `${t} sin THEN` });
      }
    }

    // END IF / END LOOP / END CASE deben terminar con ;
    if (t === "END") {
      const n1 = up(i + 1);
      if (n1 === "IF" || n1 === "LOOP" || n1 === "CASE") {
        if (up(i + 2) !== ";") {
          issues.push({
            severity: "warning",
            line: tokens[i].line,
            message: `Falta ";" después de END ${n1}`,
          });
        }
        i++; // no tratar IF/LOOP/CASE de este END como una apertura
      }
    }
  }

  // DECLARE requiere BEGIN
  const hasDeclare = tokens.some((tok) => tok.value.toUpperCase() === "DECLARE");
  const hasBegin = tokens.some((tok) => tok.value.toUpperCase() === "BEGIN");
  if (hasDeclare && !hasBegin) {
    issues.push({ severity: "warning", line: tokens[0]?.line ?? 1, message: "DECLARE sin BEGIN" });
  }

  // Tipos comunes mal escritos
  const seenType = new Set<string>();
  for (const tok of tokens) {
    const v = tok.value.toUpperCase();
    if (v === "VARCHAR" && !seenType.has(v)) {
      seenType.add(v);
      issues.push({
        severity: "warning",
        line: tok.line,
        message: "En Oracle se usa VARCHAR2 en lugar de VARCHAR",
      });
    }
    if (v === "STRING" && !seenType.has(v)) {
      seenType.add(v);
      issues.push({ severity: "warning", line: tok.line, message: "'STRING' no es un tipo válido en Oracle" });
    }
  }

  // Unidades de programa (IS/AS obligatorio en PROCEDURE/FUNCTION/PACKAGE)
  for (let i = 0; i + 3 < tokens.length; i++) {
    if (up(i) === "CREATE" && up(i + 1) === "OR" && up(i + 2) === "REPLACE") {
      let j = i + 3;
      while (
        j < tokens.length &&
        !["PROCEDURE", "FUNCTION", "PACKAGE", "TRIGGER", "VIEW", "TABLE", "TYPE"].includes(up(j))
      ) {
        j++;
      }
      const unit = up(j);
      if (unit === "PROCEDURE" || unit === "FUNCTION" || unit === "PACKAGE") {
        let k = j + 1;
        let found = false;
        while (k < tokens.length) {
          const v = up(k);
          if (v === "IS" || v === "AS") {
            found = true;
            break;
          }
          if (v === "BEGIN") break;
          k++;
        }
        if (!found) {
          issues.push({
            severity: "error",
            line: tokens[j].line,
            message: "Falta IS o AS en la declaración de la unidad de programa",
          });
        }
      }
    }
  }

  // Nombre del END debe coincidir con una unidad declarada
  const declared = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const v = up(i);
    if (v === "PROCEDURE" || v === "FUNCTION" || v === "PACKAGE") {
      let j = i + 1;
      if (v === "PACKAGE" && up(j) === "BODY") j++;
      const name = up(j);
      if (name && /^[A-Z0-9_$#]+$/.test(name)) declared.add(name);
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (up(i) === "END") {
      const n1 = up(i + 1);
      if (n1 && n1 !== ";" && n1 !== "IF" && n1 !== "LOOP" && n1 !== "CASE") {
        if (/^[A-Z0-9_$#]+$/.test(n1) && !declared.has(n1)) {
          issues.push({
            severity: "warning",
            line: tokens[i].line,
            message: `END ${n1} no coincide con ninguna unidad declarada`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Valida sintaxis PL/SQL de forma heurística (no es un compilador real).
 * Detecta paréntesis/comillas/comentarios sin balancear, bloques
 * BEGIN/END, IF/END IF y LOOP/END LOOP, y avisos comunes.
 */
export function validateOracleCode(code: string): ValidationResult {
  const normalized = (code ?? "").replace(/\r\n?/g, "\n");
  const trimmed = normalized.trim();

  if (!trimmed) {
    return {
      isPlsql: false,
      errors: [{ severity: "error", line: 1, message: "El código está vacío" }],
      warnings: [],
    };
  }

  const isPlsql = PLSQL_RE.test(trimmed);
  const { cleaned, issues } = scan(normalized);
  const warnings: SyntaxIssue[] = [];
  const errors: SyntaxIssue[] = [];

  for (const issue of issues) {
    (issue.severity === "error" ? errors : warnings).push(issue);
  }

  if (isPlsql) {
    for (const issue of analyzeBlocks(cleaned)) {
      (issue.severity === "error" ? errors : warnings).push(issue);
    }
    for (const issue of analyzeStatements(cleaned)) {
      (issue.severity === "error" ? errors : warnings).push(issue);
    }

    if (!trimmed.endsWith(";")) {
      warnings.push({
        severity: "warning",
        line: normalized.split("\n").length,
        message: "El bloque no termina con punto y coma (;)",
      });
    }

    if (
      /CREATE\s+OR\s+REPLACE/i.test(cleaned) &&
      !/(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|VIEW|TYPE|SYNONYM|SEQUENCE)/i.test(cleaned)
    ) {
      warnings.push({
        severity: "warning",
        line: 1,
        message: "CREATE OR REPLACE sin especificar el tipo de objeto",
      });
    }
  } else if (!trimmed.endsWith(";")) {
    warnings.push({
      severity: "warning",
      line: normalized.split("\n").length,
      message: "El SQL no termina con punto y coma (;)",
    });
  }

  const sortByLine = (a: SyntaxIssue, b: SyntaxIssue) => a.line - b.line;
  errors.sort(sortByLine);
  warnings.sort(sortByLine);

  return { isPlsql, errors, warnings };
}
