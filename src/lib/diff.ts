/** 版どうしを比べるための、行単位の差分。 */

export type DiffRow = { type: "same" | "add" | "del"; text: string };

/** 最長共通部分列。行数はたかが知れているので素直な動的計画法で足りる。 */
export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: "del", text: a[i++] });
    } else {
      rows.push({ type: "add", text: b[j++] });
    }
  }
  while (i < n) rows.push({ type: "del", text: a[i++] });
  while (j < m) rows.push({ type: "add", text: b[j++] });
  return rows;
}

/** 変更のない行が続く箇所を畳んで、変更点の周辺だけを残す。 */
export function collapseUnchanged(rows: DiffRow[], context = 2): (DiffRow | { type: "gap"; count: number })[] {
  const keep = new Set<number>();
  rows.forEach((r, i) => {
    if (r.type === "same") return;
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep.add(k);
  });

  const out: (DiffRow | { type: "gap"; count: number })[] = [];
  let gap = 0;
  rows.forEach((r, i) => {
    if (keep.has(i)) {
      if (gap > 0) {
        out.push({ type: "gap", count: gap });
        gap = 0;
      }
      out.push(r);
    } else {
      gap++;
    }
  });
  if (gap > 0) out.push({ type: "gap", count: gap });
  return out;
}
