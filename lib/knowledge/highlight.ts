export type TokenKind =
  | "plain"
  | "keyword"
  | "type"
  | "constant"
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
    // DML / DDL / SQL
    "select from where and or not null is in exists between like escape order by group having " +
    "join left right inner outer full cross natural on using as distinct union all intersect minus " +
    "insert into values update set delete create replace alter drop truncate table view materialized " +
    "index sequence synonym trigger procedure function package body type subtype record cursor " +
    "begin end declare if then else elsif loop for while return exit continue goto raise exception " +
    "when others pragma autonomous_transaction commit rollback savepoint lock share exclusive nowait " +
    "merge matched source target delete cascade constraint primary foreign key references check unique " +
    "default not_null enable disable grant revoke analyze describe explain with asc desc partition over " +
    "connect start prior level recursive pivot unpivot model fetch first next rows only offset percent " +
    "bulk collect limit returning into forall while exists any some all case else end as of nowait " +
    "authid current_user definer invoker deterministic parallel_enable pipelined result_cache " +
    "in out nocopy authid is as return declare exception when others then loop end if end loop end case " +
    "open close fetch exit when as session alter system tablespace storage tablespace immediate " +
    "before after instead each row statement referencing new old for order compound noinline " +
    "increment by start with minvalue maxvalue cache cycle nocycle order nominvalue nomaxvalue " +
    "comment on column add modify rename constraint privileges role user identified by grant "
  )
    .split(/\s+/)
    .filter(Boolean),
);

const TYPES = new Set(
  (
    "number numeric decimal dec integer int pls_integer binary_integer natural positive " +
    "varchar2 varchar nvarchar2 char nchar character long raw rowid urowid " +
    "date timestamp interval time zone boolean bool " +
    "clob nclob blob bfile bfile xmltype anydata anyschema anytype object varray nested " +
    "ref cursor sys_refcursor ref_cursor record rowtype type " +
    "float real double precision binary_float binary_double " +
    "smallint mediumint bigint tinyint serial uuid json jsonb bytea text " +
    "string varchar2_t"
  )
    .split(/\s+/)
    .filter(Boolean),
);

const CONSTANTS = new Set([
  "true",
  "false",
  "null",
  "sysdate",
  "systimestamp",
  "current_date",
  "current_timestamp",
  "user",
  "uid",
  "rowid",
  "rownum",
  "level",
  "dual",
]);

export const KNOWN_FUNCTIONS = new Set(
  (
    "count sum avg min max stddev variance median " +
    "nvl nvl2 coalesce decode case ifnull nullif " +
    "to_char to_date to_number to_timestamp to_clob to_blob " +
    "substr substrb length lengthb instr instrb lpad rpad trim ltrim rtrim replace translate " +
    "upper lower initcap concat " +
    "round trunc ceil floor mod power sqrt exp ln log abs sign " +
    "add_months months_between next_day last_day extract " +
    "row_number rank dense_rank ntile percent_rank cume_dist lead lag first_value last_value nth_value " +
    "listagg wm_concat xmlagg " +
    "sys_context sys_guid raise_application_error dbms_output put_line " +
    "regexp_like regexp_substr regexp_replace regexp_instr regexp_count " +
    "greatest least cast treat convert " +
    "json_value json_query json_object json_array json_table json_exists " +
    "dbms_lob dbms_sql dbms_random dbms_utility utl_file dbms_scheduler dbms_lock " +
    "coalesce nullif greatest least " +
    "coalesce"
  )
    .split(/\s+/)
    .filter(Boolean),
);

const WORD_RE = /[A-Za-z_][A-Za-z0-9_$#]*/;

interface ScanState {
  inBlockComment: boolean;
}

function classify(word: string, nextNonSpace: string): TokenKind {
  const upper = word.toUpperCase();
  if (CONSTANTS.has(upper.toLowerCase()) || CONSTANTS.has(upper)) return "constant";
  if (TYPES.has(upper.toLowerCase())) return "type";
  if (KEYWORDS.has(upper.toLowerCase())) return "keyword";
  if (KNOWN_FUNCTIONS.has(upper.toLowerCase()) || nextNonSpace.startsWith("(")) return "function";
  return "plain";
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
      const after = line.slice(i + word.length).replace(/^\s+/, "");
      tokens.push({ text: word, kind: classify(word, after) });
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
  plain: "text-slate-800 dark:text-slate-200",
  keyword: "text-violet-700 dark:text-violet-300 font-medium",
  type: "text-teal-700 dark:text-teal-300",
  constant: "text-orange-700 dark:text-orange-300",
  function: "text-sky-700 dark:text-sky-300",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  comment: "text-slate-400 italic dark:text-slate-500",
  operator: "text-slate-500 dark:text-slate-400",
};
