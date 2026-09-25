export type TokenKind =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "builtin"
  | "identifier"
  | "operator"
  | "plain";

export interface SqlToken {
  kind: TokenKind;
  value: string;
}

const KEYWORDS = new Set(
  `SELECT FROM WHERE AND OR NOT NULL INSERT INTO VALUES UPDATE SET DELETE CREATE OR REPLACE
   ALTER DROP TABLE VIEW INDEX SEQUENCE TRIGGER PROCEDURE FUNCTION PACKAGE BODY BEGIN END
   DECLARE EXCEPTION IF THEN ELSE ELSIF LOOP FOR WHILE EXIT RETURN RETURNING IS AS WITH
   CASE WHEN ORDER BY GROUP HAVING DISTINCT ALL UNION INTERSECT MINUS JOIN LEFT RIGHT INNER
   OUTER FULL CROSS ON USING IN EXISTS BETWEEN LIKE IS NULL DEFAULT CONSTRAINT PRIMARY KEY
   FOREIGN REFERENCES UNIQUE CHECK GRANT REVOKE COMMIT ROLLBACK SAVEPOINT LOCK CURSOR FETCH
   OPEN CLOSE BULK COLLECT LIMIT FORALL PRAGMA AUTHID DETERMINISTIC PARALLEL_ENABLE RESULT_CACHE
   OVER PARTITION ROWS RANGE PRECEDING FOLLOWING CURRENT ROW NUMBER ASC DESC NOCACHE CACHE
   MINVALUE MAXVALUE START INCREMENT CYCLE NOCYCLE MATERIALIZED REFRESH FAST COMPLETE
   FORCE NOFORCE ENABLE DISABLE VALIDATE NOVALIDATE COMMENT COLUMN TYPE RECORD SUBTYPE
   CONSTANT ROWTYPE PCTFREE INITRANS STORAGE TABLESPACE NOLOGGING LOGGING TRUNCATE MERGE
   MATCHED SOURCE TARGET RAISE GOTO LABEL OUT NOCOPY PIPE PIPELINED ROW CONSTRUCTOR`
    .split(/\s+/)
    .filter(Boolean)
    .map((k) => k.toUpperCase()),
);

const BUILTINS = new Set(
  `COUNT SUM AVG MIN MAX NVL NVL2 DECODE COALESCE TO_CHAR TO_DATE TO_NUMBER SUBSTR SUBSTRING
   INSTR LENGTH TRIM LTRIM RTRIM UPPER LOWER INITCAP REPLACE TRANSLATE ROUND TRUNC MOD ABS
   SIGN CEIL FLOOR POWER SQRT GREATEST LEAST LISTAGG ROW_NUMBER RANK DENSE_RANK LAG LEAD
   FIRST_VALUE LAST_VALUE SYSDATE SYSTIMESTAMP CURRENT_DATE USERENV SYS_CONTEXT EMPTY_CLOB
   EMPTY_BLOB DBMS_OUTPUT DBMS_LOB UTL_FILE REGEXP_LIKE REGEXP_REPLACE REGEXP_SUBSTR CAST
   EXTRACT XMLAGG JSON_VALUE JSON_OBJECT NEXTVAL CURRVAL RAISE_APPLICATION_ERROR SQLERRM
   SQLCODE DBMS_UTILITY DBMS_SESSION UTL_RAW`
    .split(/\s+/)
    .filter(Boolean)
    .map((k) => k.toUpperCase()),
);

const MASTER =
  /(\/\*[\s\S]*?\*\/|--[^\n]*)|('(?:[^']|'')*'|"(?:[^"]|"")*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_$#]*)|(\s+)|([^\sA-Za-z0-9_])/g;

/**
 * Tokenizador ligero de SQL/PLSQL. Devuelve tokens planos para pintarlos con
 * React (sin innerHTML), evitando añadir una librería de highlighting.
 */
export function tokenizeSql(code: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let cursor = 0;

  if (!code) return tokens;

  for (const match of code.matchAll(MASTER)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ kind: "plain", value: code.slice(cursor, index) });
    }
    const [full, comment, str, num, identifier, space, operator] = match;
    cursor = index + full.length;

    if (comment) tokens.push({ kind: "comment", value: comment });
    else if (str) tokens.push({ kind: "string", value: str });
    else if (num) tokens.push({ kind: "number", value: num });
    else if (identifier) {
      const upper = identifier.toUpperCase();
      if (KEYWORDS.has(upper)) tokens.push({ kind: "keyword", value: identifier });
      else if (BUILTINS.has(upper)) tokens.push({ kind: "builtin", value: identifier });
      else tokens.push({ kind: "identifier", value: identifier });
    } else if (space) tokens.push({ kind: "plain", value: space });
    else if (operator) tokens.push({ kind: "operator", value: operator });
  }

  if (cursor < code.length) {
    tokens.push({ kind: "plain", value: code.slice(cursor) });
  }

  return tokens;
}

/** Divide el código en líneas preservando el resaltado por token. */
export function tokenizeLines(code: string): SqlToken[][] {
  const lines: SqlToken[][] = [[]];
  for (const token of tokenizeSql(code)) {
    const parts = token.value.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ kind: token.kind, value: part });
    });
  }
  return lines;
}
