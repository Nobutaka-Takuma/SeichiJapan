import Link from "next/link";
import { RevertButton } from "./RevertButton";
import { Card, Empty } from "./ui";
import { collapseUnchanged, diffLines } from "@/lib/diff";

export type HistoryRow = {
  id: number;
  editorHandle: string | null;
  editorName: string;
  createdAt: string;
  summary: string;
  /** 差分をとるために、その版の内容を一枚のテキストへ畳んだもの */
  text: string;
};

function Diff({ before, after }: { before: string | null; after: string }) {
  const rows = collapseUnchanged(diffLines(before ?? "", after));
  const changed = rows.some((r) => r.type === "add" || r.type === "del");

  if (!changed) {
    return <p className="border-t border-rule px-4 py-3 text-xs text-ink-3">文章に変更はありません（画像の差し替えなど）。</p>;
  }

  return (
    <div className="overflow-x-auto border-t border-rule bg-paper-2/30 font-mono text-xs leading-relaxed">
      {rows.map((row, i) => {
        if (row.type === "gap") {
          return (
            <div key={i} className="px-4 py-1 text-center text-[10px] text-ink-3">
              … {row.count}行省略 …
            </div>
          );
        }
        const style =
          row.type === "add"
            ? "bg-[#e6efe7] text-[#33543b]"
            : row.type === "del"
              ? "bg-shu-soft text-[#8f3520] line-through decoration-1"
              : "text-ink-3";
        const mark = row.type === "add" ? "＋" : row.type === "del" ? "－" : "　";
        return (
          <div key={i} className={`whitespace-pre-wrap px-4 py-0.5 ${style}`}>
            <span className="select-none opacity-60">{mark} </span>
            {row.text || " "}
          </div>
        );
      })}
    </div>
  );
}

/** 場所とシーンで共通の編集履歴。新しい順に版を並べ、直前の版との差分を出す。 */
export function RevisionHistory({
  kind,
  rows,
  backHref,
}: {
  kind: "place" | "passage";
  rows: HistoryRow[];
  backHref: string;
}) {
  if (rows.length === 0) return <Empty>まだ編集の記録がありません。</Empty>;

  return (
    <ol className="space-y-4">
      {rows.map((rev, i) => (
        <li key={rev.id}>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
              <span className="font-mono text-xs text-ink-3">#{rev.id}</span>
              {i === 0 && (
                <span className="rounded bg-shu px-1.5 py-0.5 text-[10px] font-bold text-paper">現在の版</span>
              )}
              <span className="text-sm font-bold">
                {rev.editorHandle ? (
                  <Link href={`/users/${rev.editorHandle}`} className="hover:text-shu">
                    {rev.editorName}
                  </Link>
                ) : (
                  rev.editorName
                )}
              </span>
              <span className="text-xs text-ink-3">{rev.createdAt.replace("T", " ").slice(0, 16)}</span>
              <span className="ml-auto">
                {i > 0 && <RevertButton kind={kind} revisionId={rev.id} backHref={backHref} />}
              </span>
            </div>
            {rev.summary && (
              <p className="px-4 pb-3 text-sm text-ink-2">
                <span className="text-ink-3">要約：</span>
                {rev.summary}
              </p>
            )}
            <Diff before={rows[i + 1]?.text ?? null} after={rev.text} />
          </Card>
        </li>
      ))}
    </ol>
  );
}
