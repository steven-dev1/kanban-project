export type DiffKind = "equal" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  oldNo?: number;
  newNo?: number;
}

export interface DiffSummary {
  added: number;
  removed: number;
  equal: number;
}

/** Líneas máximas comparadas con LCS exacto (más allá se usa fallback). */
const MAX_CELLS = 2_000_000;

function split(text: string): string[] {
  return (text ?? "").replace(/\r\n/g, "\n").split("\n");
}

/**
 * Diff de líneas basado en LCS con recorte de prefijo/sufijo común.
 * Suficiente para comparar versiones de código PL/SQL.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = split(oldText);
  const b = split(newText);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const result: DiffLine[] = [];
  for (let i = 0; i < start; i++) {
    result.push({ kind: "equal", text: a[i], oldNo: i + 1, newNo: i + 1 });
  }

  const coreA = a.slice(start, endA);
  const coreB = b.slice(start, endB);

  if (coreA.length * coreB.length > MAX_CELLS) {
    coreA.forEach((text, i) =>
      result.push({ kind: "removed", text, oldNo: start + i + 1 }),
    );
    coreB.forEach((text, i) =>
      result.push({ kind: "added", text, newNo: start + i + 1 }),
    );
  } else {
    const n = coreA.length;
    const m = coreB.length;
    const lcs = new Uint32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * (m + 1) + j] =
          coreA[i] === coreB[j]
            ? lcs[(i + 1) * (m + 1) + j + 1] + 1
            : Math.max(lcs[(i + 1) * (m + 1) + j], lcs[i * (m + 1) + j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (coreA[i] === coreB[j]) {
        result.push({
          kind: "equal",
          text: coreA[i],
          oldNo: start + i + 1,
          newNo: start + j + 1,
        });
        i++;
        j++;
      } else if (lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + j + 1]) {
        result.push({ kind: "removed", text: coreA[i], oldNo: start + i + 1 });
        i++;
      } else {
        result.push({ kind: "added", text: coreB[j], newNo: start + j + 1 });
        j++;
      }
    }
    while (i < n) {
      result.push({ kind: "removed", text: coreA[i], oldNo: start + i + 1 });
      i++;
    }
    while (j < m) {
      result.push({ kind: "added", text: coreB[j], newNo: start + j + 1 });
      j++;
    }
  }

  for (let k = 0; k < a.length - endA; k++) {
    const text = a[endA + k];
    result.push({
      kind: "equal",
      text,
      oldNo: endA + k + 1,
      newNo: endB + k + 1,
    });
  }

  return result;
}

export function summarizeDiff(lines: DiffLine[]): DiffSummary {
  return lines.reduce<DiffSummary>(
    (acc, line) => {
      if (line.kind === "added") acc.added++;
      else if (line.kind === "removed") acc.removed++;
      else acc.equal++;
      return acc;
    },
    { added: 0, removed: 0, equal: 0 },
  );
}
