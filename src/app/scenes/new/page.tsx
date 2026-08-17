import Link from "next/link";
import type { Metadata } from "next";
import { SceneForm } from "@/components/SceneForm";
import { SigningAs } from "@/components/SigningAs";
import { Card } from "@/components/ui";
import { getPlace, getWork } from "@/lib/queries";
import { decodeParam } from "@/lib/params";

export const metadata: Metadata = { title: "シーンを追加する" };

export default async function NewScenePage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string; work?: string }>;
}) {
  const { place: placeParam, work: workParam } = await searchParams;

  const place = placeParam ? await getPlace(Number(placeParam)) : undefined;
  const work = workParam ? await getWork(decodeParam(workParam)) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-xs text-ink-3">
        {place ? (
          <>
            <Link href="/places" className="hover:text-shu">
              場所
            </Link>
            <span className="mx-1.5">／</span>
            <Link href={`/places/${place.id}`} className="hover:text-shu">
              {place.name}
            </Link>
          </>
        ) : work ? (
          <>
            <Link href="/works" className="hover:text-shu">
              作品
            </Link>
            <span className="mx-1.5">／</span>
            <Link href={`/works/${work.slug}`} className="hover:text-shu">
              {work.title}
            </Link>
          </>
        ) : (
          <Link href="/map" className="hover:text-shu">
            地図
          </Link>
        )}
        <span className="mx-1.5">／</span>
        <span>シーンの追加</span>
      </nav>

      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">
          {place ? `${place.name} にシーンを追加する` : work ? `『${work.title}』のシーンを追加する` : "シーンを追加する"}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          {place
            ? "同じ作品の別のシーンでも、まったく違う作品のシーンでも登録できます。ひとつの場所に何作品でも重ねられます。"
            : "「ここは○○のあのシーン」を登録します。アニメなら場面の画像、小説なら本文の描写を添えてください。"}
        </p>
      </div>

      <Card className="p-6">
        <SceneForm
          fixedPlace={place ? { id: place.id, name: place.name, prefecture: place.prefecture } : null}
          fixedWork={
            work
              ? { id: work.id, title: work.title, author: work.author, medium: work.medium, place_count: 0 }
              : null
          }
        />
      </Card>

      <SigningAs
        next={`/scenes/new${place ? `?place=${place.id}` : work ? `?work=${encodeURIComponent(work.slug)}` : ""}`}
      />

      {place && (
        <p className="text-center text-xs text-ink-3">
          場所そのものの説明を直したいときは{" "}
          <Link href={`/places/${place.id}/edit`} className="font-bold text-shu hover:underline">
            項目の編集
          </Link>{" "}
          から。
        </p>
      )}
    </div>
  );
}
