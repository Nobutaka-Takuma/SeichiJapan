import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapView, type MapPin } from "@/components/MapView";
import { Card, ConfidenceBar, ConsensusBadge, Empty, MediumBadge, PassageQuote, Stat } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { decodeParam } from "@/lib/params";
import { getPins, getWork, getWorkPassages } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeParam((await params).slug);
  const work = getWork(slug);
  if (!work) return { title: "作品が見つかりません" };
  return {
    title: `${work.title}（${work.author}）の舞台地図`,
    description: `${work.title}に登場する場所 ${work.place_count}件を地図で。${work.description}`,
  };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeParam((await params).slug);
  const work = getWork(slug);
  if (!work) notFound();

  const user = await currentUser();
  const passages = getWorkPassages(work.id, user?.id);
  const pins = getPins({ workId: work.id });

  const mapPins: MapPin[] = pins.map((p) => ({
    id: p.identification_id,
    lat: p.lat,
    lng: p.lng,
    title: p.place_name,
    subtitle: p.rank === 0 ? "最有力の説" : "対立する説",
    quote: p.quote.length > 60 ? `${p.quote.slice(0, 60)}…` : p.quote,
    confidence: p.confidence,
    primary: p.rank === 0,
    href: `/passages/${p.passage_id}`,
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
          <Stat label="登録された記述" value={work.passage_count} unit="件" />
          <Stat label="参加ユーザー" value={work.contributor_count} unit="人" />
        </dl>
      </header>

      <Card className="overflow-hidden">
        {mapPins.length === 0 ? (
          <div className="p-10">
            <Empty>まだ地図に落とせる場所がありません。最初の記述を登録してみてください。</Empty>
          </div>
        ) : (
          <MapView pins={mapPins} height={520} />
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-4 py-2.5 text-[11px] text-ink-3">
          <span>
            大きいピン＝各記述の最有力の説／小さい点線のピン＝対立する説
          </span>
          <span className="ml-auto">
            ほぼ確定 {settled}件・検証待ち／議論中 {contested}件
          </span>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between border-b border-rule pb-2">
          <h2 className="font-serif text-lg font-bold tracking-wide">この作品の記述と、その比定</h2>
          <Link
            href={`/works/${work.slug}/passages/new`}
            className="rounded bg-shu px-3 py-1.5 text-xs font-bold text-paper hover:opacity-90"
          >
            記述を追加
          </Link>
        </div>

        {passages.length === 0 ? (
          <Empty>まだ記述が登録されていません。</Empty>
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
                    <span className="ml-auto">{p.votes}票・{p.comment_count}コメント</span>
                  </div>

                  <Link href={`/passages/${p.id}`} className="group mt-3 block">
                    <PassageQuote kind={p.kind} quote={p.quote} className="group-hover:text-shu" />
                  </Link>
                  {p.note && <p className="mt-2 text-sm leading-relaxed text-ink-3">{p.note}</p>}

                  <ul className="mt-4 space-y-2.5">
                    {p.candidates.map((c) => (
                      <li key={c.id} className="flex items-center gap-3">
                        <Link
                          href={`/places/${c.place_id}`}
                          className="w-40 shrink-0 truncate text-sm font-medium text-ink hover:text-shu sm:w-52"
                        >
                          {c.place_name}
                        </Link>
                        <ConfidenceBar share={c.confidence} />
                        <span className="hidden w-16 shrink-0 text-right text-xs text-ink-3 sm:inline">
                          {c.up > 0 && `↑${c.up}`}
                          {c.down > 0 && ` ↓${c.down}`}
                        </span>
                      </li>
                    ))}
                    {p.candidates.length === 0 && (
                      <li className="text-sm text-ink-3">まだ候補が出ていません。</li>
                    )}
                  </ul>

                  <Link href={`/passages/${p.id}`} className="mt-4 inline-block text-xs font-bold text-shu hover:underline">
                    候補を出す・議論する →
                  </Link>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
