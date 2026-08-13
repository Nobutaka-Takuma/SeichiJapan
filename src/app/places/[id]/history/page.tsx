import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RevertButton } from "@/components/RevertButton";
import { Card, Empty } from "@/components/ui";
import { collapseUnchanged, diffLines } from "@/lib/diff";
import { getPlace, getRevisions, type Revision } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = getPlace(Number(id));
  return { title: place ? `${place.name}の編集履歴` : "編集履歴" };
}

/** 版どうしで見比べる本文をひとつの文字列にまとめる。 */
function flatten(r: Revision): string {
  return [
    `名前: ${r.name}`,
    `都道府県: ${r.prefecture}`,
    `住所: ${r.address}`,
    `座標: ${r.lat}, ${r.lng}`,
    `リード文: ${r.note}`,
    "",
    r.body,
    "",
    r.access ? `[行き方]\n${r.access}` : "",
  ]
    .join("\n")
    .trimEnd();
}

function Diff({ before, after }: { before: Revision | null; after: Revision }) {
  const rows = collapseUnchanged(diffLines(before ? flatten(before) : "", flatten(after)));
  const changed = rows.some((r) => r.type === "add" || r.type === "del");

  if (!changed) {
    return <p className="px-4 py-3 text-xs text-ink-3">本文に変更はありません（写真の差し替えなど）。</p>;
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

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId)) notFound();

  const place = getPlace(placeId);
  if (!place) notFound();
  const revisions = getRevisions(placeId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-xs text-ink-3">
        <Link href="/places" className="hover:text-shu">
          場所
        </Link>
        <span className="mx-1.5">／</span>
        <Link href={`/places/${place.id}`} className="hover:text-shu">
          {place.name}
        </Link>
        <span className="mx-1.5">／</span>
        <span>編集履歴</span>
      </nav>

      <div className="border-b border-rule pb-4">
        <h1 className="font-serif text-2xl font-bold tracking-wide">{place.name} の編集履歴</h1>
        <p className="mt-1 text-sm text-ink-3">
          {revisions.length}版・{place.contributor_count}人が編集しています。新しい順。
        </p>
      </div>

      {revisions.length === 0 ? (
        <Empty>まだ編集の記録がありません。</Empty>
      ) : (
        <ol className="space-y-4">
          {revisions.map((rev, i) => {
            const previous = revisions[i + 1] ?? null;
            return (
              <li key={rev.id}>
                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                    <span className="font-mono text-xs text-ink-3">#{rev.id}</span>
                    {i === 0 && (
                      <span className="rounded bg-shu px-1.5 py-0.5 text-[10px] font-bold text-paper">現在の版</span>
                    )}
                    <span className="text-sm font-bold">
                      {rev.editor_handle ? (
                        <Link href={`/users/${rev.editor_handle}`} className="hover:text-shu">
                          {rev.editor_name}
                        </Link>
                      ) : (
                        rev.editor_name
                      )}
                    </span>
                    <span className="text-xs text-ink-3">{rev.created_at.replace("T", " ").slice(0, 16)}</span>
                    <span className="ml-auto">
                      {i > 0 && <RevertButton revisionId={rev.id} placeId={place.id} />}
                    </span>
                  </div>
                  {rev.summary && (
                    <p className="px-4 pb-3 text-sm text-ink-2">
                      <span className="text-ink-3">要約：</span>
                      {rev.summary}
                    </p>
                  )}
                  <Diff before={previous} after={rev} />
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
