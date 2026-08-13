import Link from "next/link";
import { LikeButton } from "@/components/LikeButton";
import { MapView, type MapPin } from "@/components/MapView";
import { Card, ConfidenceBar, Empty, MediumBadge, SectionTitle, Stat } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestedPassages, getPins, listPlaces, listWorks, recentActivity, siteStats } from "@/lib/queries";

const ACTIVITY_LABEL = { scene: "シーン", edit: "加筆", comment: "議論" } as const;

export default async function Home() {
  const user = await currentUser();
  const stats = siteStats();
  const works = listWorks().slice(0, 6);
  const pins = getPins();
  const popular = listPlaces(6, "likes");
  const contested = contestedPassages(2);
  const activity = recentActivity(10);

  const likedIds = new Set(
    user
      ? (db.prepare("SELECT place_id FROM place_likes WHERE user_id = ?").all(user.id) as { place_id: number }[]).map(
          (r) => r.place_id,
        )
      : [],
  );

  const mapPins: MapPin[] = pins
    .filter((p) => p.rank === 0)
    .map((p) => ({
      id: p.identification_id,
      lat: p.lat,
      lng: p.lng,
      title: p.place_name,
      subtitle: p.work_title,
      quote: p.quote.length > 60 ? `${p.quote.slice(0, 60)}…` : p.quote,
      confidence: p.confidence,
      primary: true,
      disputed: p.disputed,
      likes: p.likes,
      image: p.image_path || undefined,
      href: `/places/${p.place_id}`,
    }));

  return (
    <div className="space-y-14">
      {/* ヒーロー */}
      <section className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-shu">みんなで作る、小説とアニメの地図帳</p>
          <h1 className="font-serif text-3xl leading-snug tracking-wide sm:text-4xl">
            物語の場所を、
            <br />
            みんなで書き足していく。
          </h1>
          <p className="mt-5 max-w-lg leading-loose text-ink-2">
            『三四郎』の精養軒。『こころ』の鎌倉の海。沼津駅のホーム。
            どこがどのシーンの場所かは、たいていファンの間ではもう分かっています。
          </p>
          <p className="mt-4 max-w-lg leading-loose text-ink-2">
            足りないのは、それが<strong className="font-bold text-ink">一箇所にまとまっていない</strong>こと。
            だからここでは、場所ごとに<strong className="font-bold text-ink">誰でも書き足せる項目</strong>
            を作ります。地図をクリックしてシーンを登録し、写真を添え、解説を直す。
            編集はすべて履歴に残ります。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/map" className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90">
              地図に書き込む
            </Link>
            <Link
              href="/places"
              className="rounded border border-rule-2 px-5 py-2.5 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
            >
              聖地を見てまわる
            </Link>
          </div>
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-rule pt-6">
            <Stat label="場所" value={stats.places} unit="件" />
            <Stat label="シーン" value={stats.passages} unit="件" />
            <Stat label="作品" value={stats.works} unit="作" />
            <Stat label="編集" value={stats.edits} unit="回" />
            <Stat label="いいね" value={stats.likes} unit="件" />
          </dl>
        </div>

        <Card className="overflow-hidden">
          <MapView pins={mapPins} height={480} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-4 py-2.5 text-[11px] text-ink-3">
            <span className="flex items-center gap-1">
              <i className="inline-block size-2.5 rounded-full" style={{ background: "#b4472e" }} />
              定説（ピンの大きさは人気）
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block size-2.5 rounded-full border border-dashed border-ink-3" />
              異説あり
            </span>
            <Link href="/map" className="ml-auto font-bold text-shu hover:underline">
              地図から書き込む →
            </Link>
          </div>
        </Card>
      </section>

      {/* 仕組み */}
      <section>
        <SectionTitle more={{ href: "/about", label: "詳しく" }}>三つの積み上げ方</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              n: "一",
              t: "地図から、シーンを置く",
              d: "地図をクリックして「ここは○○の第3話のあの場面」と登録します。アニメならその場面の画像、小説なら本文の描写を添えて。",
            },
            {
              n: "二",
              t: "場所の項目を書き足す",
              d: "誰でも編集できます。解説、行き方、注意すべきこと。間違いを直すのも、写真を1枚足すのも同じ貢献です。",
            },
            {
              n: "三",
              t: "いいねで残す",
              d: "行ってよかった場所、よく書けている項目にいいねを。人気の場所はピンが大きくなり、一覧の上に出ます。",
            },
          ].map((s) => (
            <Card key={s.n} className="p-5">
              <span className="font-serif text-xl text-shu">{s.n}</span>
              <h3 className="mt-1 font-bold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 人気の聖地 */}
      <section>
        <SectionTitle more={{ href: "/places", label: "すべての場所" }}>いま人気の聖地</SectionTitle>
        {popular.length === 0 ? (
          <Empty>まだ場所が登録されていません。</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((p) => (
              <Card key={p.id} className="flex h-full flex-col overflow-hidden">
                <Link href={`/places/${p.id}`} className="group flex-1">
                  {p.photo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_path} alt="" className="h-32 w-full object-cover" />
                  ) : null}
                  <div className="p-4">
                    <h3 className="truncate font-bold group-hover:text-shu">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-3">{p.prefecture}</p>
                    {p.note && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">{p.note}</p>}
                  </div>
                </Link>
                <div className="flex items-center justify-between border-t border-rule px-4 py-2.5">
                  <span className="text-[11px] text-ink-3">
                    {p.work_count}作品・シーン{p.scene_count}件
                  </span>
                  <LikeButton
                    placeId={p.id}
                    likes={p.likes}
                    liked={likedIds.has(p.id)}
                    loggedIn={!!user}
                    size="sm"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 更新 */}
      <section>
        <SectionTitle>最近の書き込み</SectionTitle>
        <Card className="divide-y divide-rule">
          {activity.map((a, i) => (
            <Link key={i} href={a.href} className="flex gap-3 px-4 py-3 hover:bg-paper-2/50">
              <span className="mt-0.5 shrink-0 rounded bg-paper-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-3">
                {ACTIVITY_LABEL[a.kind]}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="text-ink-2">{a.title}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">{a.context}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-3">{a.actor}</span>
            </Link>
          ))}
        </Card>
      </section>

      {/* 作品 */}
      <section>
        <SectionTitle more={{ href: "/works", label: "すべての作品" }}>作品から探す</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w) => (
            <Link key={w.id} href={`/works/${w.slug}`} className="group">
              <Card className="h-full p-5 transition group-hover:shadow-[0_4px_16px_rgba(36,33,29,0.07)]">
                <div className="flex items-center gap-2">
                  <MediumBadge medium={w.medium} />
                  <span className="text-xs text-ink-3">{w.year}</span>
                </div>
                <h3 className="mt-2 font-serif text-xl font-bold group-hover:text-shu">{w.title}</h3>
                <p className="text-sm text-ink-3">{w.author}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-2">{w.description}</p>
                <div className="mt-4 flex gap-4 border-t border-rule pt-3 text-xs text-ink-3">
                  <span>
                    場所 <b className="font-bold text-ink-2">{w.place_count}</b>
                  </span>
                  <span>
                    シーン <b className="font-bold text-ink-2">{w.passage_count}</b>
                  </span>
                  <span>
                    参加 <b className="font-bold text-ink-2">{w.contributor_count}</b>人
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* 割れているものだけ、控えめに */}
      {contested.length > 0 && (
        <section>
          <SectionTitle>まれに、説が割れることがある</SectionTitle>
          <p className="-mt-1 mb-3 text-sm text-ink-3">
            ほとんどの場所は決まっています。決まらないものだけ、根拠を出し合って確度で並べています。
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {contested.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex items-center gap-2 text-xs text-ink-3">
                  <Link href={`/works/${p.work_slug}`} className="font-bold text-ink-2 hover:text-shu">
                    {p.work_title}
                  </Link>
                  {p.chapter && <span>{p.chapter}</span>}
                </div>
                <Link href={`/passages/${p.id}`} className="group">
                  <p className="mt-2 line-clamp-2 font-serif leading-relaxed group-hover:text-shu">
                    {p.kind === "text" ? `「${p.quote}」` : p.quote}
                  </p>
                </Link>
                <ul className="mt-4 space-y-2">
                  {p.candidates.slice(0, 3).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate text-ink-2">{c.place_name}</span>
                      <ConfidenceBar share={c.confidence} />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
