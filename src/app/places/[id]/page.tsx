import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LikeButton } from "@/components/LikeButton";
import { MapView } from "@/components/MapView";
import { Card, MediumBadge, PassageQuote } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { getAppearances, getPlace } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(Number(id));
  if (!place) return { title: "場所が見つかりません" };
  return {
    title: `${place.name}｜聖地の事典`,
    description:
      place.note || `${place.prefecture}${place.address}。${place.name}が登場する作品とシーンをまとめています。`,
  };
}

/** 記事本文。空行で段落、行頭の「■」を小見出しとして扱う。 */
function Article({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("■")) {
          const [head, ...rest] = trimmed.split("\n");
          return (
            <div key={i}>
              <h3 className="mb-2 border-l-2 border-shu pl-2 font-serif text-base font-bold">
                {head.replace(/^■\s*/, "")}
              </h3>
              {rest.length > 0 && (
                <p className="whitespace-pre-wrap leading-loose text-ink-2">{rest.join("\n")}</p>
              )}
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap leading-loose text-ink-2">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId)) notFound();

  const user = await currentUser();
  const place = await getPlace(placeId, user?.id);
  if (!place) notFound();

  const appearances = await getAppearances(placeId);
  const works = new Set(appearances.map((a) => a.work_slug));

  return (
    <div className="space-y-8">
      <nav className="text-xs text-ink-3">
        <Link href="/places" className="hover:text-shu">
          場所
        </Link>
        <span className="mx-1.5">／</span>
        <span>{place.name}</span>
      </nav>

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-wide">{place.name}</h1>
            <p className="mt-1 text-sm text-ink-3">
              {place.prefecture} {place.address}
              <span className="ml-3 tabular-nums">
                {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LikeButton placeId={place.id} likes={place.likes} liked={place.liked_by_me} loggedIn={!!user} />
            <Link
              href={`/places/${place.id}/edit`}
              className="rounded border border-rule-2 px-3.5 py-2 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
            >
              編集
            </Link>
            <Link
              href={`/places/${place.id}/history`}
              className="rounded px-2 py-2 text-sm text-ink-3 hover:text-shu"
              title="この項目の編集履歴"
            >
              履歴
            </Link>
          </div>
        </div>

        {place.note && <p className="max-w-3xl font-serif text-lg leading-loose">{place.note}</p>}

        <div className="flex flex-wrap gap-x-5 gap-y-1 border-y border-rule py-2.5 text-xs text-ink-3">
          <span>
            登場する作品 <b className="font-bold text-ink-2">{works.size}</b>
          </span>
          <span>
            登録されたシーン <b className="font-bold text-ink-2">{appearances.length}</b>
          </span>
          <span>
            編集 <b className="font-bold text-ink-2">{place.revision_count}</b>回・
            <b className="font-bold text-ink-2">{place.contributor_count}</b>人
          </span>
          {place.updated_at && (
            <span className="ml-auto">
              最終更新 {place.updated_at.slice(0, 10)}
              {place.editor_handle && (
                <>
                  ・
                  <Link href={`/users/${place.editor_handle}`} className="hover:text-shu">
                    {place.editor_name}
                  </Link>
                </>
              )}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-8">
          {place.photo_path && (
            <figure>
              {/* 利用者が投稿した画像。サイズが不定なので next/image は使わない */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={place.photo_path}
                alt={place.name}
                className="w-full rounded-lg border border-rule object-cover"
                style={{ maxHeight: 380 }}
              />
            </figure>
          )}

          {/* 記事本文 */}
          <section>
            <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">解説</h2>
            {place.body ? (
              <Article body={place.body} />
            ) : (
              <div className="rounded-md border border-dashed border-rule-2 px-4 py-6 text-center text-sm text-ink-3">
                <p>この場所の解説はまだ書かれていません。</p>
                <Link href={`/places/${place.id}/edit`} className="mt-2 inline-block font-bold text-shu hover:underline">
                  最初の一段落を書く →
                </Link>
              </div>
            )}
          </section>

          {place.access && (
            <section>
              <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
                行き方・訪問時の注意
              </h2>
              <p className="whitespace-pre-wrap leading-loose text-ink-2">{place.access}</p>
            </section>
          )}

          {/* 登場するシーン */}
          <section>
            <div className="mb-3 flex items-center justify-between border-b border-rule pb-2">
              <h2 className="font-serif text-lg font-bold tracking-wide">
                ここが登場する作品・シーン
                <span className="ml-2 text-xs font-normal text-ink-3">{appearances.length}件</span>
              </h2>
              <Link
                href={`/scenes/new?place=${place.id}`}
                className="rounded bg-shu px-3 py-1.5 text-xs font-bold text-paper hover:opacity-90"
              >
                ＋ シーンを追加
              </Link>
            </div>

            {appearances.length === 0 ? (
              <div className="rounded-md border border-dashed border-rule-2 px-4 py-6 text-center text-sm text-ink-3">
                <p>この場所は、まだどのシーンとも結びついていません。</p>
                <Link
                  href={`/scenes/new?place=${place.id}`}
                  className="mt-2 inline-block font-bold text-shu hover:underline"
                >
                  最初のシーンを登録する →
                </Link>
              </div>
            ) : (
              <ol className="space-y-4">
                {appearances.map((a) => (
                  <li key={a.passage_id}>
                    <Card className="overflow-hidden">
                      {a.image_path && (
                        <figure>
                          <a href={a.image_path} target="_blank" rel="noopener noreferrer" title="画像を開く">
                            {/* 利用者が投稿した画像。サイズが不定なので next/image は使わない */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.image_path}
                              alt={a.image_caption || `${a.work_title}のシーン`}
                              loading="lazy"
                              className="h-56 w-full object-cover"
                            />
                          </a>
                          {(a.image_caption || a.image_credit) && (
                            <figcaption className="border-b border-rule bg-paper-2/50 px-4 py-1.5 text-[11px] text-ink-3">
                              {a.image_caption}
                              {a.image_credit && <span className="ml-2">（{a.image_credit}）</span>}
                            </figcaption>
                          )}
                        </figure>
                      )}
                      <div className="p-5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                          <MediumBadge medium={a.medium} />
                          <Link href={`/works/${a.work_slug}`} className="font-bold text-ink-2 hover:text-shu">
                            『{a.work_title}』
                          </Link>
                          <span>{a.work_author}</span>
                          {a.chapter && <span>／{a.chapter}</span>}
                          {a.disputed && (
                            <Link
                              href={`/passages/${a.passage_id}`}
                              className="rounded-full bg-[#e6efe7] px-2 py-0.5 text-[10px] font-bold text-[#4a6f51] hover:underline"
                            >
                              異説あり・確度 {Math.round(a.confidence * 100)}%
                            </Link>
                          )}
                          <Link
                            href={`/passages/${a.passage_id}/edit`}
                            className="ml-auto shrink-0 hover:text-shu"
                            title="このシーンの記述を直す"
                          >
                            編集
                          </Link>
                        </div>
                        <Link href={`/passages/${a.passage_id}`} className="group mt-2 block">
                          <PassageQuote kind={a.kind} quote={a.quote} className="group-hover:text-shu" />
                        </Link>
                        {a.note && <p className="mt-2 text-sm leading-relaxed text-ink-3">{a.note}</p>}
                      </div>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* 地図と外部リンク */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <Card className="overflow-hidden">
            <MapView
              pins={[
                {
                  id: place.id,
                  lat: place.lat,
                  lng: place.lng,
                  title: place.name,
                  subtitle: place.prefecture,
                  confidence: 1,
                  primary: true,
                  likes: place.likes,
                },
              ]}
              height={300}
              center={[place.lat, place.lng]}
              zoom={16}
              fit={false}
            />
            <div className="flex flex-wrap gap-3 border-t border-rule px-4 py-2.5 text-xs">
              <a
                href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ai hover:underline"
              >
                OpenStreetMap ↗
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ai hover:underline"
              >
                経路を調べる ↗
              </a>
            </div>
          </Card>

          <Card className="p-4 text-xs leading-relaxed text-ink-3">
            <p className="font-bold text-ink-2">この項目は誰でも編集できます</p>
            <p className="mt-1.5">
              名前・座標・解説・行き方は、気づいた人が直せます。編集はすべて履歴に残り、
              おかしな変更はいつでも差し戻せます。
            </p>
            <Link href={`/places/${place.id}/edit`} className="mt-2 inline-block font-bold text-shu hover:underline">
              この項目を編集する →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
