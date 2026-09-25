export type DiffType = "same" | "added" | "removed";

export interface DiffLine {
  type: DiffType;
  text: string;
  oldNumber: number | null;
  newNumber: number | null;
}

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

const MAX_LINES = 4000;

function split(text: string) {
  return (text ?? "").replace(/\r\n?/g, "\n").split("\n");
}

/**
 * Line based diff using a longest-common-subsequence table.
 * No external dependency; falls back to a naive diff for very large inputs.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = split(oldText);
  const b = split(newText);

  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return naiveDiff(a, b);
  }

  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i], oldNumber: i + 1, newNumber: j + 1 });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: "removed", text: a[i], oldNumber: i + 1, newNumber: null });
      i++;
    } else {
      result.push({ type: "added", text: b[j], oldNumber: null, newNumber: j + 1 });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: "removed", text: a[i], oldNumber: i + 1, newNumber: null });
    i++;
  }
  while (j < m) {
    result.push({ type: "added", text: b[j], oldNumber: null, newNumber: j + 1 });
    j++;
  }
  return result;
}

function naiveDiff(a: string[], b: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) {
      result.push({ type: "same", text: a[i] ?? "", oldNumber: i + 1, newNumber: i + 1 });
    } else {
      if (a[i] !== undefined) {
        result.push({ type: "removed", text: a[i], oldNumber: i + 1, newNumber: null });
      }
      if (b[i] !== undefined) {
        result.push({ type: "added", text: b[i], oldNumber: null, newNumber: i + 1 });
      }
    }
  }
  return result;
}

/**
 * Counts changes. A removed block immediately followed by an added block is
 * reported as "modified" (pairs), the remainder as pure adds/removes.
 */
export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.type === "same") {
      unchanged++;
      continue;
    }
    if (line.type === "removed" && lines[i + 1]?.type === "added") {
      modified++;
      i++; // skip the paired added line
      continue;
    }
    if (line.type === "added") added++;
    else removed++;
  }

  return { added, removed, modified, unchanged };
}
