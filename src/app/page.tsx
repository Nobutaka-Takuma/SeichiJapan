import Link from "next/link";
import { MapView, type MapPin } from "@/components/MapView";
import { Card, ConfidenceBar, ConsensusBadge, Empty, MediumBadge, SectionTitle, Stat } from "@/components/ui";
import { contestedPassages, getPins, listWorks, recentActivity, siteStats } from "@/lib/queries";

export default function Home() {
  const stats = siteStats();
  const works = listWorks().slice(0, 6);
  const pins = getPins();
  const contested = contestedPassages(4);
  const activity = recentActivity(8);

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
      href: `/passages/${p.passage_id}`,
    }));

  return (
    <div className="space-y-14">
      {/* ヒーロー */}
      <section className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-shu">みんなで作る、小説とアニメの地図帳</p>
          <h1 className="font-serif text-3xl leading-snug tracking-wide sm:text-4xl">
            この一行は、
            <br />
            現実のどこだろう。
          </h1>
          <p className="mt-5 max-w-lg leading-loose text-ink-2">
            『三四郎』の精養軒。『こころ』の鎌倉の海。沼津駅のホーム。
            物語に書かれた場所は、たいてい現実のどこかを指しています。
            けれど本文にはっきり書かれていないことも多い。
          </p>
          <p className="mt-4 max-w-lg leading-loose text-ink-2">
            ここは、その<strong className="font-bold text-ink">「本文 → 場所」の対応づけ</strong>
            を持ち寄る場所です。根拠を添えて候補を出し、議論し、投票する。
            集まった票から<strong className="font-bold text-ink">確度</strong>が決まり、地図の上に物語が重なっていきます。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/works" className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90">
              作品から探す
            </Link>
            <Link
              href="/map"
              className="rounded border border-rule-2 px-5 py-2.5 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
            >
              全国の地図を見る
            </Link>
          </div>
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-rule pt-6">
            <Stat label="作品" value={stats.works} unit="作" />
            <Stat label="登録された場所" value={stats.places} unit="件" />
            <Stat label="本文の記述" value={stats.passages} unit="件" />
            <Stat label="投じられた票" value={stats.votes} unit="票" />
            <Stat label="参加者" value={stats.users} unit="人" />
          </dl>
        </div>

        <Card className="overflow-hidden">
          <MapView pins={mapPins} height={480} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-4 py-2.5 text-[11px] text-ink-3">
            <span>ピンの数字と色は確度</span>
            <span className="flex items-center gap-1">
              <i className="inline-block size-2.5 rounded-full" style={{ background: "#b4472e" }} />
              80%以上
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block size-2.5 rounded-full" style={{ background: "#c98a2e" }} />
              55%以上
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block size-2.5 rounded-full" style={{ background: "#6b8f71" }} />
              30%以上
            </span>
            <span className="ml-auto">Ctrl/⌘ + ホイールで拡大縮小</span>
          </div>
        </Card>
      </section>

      {/* 仕組み */}
      <section>
        <SectionTitle more={{ href: "/about", label: "詳しく" }}>解釈が集まると、確度になる</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              n: "一",
              t: "本文の一節を登録する",
              d: "「彼は駅を出て、坂を下り、海の見える喫茶店に入った。」——場所が特定できそうな記述を切り出します。",
            },
            {
              n: "二",
              t: "候補を、根拠つきで出す",
              d: "「作者の当時の生活圏から考えると△△駅では」。地図上の一点と、そう考えた理由をセットで投稿します。",
            },
            {
              n: "三",
              t: "議論して、投票する",
              d: "票の集まり方から各説の確度が算出されます。対立が続けば、それも含めて記録に残ります。",
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

      {/* 議論が割れている記述 */}
      <section>
        <SectionTitle>いま、説が割れている記述</SectionTitle>
        {contested.length === 0 ? (
          <Empty>まだ複数の説が並んでいる記述はありません。</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {contested.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex items-center gap-2 text-xs text-ink-3">
                  <Link href={`/works/${p.work_slug}`} className="font-bold text-ink-2 hover:text-shu">
                    {p.work_title}
                  </Link>
                  {p.chapter && <span>{p.chapter}</span>}
                  <ConsensusBadge level={p.consensus} />
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
                <Link href={`/passages/${p.id}`} className="mt-3 inline-block text-xs text-shu hover:underline">
                  議論に参加する（{p.comment_count}件のコメント）→
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 作品 */}
      <section>
        <SectionTitle more={{ href: "/works", label: "すべての作品" }}>作品から探す</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w) => (
            <Link key={w.id} href={`/works/${w.slug}`} className="group">
              <Card className="h-full p-5 transition group-hover:border-rule-2 group-hover:shadow-[0_4px_16px_rgba(36,33,29,0.07)]">
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
                    記述 <b className="font-bold text-ink-2">{w.passage_count}</b>
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

      {/* 更新 */}
      <section>
        <SectionTitle>最近の更新</SectionTitle>
        <Card className="divide-y divide-rule">
          {activity.map((a, i) => (
            <Link key={i} href={`/passages/${a.passage_id}`} className="flex gap-3 px-4 py-3 hover:bg-paper-2/50">
              <span className="mt-0.5 shrink-0 rounded bg-paper-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-3">
                {a.kind === "identification" ? "比定" : a.kind === "comment" ? "議論" : "記述"}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="text-ink-2">
                  {a.kind === "identification" && (
                    <>
                      <b className="font-bold text-ink">{a.detail}</b> を候補として登録
                    </>
                  )}
                  {a.kind === "comment" && <>{a.detail}…</>}
                  {a.kind === "passage" && <>記述を追加</>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">
                  {a.work_title}｜{a.quote}
                </span>
              </span>
              <span className="shrink-0 text-xs text-ink-3">{a.actor}</span>
            </Link>
          ))}
        </Card>
      </section>
    </div>
  );
}
