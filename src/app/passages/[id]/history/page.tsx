import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RevisionHistory, type HistoryRow } from "@/components/RevisionHistory";
import { getPassage, getPassageRevisions, type PassageRevision } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const passage = getPassage(Number(id));
  return { title: passage ? `シーンの編集履歴｜${passage.work.title}` : "編集履歴" };
}

function flatten(r: PassageRevision): string {
  return [
    `種類: ${r.kind === "text" ? "本文引用" : "場面の記述"}`,
    `章・話数: ${r.chapter}`,
    "",
    r.quote,
    "",
    r.note ? `[補足]\n${r.note}` : "",
    r.image_caption || r.image_credit ? `[画像] ${r.image_caption} ${r.image_credit}`.trim() : "",
  ]
    .join("\n")
    .trimEnd();
}

export default async function PassageHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passageId = Number(id);
  if (!Number.isInteger(passageId)) notFound();

  const passage = getPassage(passageId);
  if (!passage) notFound();

  const rows: HistoryRow[] = getPassageRevisions(passageId).map((r) => ({
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
        <Link href={`/works/${passage.work.slug}`} className="hover:text-shu">
          {passage.work.title}
        </Link>
        <span className="mx-1.5">／</span>
        <Link href={`/passages/${passage.id}`} className="hover:text-shu">
          シーン
        </Link>
        <span className="mx-1.5">／</span>
        <span>編集履歴</span>
      </nav>

      <div className="border-b border-rule pb-4">
        <h1 className="font-serif text-2xl font-bold tracking-wide">シーンの編集履歴</h1>
        <p className="mt-1 line-clamp-2 text-sm text-ink-3">{passage.quote}</p>
        <p className="mt-1 text-sm text-ink-3">{rows.length}版。新しい順。</p>
      </div>

      <RevisionHistory kind="passage" rows={rows} backHref={`/passages/${passage.id}`} />
    </div>
  );
}
