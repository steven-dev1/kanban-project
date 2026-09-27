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

const PLSQL_RE =
  /(\bBEGIN\b|\bDECLARE\b|CREATE\s+OR\s+REPLACE|\bPACKAGE\b|\bPROCEDURE\b|\bFUNCTION\b|\bTRIGGER\b)/i;

interface ScanResult {
  /** Código sin strings ni comentarios (conserva saltos de línea). */
  cleaned: string;
  issues: SyntaxIssue[];
}

/**
 * Recorre el código quitando strings y comentarios (los reemplaza por espacios
 * conservando los saltos de línea) y valida paréntesis, comillas y comentarios.
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
  /** Token que abre/cierra algo ( ; , ( ) etc. ) para separar sentencias. */
  isPunct: boolean;
}

function tokenize(cleaned: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let buffer = "";
  let startLine = 1;

  const flush = () => {
    if (buffer) {
      tokens.push({ value: buffer, line: startLine, isPunct: false });
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
      if (!/\s/.test(ch)) tokens.push({ value: ch, line, isPunct: true });
    }
  }
  flush();
  return tokens;
}

type BlockKind = "BEGIN" | "IF" | "LOOP" | "CASE" | "CASE_STMT";

interface Block {
  kw: BlockKind;
  line: number;
}

interface BlockAnalysis {
  issues: SyntaxIssue[];
  /** Profundidad y contexto por índice de token (para el chequeo de ELSE IF). */
  contextByIndex: Map<number, { depth: number; inPlsql: boolean }>;
}

/**
 * Analiza bloques BEGIN/IF/LOOP/CASE con una pila real, distinguiendo:
 *  - CASE como sentencia (lleva END CASE) o como expresión (lleva END)
 *  - END IF / END LOOP / END CASE
 * Además devuelve, por token, si es ELSE IF realmente mal escrito (mismo bloque).
 */
function analyzeBlocks(tokens: Token[]): BlockAnalysis {
  const issues: SyntaxIssue[] = [];
  const contextByIndex = new Map<number, { depth: number; inPlsql: boolean }>();
  let inPlsql = false;
  for (let i = 0; i < tokens.length; i++) {
    const v = tokens[i].value.toUpperCase();
    if (
      v === "BEGIN" ||
      v === "DECLARE" ||
      v === "PROCEDURE" ||
      v === "FUNCTION" ||
      v === "TRIGGER" ||
      v === "PACKAGE"
    ) {
      inPlsql = true;
      break;
    }
  }

  // Pilas separadas para evitar que un tipo de bloque desincronice a otro.
  // Los CASE llevan su propia pila porque su `END` comparte sintaxis con BEGIN.
  const ctrl: Block[] = []; // BEGIN / IF / LOOP
  const cases: { kind: "CASE" | "CASE_STMT"; line: number }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const up = token.value.toUpperCase();
    contextByIndex.set(i, { depth: ctrl.length + cases.length, inPlsql });

    if (up === "BEGIN") {
      ctrl.push({ kw: "BEGIN", line: token.line });
      continue;
    }
    if (up === "IF") {
      ctrl.push({ kw: "IF", line: token.line });
      continue;
    }
    if (up === "LOOP") {
      ctrl.push({ kw: "LOOP", line: token.line });
      continue;
    }
    if (up === "CASE") {
      const prev = i > 0 ? tokens[i - 1] : null;
      const prevValue = prev?.value ?? "";
      const prevWord = prevValue.toUpperCase();
      const startsStatement =
        !prev ||
        prevValue === ";" ||
        ["BEGIN", "THEN", "ELSE", "LOOP", "EXCEPTION", "DECLARE", "IS", "AS"].includes(prevWord);
      const startsExpression =
        prevValue === ":=" ||
        prevValue === "(" ||
        prevValue === "," ||
        prevValue === "=" ||
        prevValue === ">" ||
        prevValue === "<" ||
        prevWord === "RETURN";
      cases.push({
        kind: startsStatement && !startsExpression ? "CASE_STMT" : "CASE",
        line: token.line,
      });
      continue;
    }

    if (up === "END") {
      const next = tokens[i + 1]?.value.toUpperCase();
      if (next === "IF") {
        closeCtrl("IF", token.line);
        i++;
        continue;
      }
      if (next === "LOOP") {
        closeCtrl("LOOP", token.line);
        i++;
        continue;
      }
      if (next === "CASE") {
        // END CASE solo corresponde a una sentencia CASE.
        const c = cases.pop();
        if (!c || c.kind !== "CASE_STMT") {
          issues.push({
            severity: "error",
            line: token.line,
            message: c
              ? `END CASE inesperado: el CASE de la línea ${c.line} es una expresión`
              : "END CASE sin CASE correspondiente",
          });
        }
        i++;
        continue;
      }
      // `END;` sin sufijo: cierra el CASE más reciente si existe; si no, un
      // bloque de control (BEGIN, o IF/LOOP huérfano).
      if (cases.length > 0) {
        const c = cases.pop();
        if (c?.kind === "CASE_STMT") {
          issues.push({
            severity: "error",
            line: token.line,
            message: `Se esperaba END CASE (abierto en la línea ${c.line})`,
          });
        }
        continue;
      }
      const b = ctrl.pop();
      if (b && b.kw !== "BEGIN") {
        issues.push(endMismatch(b.kw as "IF" | "LOOP", token.line, b));
      }
      continue;
    }
  }

  function closeCtrl(kind: "IF" | "LOOP", line: number) {
    const b = ctrl[ctrl.length - 1];
    if (b?.kw === kind) {
      ctrl.pop();
      return;
    }
    // El tope no coincide: normalmente hay un BEGIN interno todavía abierto
    // por un `END;` que el lexer no pudo emparejar. Para no generar falsos
    // positivos, cerramos el bloque del tipo esperado si existe en la pila;
    // si no existe, lo ignoramos (los bloques realmente sin cerrar se
    // reportan al final). Nunca borramos la cola, solo el elemento elegido.
    for (let k = ctrl.length - 1; k >= 0; k--) {
      if (ctrl[k].kw === kind) {
        ctrl.splice(k, 1);
        return;
      }
    }
    void line;
  }

  for (const open of cases) {
    issues.push({
      severity: open.kind === "CASE_STMT" ? "error" : "warning",
      line: open.line,
      message: open.kind === "CASE_STMT" ? "CASE sin END CASE" : "CASE (expresión) sin END",
    });
  }
  for (const open of ctrl) {
    if (open.kw === "BEGIN") {
      issues.push({ severity: "warning", line: open.line, message: "BEGIN sin END" });
    } else {
      issues.push({
        severity: "error",
        line: open.line,
        message: `${open.kw} sin cerrar (falta END ${open.kw})`,
      });
    }
  }

  return { issues, contextByIndex };
}

function endMismatch(
  kw: "IF" | "LOOP" | "CASE",
  line: number,
  b: Block | undefined,
): SyntaxIssue {
  return {
    severity: "error",
    line,
    message: b
      ? `END ${kw} inesperado: se esperaba cerrar ${b.kw === "CASE_STMT" ? "CASE" : b.kw} (línea ${b.line})`
      : `END ${kw} sin ${kw} correspondiente`,
  };
}

function analyzeStatements(tokens: Token[], context: BlockAnalysis["contextByIndex"]): SyntaxIssue[] {
  const issues: SyntaxIssue[] = [];
  const up = (i: number) => tokens[i]?.value.toUpperCase();

  for (let i = 0; i < tokens.length; i++) {
    const t = up(i);

    // `ELSE IF` real (error): el IF continua al ELSE en la MISMA línea, sin
    // punto y coma entre medio. Si están en líneas distintas suele ser un
    // `ELSE` que cierra una rama y un `IF` anidado nuevo (válido), o un
    // comentario entre ambos, así que no lo reportamos.
    if (t === "ELSE" && up(i + 1) === "IF") {
      const sameLine = tokens[i].line === tokens[i + 1].line;
      const nested = context.get(i + 1)?.depth ?? 0;
      const outer = context.get(i)?.depth ?? 0;
      // Solo error si es la misma línea y el IF no abre un bloque más profundo
      // (en `ELSE IF` el IF no tiene su propio `END IF`).
      if (sameLine && nested <= outer) {
        issues.push({
          severity: "error",
          line: tokens[i].line,
          message: "Usa ELSIF en lugar de ELSE IF",
        });
      }
    }

    // IF / ELSIF deben llevar THEN dentro de PL/SQL. Excluye el `IF` de un
    // `END IF` y las funciones SQL (`IF(...)` no existe en Oracle SQL).
    if (t === "IF" || t === "ELSIF") {
      const prev = up(i - 1);
      const skip = t === "IF" && (prev === "END" || prev === ")");
      if (!skip && context.get(i)?.inPlsql) {
        let j = i + 1;
        let hasThen = false;
        let depth = 0;
        while (j < tokens.length && j < i + 60) {
          const v = up(j);
          if (v === "(") depth++;
          else if (v === ")") depth--;
          else if (v === "THEN" && depth <= 0) {
            hasThen = true;
            break;
          } else if ((v === ";" || v === "END") && depth <= 0) {
            break;
          }
          j++;
        }
        if (!hasThen) {
          issues.push({ severity: "error", line: tokens[i].line, message: `${t} sin THEN` });
        }
      }
    }

    // END IF / END LOOP / END CASE deben terminar con ;
    if (t === "END") {
      const n1 = up(i + 1);
      if (n1 === "IF" || n1 === "LOOP" || n1 === "CASE") {
        // El `;` puede venir tras un identificador opcional (END LOOP nombre;)
        let j = i + 2;
        if (!tokens[j]?.isPunct) j++;
        if (up(j) !== ";") {
          issues.push({
            severity: "warning",
            line: tokens[i].line,
            message: `Falta ";" después de END ${n1}`,
          });
        }
        i++;
      }
    }
  }

  // DECLARE requiere BEGIN
  const hasDeclare = tokens.some((tok) => tok.value.toUpperCase() === "DECLARE");
  const hasBegin = tokens.some((tok) => tok.value.toUpperCase() === "BEGIN");
  if (hasDeclare && !hasBegin) {
    issues.push({ severity: "warning", line: tokens[0]?.line ?? 1, message: "DECLARE sin BEGIN" });
  }

  // `STRING` no es un tipo de Oracle. `VARCHAR` es un sinónimo válido de
  // VARCHAR2, así que NO se reporta.
  const seen = new Set<string>();
  for (const tok of tokens) {
    const v = tok.value.toUpperCase();
    if (v === "STRING" && !seen.has(v)) {
      seen.add(v);
      issues.push({
        severity: "warning",
        line: tok.line,
        message: "'STRING' no es un tipo válido en Oracle (usa VARCHAR2)",
      });
    }
    if (v === "BOOL" && !seen.has(v)) {
      seen.add(v);
      issues.push({
        severity: "warning",
        line: tok.line,
        message: "En Oracle no existe BOOL; usa BOOLEAN o NUMBER(1)",
      });
    }
    if ((v === "INT" || v === "DATETIME") && !seen.has(v)) {
      seen.add(v);
      issues.push({
        severity: "warning",
        line: tok.line,
        message: `'${v}' no es un tipo habitual en Oracle (usa NUMBER / DATE)`,
      });
    }
  }

  // Unidades de programa: IS/AS obligatorio en PROCEDURE/FUNCTION/PACKAGE.
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
        // La cabecera puede terminar en `;` (package spec sin cuerpo en línea).
        while (k < tokens.length) {
          const v = up(k);
          if (v === "IS" || v === "AS") {
            found = true;
            break;
          }
          if (v === "BEGIN" || v === ";" || v === "END") break;
          k++;
        }
        // Un package spec sin `IS` es inusual, pero puede declararse como
        // `PACKAGE x IS ...`; si no aparece, avisamos solo para rutinas.
        if (!found && (unit === "PROCEDURE" || unit === "FUNCTION")) {
          issues.push({
            severity: "error",
            line: tokens[j].line,
            message: "Falta IS o AS en la declaración de la unidad de programa",
          });
        }
      }
    }
  }

  // Nombre del END debe coincidir con una unidad declarada.
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

  // Punto y coma duplicado (;;) es casi siempre un error de tipeo.
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === ";" && tokens[i + 1]?.value === ";") {
      issues.push({
        severity: "warning",
        line: tokens[i + 1].line,
        message: "Punto y coma (;) duplicado",
      });
      break;
    }
  }

  return issues;
}

/**
 * Valida sintaxis PL/SQL de forma heurística (no es un compilador real).
 * Detecta paréntesis/comillas/comentarios sin balancear, bloques
 * BEGIN/END, IF/ELSIF, LOOP/END LOOP y CASE, y avisos comunes, evitando
 * falsos positivos como ELSE IF dentro de otro bloque o VARCHAR (válido en Oracle).
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
    const tokens = tokenize(cleaned);
    const blocks = analyzeBlocks(tokens);
    for (const issue of blocks.issues) {
      (issue.severity === "error" ? errors : warnings).push(issue);
    }
    for (const issue of analyzeStatements(tokens, blocks.contextByIndex)) {
      (issue.severity === "error" ? errors : warnings).push(issue);
    }

    // El punto y coma final se evalúa sobre el código sin comentarios ni
    // strings, ignorando un `/` final de SQL*Plus.
    const cleanedTrimmed = cleaned.replace(/\/\s*$/, "").trim();
    if (!cleanedTrimmed.endsWith(";")) {
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
  } else if (!cleaned.replace(/\/\s*$/, "").trim().endsWith(";")) {
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
