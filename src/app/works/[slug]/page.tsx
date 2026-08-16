import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapView, type MapPin } from "@/components/MapView";
import { Card, ConfidenceBar, ConsensusBadge, Empty, MediumBadge, PassageQuote, Stat } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { decodeParam } from "@/lib/params";
import { getPins, getWork, getWorkPassages } from "@/lib/queries";
import { relatedWorks, workAreas } from "@/lib/wander";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeParam((await params).slug);
  const work = await getWork(slug);
  if (!work) return { title: "作品が見つかりません" };
  return {
    title: `${work.title}（${work.author}）の舞台地図`,
    description: `${work.title}に登場する場所 ${work.place_count}件を地図で。${work.description}`,
  };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeParam((await params).slug);
  const work = await getWork(slug);
  if (!work) notFound();

  const user = await currentUser();
  const [passages, pins, areas, related] = await Promise.all([
    getWorkPassages(work.id, user?.id),
    getPins({ workId: work.id }),
    workAreas(work.id),
    relatedWorks(work.id),
  ]);

  const mapPins: MapPin[] = pins.map((p) => ({
    id: p.identification_id,
    lat: p.lat,
    lng: p.lng,
    title: p.place_name,
    subtitle: p.disputed ? (p.rank === 0 ? "最有力の説" : "対立する説") : work.title,
    quote: p.quote.length > 60 ? `${p.quote.slice(0, 60)}…` : p.quote,
    confidence: p.confidence,
    primary: p.rank === 0,
    disputed: p.disputed,
    likes: p.likes,
    image: p.image_path || undefined,
    href: `/places/${p.place_id}`,
  }));

  const settled = passages.filter((p) => p.consensus === "settled").length;
  const contested = passages.filter((p) => p.consensus === "contested" || p.consensus === "open").length;

  return (
    <div className="space-y-8">
      <nav className="text-xs text-ink-3">
        <Link href="/works" className="hover:text-shu">
          作品
        </Link>
        <span className="mx-1.5">／</span>
        <span>{work.title}</span>
      </nav>

      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-2">
            <MediumBadge medium={work.medium} />
            {work.year && <span className="text-xs text-ink-3">{work.year}年</span>}
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-wide">『{work.title}』</h1>
          <p className="mt-1 text-ink-2">{work.author}</p>
          <p className="mt-4 max-w-2xl leading-loose text-ink-2">{work.description}</p>
        </div>
        <dl className="flex gap-7 border-t border-rule pt-4 lg:border-none lg:pt-0">
          <Stat label="登場する場所" value={work.place_count} unit="件" />
          <Stat label="登録されたシーン" value={work.passage_count} unit="件" />
          <Stat label="参加ユーザー" value={work.contributor_count} unit="人" />
        </dl>
      </header>

      <Card className="overflow-hidden">
        {mapPins.length === 0 ? (
          <div className="p-10">
            <Empty>まだ地図に落とせる場所がありません。最初のシーンを登録してみてください。</Empty>
          </div>
        ) : (
          <MapView pins={mapPins} height={520} />
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-4 py-2.5 text-[11px] text-ink-3">
          <span>ピンをクリックすると、その場所の項目へ移動します</span>
          <span className="ml-auto">
            定説 {settled}件{contested > 0 && `・異説あり／検証待ち ${contested}件`}
          </span>
        </div>
      </Card>

      {areas.length > 0 && (
        <section className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-3">舞台になっている地域</span>
          {areas.map((a) => (
            <Link
              key={a.key}
              href={`/areas/${encodeURIComponent(a.key)}`}
              className="rounded-full border border-rule-2 px-3 py-1.5 text-xs text-ink-2 hover:border-shu hover:text-shu"
            >
              {a.municipality}
              <span className="ml-1 text-ink-3">{a.place_count}</span>
            </Link>
          ))}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between border-b border-rule pb-2">
          <h2 className="font-serif text-lg font-bold tracking-wide">この作品のシーンと、その場所</h2>
          <Link
            href={`/scenes/new?work=${encodeURIComponent(work.slug)}`}
            className="rounded bg-shu px-3 py-1.5 text-xs font-bold text-paper hover:opacity-90"
          >
            ＋ シーンを追加
          </Link>
        </div>

        {passages.length === 0 ? (
          <div className="rounded-md border border-dashed border-rule-2 px-4 py-6 text-center text-sm text-ink-3">
            <p>まだシーンが登録されていません。</p>
            <Link
              href={`/scenes/new?work=${encodeURIComponent(work.slug)}`}
              className="mt-2 inline-block font-bold text-shu hover:underline"
            >
              最初のシーンを登録する →
            </Link>
          </div>
        ) : (
          <ol className="space-y-3">
            {passages.map((p, i) => (
              <li key={p.id}>
                <Card className="p-5 transition hover:shadow-[0_4px_16px_rgba(36,33,29,0.07)]">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <span className="font-serif text-sm text-shu">{String(i + 1).padStart(2, "0")}</span>
                    {p.chapter && <span>{p.chapter}</span>}
                    <span className="rounded border border-rule px-1.5 py-px">
                      {p.kind === "text" ? "本文引用" : "場面の記述"}
                    </span>
                    <ConsensusBadge level={p.consensus} />
                    <Link href={`/passages/${p.id}/edit`} className="ml-auto hover:text-shu">
                      編集
                    </Link>
                  </div>

                  <div className="mt-3 flex gap-4">
                    {p.image_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_path}
                        alt={p.image_caption || ""}
                        className="hidden h-24 w-36 shrink-0 rounded object-cover sm:block"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/passages/${p.id}`} className="group block">
                        <PassageQuote kind={p.kind} quote={p.quote} className="group-hover:text-shu" />
                      </Link>
                      {p.note && <p className="mt-2 text-sm leading-relaxed text-ink-3">{p.note}</p>}
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {p.candidates.map((c) => (
                      <li key={c.id} className="flex items-center gap-3">
                        <Link
                          href={`/places/${c.place_id}`}
                          className="w-40 shrink-0 truncate text-sm font-medium text-ink hover:text-shu sm:w-52"
                        >
                          {c.place_name}
                        </Link>
                        {p.candidates.length > 1 ? (
                          <>
                            <ConfidenceBar share={c.confidence} />
                            <span className="hidden w-16 shrink-0 text-right text-xs text-ink-3 sm:inline">
                              {c.up > 0 && `↑${c.up}`}
                              {c.down > 0 && ` ↓${c.down}`}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-ink-3">
                            {c.prefecture} — この場所の項目を見る
                          </span>
                        )}
                      </li>
                    ))}
                    {p.candidates.length === 0 && (
                      <li className="text-sm text-ink-3">まだ場所が結びついていません。</li>
                    )}
                  </ul>

                  <Link href={`/passages/${p.id}`} className="mt-4 inline-block text-xs font-bold text-shu hover:underline">
                    このシーンの詳細 →
                  </Link>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
            この作品から辿れる作品
          </h2>
          <p className="mb-3 text-xs text-ink-3">
            同じ場所を舞台にしている作品です。ひとつの町が、作品によって違う顔で描かれています。
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((w) => (
              <li key={w.slug}>
                <Link
                  href={`/works/${encodeURIComponent(w.slug)}`}
                  className="flex h-full flex-col gap-1 rounded-lg border border-rule bg-card p-3 transition hover:border-shu/40 active:bg-paper-2"
                >
                  <span className="flex flex-wrap items-baseline gap-2">
                    <MediumBadge medium={w.medium} />
                    <span className="font-serif font-bold">『{w.title}』</span>
                    <span className="text-xs text-ink-3">{w.author}</span>
                    <span className="ml-auto shrink-0 rounded bg-paper-2 px-1.5 py-px text-[11px] text-ink-3">
                      {w.reason}
                    </span>
                  </span>
                  {w.shared_places && (
                    <span className="line-clamp-1 text-xs text-ink-3">重なる場所：{w.shared_places}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex flex-wrap gap-3 border-t border-rule pt-6 text-sm">
        <Link href="/works" className="font-bold text-shu hover:underline">
          作品の一覧へ
        </Link>
        <Link href="/areas" className="text-ink-2 hover:text-shu">
          地域から探す
        </Link>
        <Link href="/routes" className="text-ink-2 hover:text-shu">
          巡礼コース
        </Link>
        <Link href="/random" prefetch={false} className="ml-auto text-ink-3 hover:text-shu">
          おまかせ表示 →
        </Link>
      </nav>
    </div>
  );
}
