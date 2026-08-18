import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PassageEditForm } from "@/components/PassageEditForm";
import { SigningAs } from "@/components/SigningAs";
import { Card } from "@/components/ui";
import { getPassage } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const passage = await getPassage(Number(id));
  return { title: passage ? `シーンを編集｜${passage.work.title}` : "編集" };
}

export default async function EditPassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passageId = Number(id);
  if (!Number.isInteger(passageId)) notFound();

  const passage = await getPassage(passageId);
  if (!passage) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-xs text-ink-3">
        <Link href={`/works/${passage.work.slug}`} className="hover:text-shu">
          {passage.work.title}
        </Link>
        <span className="mx-1.5">／</span>
        <Link href={`/passages/${passage.id}`} className="hover:text-shu">
          シーン
        </Link>
        <span className="mx-1.5">／</span>
        <span>編集</span>
      </nav>

      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">シーンを編集する</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          場面の記述・話数・画像は誰でも直せます。編集はすべて履歴に残り、いつでも差し戻せます。
        </p>
      </div>

      <Card className="p-6">
        <PassageEditForm
          passage={{
            id: passage.id,
            kind: passage.kind,
            quote: passage.quote,
            chapter: passage.chapter,
            note: passage.note,
            image_path: passage.image_path,
            image_caption: passage.image_caption,
            image_credit: passage.image_credit,
            image_kind: passage.image_kind,
            citation_detail: passage.citation_detail,
            citation_source: passage.citation_source,
          }}
        />
      </Card>

      <SigningAs next={`/passages/${passage.id}/edit`} />

      <p className="text-center text-xs text-ink-3">
        <Link href={`/passages/${passage.id}/history`} className="hover:text-shu">
          これまでの編集履歴を見る →
        </Link>
      </p>
    </div>
  );
}
