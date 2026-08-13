import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddCandidateForm } from "@/components/AddCandidateForm";
import { CommentForm } from "@/components/CommentForm";
import { MapView, type MapPin } from "@/components/MapView";
import { VoteButtons } from "@/components/VoteButtons";
import { Card, ConfidenceBar, ConsensusBadge, Empty, PassageQuote } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { CONSENSUS_LABEL } from "@/lib/confidence";
import { EVIDENCE_LABEL, getComments, getPassage } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const passage = getPassage(Number(id));
  if (!passage) return { title: "記述が見つかりません" };
  const top = passage.candidates[0];
  return {
    title: `${passage.quote.slice(0, 28)}… — 『${passage.work.title}』`,
    description: top
      ? `この記述の最有力の説は「${top.place_name}」（確度${Math.round(top.confidence * 100)}%）。根拠と議論を見る。`
      : "この記述の比定候補を募集しています。",
  };
}

const EVIDENCE_STYLE: Record<string, string> = {
  official: "border-shu/40 text-shu",
  research: "border-ai/40 text-ai",
  guess: "border-rule-2 text-ink-3",
};

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passageId = Number(id);
  if (!Number.isInteger(passageId)) notFound();

  const user = await currentUser();
  const passage = getPassage(passageId, user?.id);
  if (!passage) notFound();

  const comments = getComments(passageId);
  const mapPins: MapPin[] = passage.candidates.map((c, i) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    title: c.place_name,
    subtitle: i === 0 ? "最有力の説" : `第${i + 1}の説`,
    confidence: c.confidence,
    primary: i === 0,
    href: `/places/${c.place_id}`,
  }));

  return (
    <div className="space-y-8">
      <nav className="text-xs text-ink-3">
        <Link href="/works" className="hover:text-shu">
          作品
        </Link>
        <span className="mx-1.5">／</span>
        <Link href={`/works/${passage.work.slug}`} className="hover:text-shu">
          {passage.work.title}
        </Link>
        <span className="mx-1.5">／</span>
        <span>記述</span>
      </nav>

      {/* 記述 */}
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
          {passage.chapter && <span>{passage.chapter}</span>}
          <span className="rounded border border-rule px-1.5 py-px">
            {passage.kind === "text" ? "本文引用" : "場面の記述"}
          </span>
          <ConsensusBadge level={passage.consensus} />
          <span>{passage.votes}票</span>
        </div>
        <div className="mt-3 text-xl sm:text-2xl">
          <PassageQuote kind={passage.kind} quote={passage.quote} />
        </div>
        {passage.note && (
          <p className="mt-4 max-w-3xl rounded-md bg-paper-2/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
            {passage.note}
          </p>
        )}
        <p className="mt-3 text-xs text-ink-3">
          登録：
          {passage.author_handle ? (
            <Link href={`/users/${passage.author_handle}`} className="hover:text-shu">
              {passage.author_name}
            </Link>
          ) : (
            passage.author_name
          )}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* 候補ランキング */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2 className="font-serif text-lg font-bold tracking-wide">
              比定の候補
              <span className="ml-2 text-xs font-normal text-ink-3">{passage.candidates.length}件</span>
            </h2>
            <span className="text-xs text-ink-3">{CONSENSUS_LABEL[passage.consensus]}</span>
          </div>

          {passage.candidates.length === 0 ? (
            <Empty>まだ候補がありません。最初の説を出してみてください。</Empty>
          ) : (
            <ol className="space-y-3">
              {passage.candidates.map((c, i) => (
                <li key={c.id}>
                  <Card className={`p-5 ${i === 0 ? "border-shu/30" : ""}`}>
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {i === 0 && (
                            <span className="rounded bg-shu px-1.5 py-0.5 text-[10px] font-bold text-paper">
                              最有力
                            </span>
                          )}
                          <Link
                            href={`/places/${c.place_id}`}
                            className="font-serif text-lg font-bold hover:text-shu"
                          >
                            {c.place_name}
                          </Link>
                          <span
                            className={`rounded border px-1.5 py-px text-[10px] font-bold ${
                              EVIDENCE_STYLE[c.evidence] ?? EVIDENCE_STYLE.guess
                            }`}
                          >
                            {EVIDENCE_LABEL[c.evidence] ?? c.evidence}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-3">{c.prefecture}</p>
                      </div>
                      <VoteButtons
                        identificationId={c.id}
                        up={c.up}
                        down={c.down}
                        myVote={c.my_vote}
                        loggedIn={!!user}
                      />
                    </div>

                    <div className="mt-3">
                      <ConfidenceBar share={c.confidence} />
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{c.rationale}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span>
                        提案：
                        <Link href={`/users/${c.proposer_handle}`} className="hover:text-shu">
                          {c.proposer}
                        </Link>
                      </span>
                      <span>{c.created_at.slice(0, 10)}</span>
                      {c.source_url && (
                        <a
                          href={c.source_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-ai hover:underline"
                        >
                          出典を見る ↗
                        </a>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          <AddCandidateForm passageId={passage.id} loggedIn={!!user} />
        </section>

        {/* 地図と議論 */}
        <div className="space-y-8">
          <Card className="overflow-hidden">
            {mapPins.length === 0 ? (
              <div className="p-8">
                <Empty>候補が登録されると、ここに地図が出ます。</Empty>
              </div>
            ) : (
              <MapView pins={mapPins} height={300} />
            )}
            <p className="border-t border-rule px-4 py-2.5 text-[11px] text-ink-3">
              対立する説がある場合、その距離がそのまま解釈の隔たりになります。
            </p>
          </Card>

          <section>
            <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
              議論
              <span className="ml-2 text-xs font-normal text-ink-3">{comments.length}件</span>
            </h2>

            {comments.length === 0 ? (
              <Empty>まだコメントはありません。</Empty>
            ) : (
              <ol className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Link href={`/users/${c.handle}`} className="font-bold text-ink-2 hover:text-shu">
                          {c.display_name}
                        </Link>
                        <span className="text-ink-3">{c.created_at.slice(0, 10)}</span>
                        {c.place_name && (
                          <span className="rounded bg-paper-2 px-1.5 py-0.5 text-[10px] text-ink-3">
                            {c.place_name}説について
                          </span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{c.body}</p>
                    </Card>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-4">
              <CommentForm
                passageId={passage.id}
                candidates={passage.candidates.map((c) => ({ id: c.id, place_name: c.place_name }))}
                loggedIn={!!user}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
