import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PlaceEditForm } from "@/components/PlaceEditForm";
import { SigningAs } from "@/components/SigningAs";
import { Card } from "@/components/ui";
import { getPlace } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(Number(id));
  return { title: place ? `${place.name}を編集` : "編集" };
}

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId)) notFound();

  const place = await getPlace(placeId);
  if (!place) notFound();

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
        <span>編集</span>
      </nav>

      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">{place.name} を編集する</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          この項目は誰でも編集できます。編集はすべて履歴に残ります。
          間違いを直すのはもちろん、写真や行き方を足すだけでも十分な貢献です。
        </p>
      </div>

      <Card className="p-6">
        <PlaceEditForm place={place} />
      </Card>

      <SigningAs next={`/places/${place.id}/edit`} />

      <p className="text-center text-xs text-ink-3">
        <Link href={`/places/${place.id}/history`} className="hover:text-shu">
          これまでの編集履歴を見る →
        </Link>
      </p>
    </div>
  );
}
