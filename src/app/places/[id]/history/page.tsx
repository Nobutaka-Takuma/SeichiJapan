import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RevisionHistory, type HistoryRow } from "@/components/RevisionHistory";
import { getPlace, getRevisions, type Revision } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(Number(id));
  return { title: place ? `${place.name}の編集履歴` : "編集履歴" };
}

/** 版どうしで見比べる内容をひとつの文字列にまとめる。 */
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

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId)) notFound();

  const place = await getPlace(placeId);
  if (!place) notFound();

  const rows: HistoryRow[] = (await getRevisions(placeId)).map((r) => ({
    id: r.id,
    editorHandle: r.editor_handle,
    editorName: r.editor_name,
    createdAt: r.created_at,
    summary: r.summary,
    text: flatten(r),
  }));

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
          {rows.length}版・{place.contributor_count}人が編集しています。新しい順。
        </p>
      </div>

      <RevisionHistory kind="place" rows={rows} backHref={`/places/${place.id}`} />
    </div>
  );
}
