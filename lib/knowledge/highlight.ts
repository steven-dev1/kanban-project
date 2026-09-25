export type TokenKind =
  | "plain"
  | "keyword"
  | "function"
  | "string"
  | "number"
  | "comment"
  | "operator";

export interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set(
  (
    "select from where and or not null is in exists between like order by group having " +
    "join left right inner outer full on as distinct union all intersect minus insert into " +
    "values update set delete create replace table view index sequence procedure function " +
    "package body trigger begin end declare if then else elsif loop for while return exit " +
    "cursor open fetch close exception when others raise commit rollback savepoint pragma " +
    "type subtype record constant out nocopy default case merge using matched partition over " +
    "rowid rownum sysdate systimestamp dual with asc desc primary foreign key references " +
    "constraint check unique grant revoke analyze describe explain truncate drop alter add " +
    "modify rename column number varchar2 varchar nvarchar2 char nchar clob blob date " +
    "timestamp interval boolean integer int decimal float raw long rowtype of"
  ).split(" "),
);

const WORD_RE = /[A-Za-z_][A-Za-z0-9_$#]*/;

interface ScanState {
  inBlockComment: boolean;
}

function tokenizeLine(line: string, state: ScanState): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buffer = "";

  const flush = () => {
    if (buffer) {
      tokens.push({ text: buffer, kind: "plain" });
      buffer = "";
    }
  };

  while (i < line.length) {
    // Continue a block comment started on a previous line.
    if (state.inBlockComment) {
      const end = line.indexOf("*/", i);
      if (end === -1) {
        tokens.push({ text: line.slice(i), kind: "comment" });
        return tokens;
      }
      tokens.push({ text: line.slice(i, end + 2), kind: "comment" });
      state.inBlockComment = false;
      i = end + 2;
      continue;
    }

    const rest = line.slice(i);

    if (rest.startsWith("--")) {
      flush();
      tokens.push({ text: rest, kind: "comment" });
      return tokens;
    }
    if (rest.startsWith("/*")) {
      flush();
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        tokens.push({ text: rest, kind: "comment" });
        state.inBlockComment = true;
        return tokens;
      }
      tokens.push({ text: line.slice(i, end + 2), kind: "comment" });
      i = end + 2;
      continue;
    }
    if (rest.startsWith("'")) {
      flush();
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "'") {
          if (line[j + 1] === "'") {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      tokens.push({ text: line.slice(i, j), kind: "string" });
      i = j;
      continue;
    }
    if (/[0-9]/.test(rest[0])) {
      const match = rest.match(/^[0-9]+(\.[0-9]+)?/);
      if (match) {
        flush();
        tokens.push({ text: match[0], kind: "number" });
        i += match[0].length;
        continue;
      }
    }
    const wordMatch = rest.match(WORD_RE);
    if (wordMatch && wordMatch.index === 0) {
      flush();
      const word = wordMatch[0];
      const upper = word.toUpperCase();
      const after = line.slice(i + word.length).replace(/^\s+/, "");
      if (KEYWORDS.has(upper)) {
        tokens.push({ text: word, kind: "keyword" });
      } else if (after.startsWith("(")) {
        tokens.push({ text: word, kind: "function" });
      } else {
        tokens.push({ text: word, kind: "plain" });
      }
      i += word.length;
      continue;
    }
    if (/[(),;.=<>!|+\-*/%:]/.test(rest[0])) {
      flush();
      const opMatch = rest.match(/^(<>|!=|<=|>=|:=|\|\||[(),;.=<>!|+\-*/%:])/);
      const op = opMatch ? opMatch[0] : rest[0];
      tokens.push({ text: op, kind: "operator" });
      i += op.length;
      continue;
    }
    buffer += line[i];
    i++;
  }

  flush();
  return tokens;
}

export function tokenizeLines(code: string): Token[][] {
  const state: ScanState = { inBlockComment: false };
  return (code ?? "").replace(/\r\n?/g, "\n").split("\n").map((line) => tokenizeLine(line, state));
}

export const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: "text-slate-200",
  keyword: "text-violet-300 font-medium",
  function: "text-sky-300",
  string: "text-emerald-300",
  number: "text-amber-300",
  comment: "text-slate-500 italic",
  operator: "text-slate-400",
};
