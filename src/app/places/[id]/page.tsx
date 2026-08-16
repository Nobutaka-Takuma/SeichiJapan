import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LikeButton } from "@/components/LikeButton";
import { MapView } from "@/components/MapView";
import { VisitButton } from "@/components/VisitButton";
import { WikiText } from "@/components/WikiText";
import { Card, MediumBadge, PassageQuote } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import {
  backlinks,
  getVisitState,
  relatedPlaces,
  resolveWikiLinks,
  routesForPlace,
} from "@/lib/pilgrimage";
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

/**
 * 記事本文。
 * 空行で段落、行頭の「■」を小見出し、[[名前]] を他の項目へのリンクとして扱う。
 */
function Article({ body, links, self }: { body: string; links: Map<string, number>; self: number }) {
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
                <p className="whitespace-pre-wrap leading-loose text-ink-2">
                  <WikiText text={rest.join("\n")} links={links} self={self} />
                </p>
              )}
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap leading-loose text-ink-2">
            <WikiText text={trimmed} links={links} self={self} />
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

  const [appearances, visit, related, links, incoming, routes] = await Promise.all([
    getAppearances(placeId),
    getVisitState(placeId, user?.id),
    relatedPlaces(placeId),
    resolveWikiLinks(place.body),
    backlinks(place.name, placeId),
    routesForPlace(placeId),
  ]);
  const works = new Set(appearances.map((a) => a.work_slug));

  // 住所から市区町村を切り出して、地域の索引へ渡せるようにする
  const muni = place.address.replace(/^.+?郡/, "").match(/^(.+?[市区町村])/)?.[1];
  const areaKey = muni ? `${place.prefecture}${muni}` : null;

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
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-wide sm:text-3xl">{place.name}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {areaKey ? (
              <Link href={`/areas/${encodeURIComponent(areaKey)}`} className="hover:text-shu">
                {place.prefecture} {place.address}
              </Link>
            ) : (
              <>
                {place.prefecture} {place.address}
              </>
            )}
          </p>
        </div>

        {/* 巡礼の操作。スマホでは横並びのまま押しやすい大きさにする */}
        <div className="flex flex-wrap items-center gap-2">
          <VisitButton placeId={place.id} visited={visit.visited} total={visit.total} loggedIn={!!user} />
          <LikeButton placeId={place.id} likes={place.likes} liked={place.liked_by_me} loggedIn={!!user} />
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center rounded-full border border-rule-2 px-4 text-sm font-bold text-ink-2 hover:border-ai hover:text-ai"
          >
            経路を調べる ↗
          </a>
          <span className="ml-auto flex items-center gap-3 text-sm">
            <Link href={`/places/${place.id}/edit`} className="font-bold text-ink-2 hover:text-shu">
              編集
            </Link>
            <Link href={`/places/${place.id}/history`} className="text-ink-3 hover:text-shu">
              履歴
            </Link>
          </span>
        </div>

        {place.note && <p className="max-w-3xl font-serif text-base leading-loose sm:text-lg">{place.note}</p>}

        <div className="flex flex-wrap gap-x-5 gap-y-1 border-y border-rule py-2.5 text-xs text-ink-3">
          <span>
            作品 <b className="font-bold text-ink-2">{works.size}</b>
          </span>
          <span>
            シーン <b className="font-bold text-ink-2">{appearances.length}</b>
          </span>
          <span>
            編集 <b className="font-bold text-ink-2">{place.revision_count}</b>回
          </span>
          {place.updated_at && (
            <span className="sm:ml-auto">
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

          <section>
            <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">解説</h2>
            {place.body ? (
              <Article body={place.body} links={links} self={place.id} />
            ) : (
              <div className="rounded-md border border-dashed border-rule-2 px-4 py-6 text-center text-sm text-ink-3">
                <p>この場所の解説はまだ書かれていません。</p>
                <Link href={`/places/${place.id}/edit`} className="mt-2 inline-block font-bold text-shu">
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

          <section>
            <div className="mb-3 flex items-center justify-between border-b border-rule pb-2">
              <h2 className="font-serif text-lg font-bold tracking-wide">
                ここが登場する作品・シーン
                <span className="ml-2 text-xs font-normal text-ink-3">{appearances.length}件</span>
              </h2>
              <Link
                href={`/scenes/new?place=${place.id}`}
                aria-label="この場所にシーンを追加"
                className="shrink-0 rounded bg-shu px-3 py-2 text-xs font-bold text-paper"
              >
                ＋ シーン<span className="hidden sm:inline">を追加</span>
              </Link>
            </div>

            {appearances.length === 0 ? (
              <div className="rounded-md border border-dashed border-rule-2 px-4 py-6 text-center text-sm text-ink-3">
                <p>この場所は、まだどのシーンとも結びついていません。</p>
                <Link href={`/scenes/new?place=${place.id}`} className="mt-2 inline-block font-bold text-shu">
                  最初のシーンを登録する →
                </Link>
              </div>
            ) : (
              <ol className="space-y-4">
                {appearances.map((a) => (
                  <li key={a.passage_id}>
                    <Card className="overflow-hidden">
                      {a.image_path && (
                        <a href={a.image_path} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.image_path}
                            alt={a.image_caption || `${a.work_title}のシーン`}
                            loading="lazy"
                            className="h-48 w-full object-cover sm:h-56"
                          />
                        </a>
                      )}
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                          <MediumBadge medium={a.medium} />
                          <Link href={`/works/${a.work_slug}`} className="font-bold text-ink-2 hover:text-shu">
                            『{a.work_title}』
                          </Link>
                          {a.chapter && <span>／{a.chapter}</span>}
                          {a.disputed && (
                            <Link
                              href={`/passages/${a.passage_id}`}
                              className="rounded-full bg-[#e6efe7] px-2 py-0.5 text-[10px] font-bold text-[#4a6f51]"
                            >
                              異説あり {Math.round(a.confidence * 100)}%
                            </Link>
                          )}
                          <Link href={`/passages/${a.passage_id}/edit`} className="ml-auto hover:text-shu">
                            編集
                          </Link>
                        </div>
                        <Link href={`/passages/${a.passage_id}`} className="group mt-2 block">
                          <PassageQuote kind={a.kind} quote={a.quote} className="group-hover:text-shu" />
                        </Link>
                      </div>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* 回遊のための出口 */}
          {related.length > 0 && (
            <section>
              <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
                ここから辿れる項目
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/places/${r.id}`}
                    className="flex items-center gap-3 rounded-lg border border-rule bg-card p-3 active:bg-paper-2"
                  >
                    {r.photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo_path} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-paper-2 font-serif text-ink-3">
                        {r.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{r.name}</span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {r.reason}・{r.prefecture}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {incoming.length > 0 && (
            <section>
              <h2 className="mb-2 border-b border-rule pb-2 font-serif text-base font-bold tracking-wide">
                この項目に言及している項目
              </h2>
              <p className="flex flex-wrap gap-2">
                {incoming.map((b) => (
                  <Link
                    key={b.id}
                    href={`/places/${b.id}`}
                    className="rounded-full border border-rule-2 px-3 py-1.5 text-xs text-ink-2 hover:border-shu hover:text-shu"
                  >
                    {b.name}
                  </Link>
                ))}
              </p>
            </section>
          )}
        </div>

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
              height={260}
              center={[place.lat, place.lng]}
              zoom={16}
              fit={false}
            />
            <div className="flex flex-wrap gap-3 border-t border-rule px-4 py-2.5 text-xs">
              <Link href={`/near?lat=${place.lat}&lng=${place.lng}`} className="font-bold text-shu">
                この周辺の聖地を見る →
              </Link>
            </div>
          </Card>

          {routes.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-bold">この場所を含むコース</h3>
              <ul className="mt-2 space-y-1.5">
                {routes.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/routes/${encodeURIComponent(r.slug)}`} className="text-sm text-ai hover:text-shu">
                      {r.title}
                      <span className="ml-1 text-[11px] text-ink-3">（{r.stop_count}か所）</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4 text-xs leading-relaxed text-ink-3">
            <p className="font-bold text-ink-2">この項目は誰でも編集できます</p>
            <p className="mt-1.5">
              本文に <code className="rounded bg-paper-2 px-1">[[別の場所の名前]]</code> と書くと、
              その項目へのリンクになります。
            </p>
            <Link href={`/places/${place.id}/edit`} className="mt-2 inline-block font-bold text-shu">
              この項目を編集する →
            </Link>
          </Card>

          <Link
            href="/random"
            prefetch={false}
            className="flex min-h-[44px] items-center justify-center rounded-lg border border-dashed border-rule-2 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
          >
            ✦ おまかせでどこかへ
          </Link>
        </div>
      </div>
    </div>
  );
}
