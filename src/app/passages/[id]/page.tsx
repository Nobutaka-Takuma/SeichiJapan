import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddCandidateForm } from "@/components/AddCandidateForm";
import { CommentForm } from "@/components/CommentForm";
import { DeleteButton } from "@/components/DeleteButton";
import { MapView, type MapPin } from "@/components/MapView";
import { PassageLinkList } from "@/components/PassageLinkList";
import { PhotoGallery } from "@/components/PhotoGallery";
import { QuotedImage } from "@/components/QuotedImage";
import { VoteButtons } from "@/components/VoteButtons";
import { WikiText } from "@/components/WikiText";
import { Card, ConfidenceBar, ConsensusBadge, Empty, PassageQuote } from "@/components/ui";
import { deleteCommentAction, deleteIdentificationAction, deletePassageAction } from "@/app/actions";
import { contributorId, currentUser } from "@/lib/auth";
import { photosForPassage } from "@/lib/photos";
import { CONSENSUS_LABEL } from "@/lib/confidence";
import { citationLine } from "@/lib/quote";
import { resolveWikiLinks } from "@/lib/pilgrimage";
import { EVIDENCE_LABEL, getComments, getPassage } from "@/lib/queries";
import {
  moreFromWork,
  passageNeighbors,
  passagesAtSamePlaces,
  passagesNearby,
  type Neighbor,
} from "@/lib/wander";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const passage = await getPassage(Number(id));
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

/** 同じ作品を順に読み進めるための、前後の送り。 */
function StepLink({ to, dir }: { to?: Neighbor; dir: "prev" | "next" }) {
  const label = dir === "prev" ? "前の記述" : "次の記述";
  if (!to) {
    return (
      <span className="flex-1 rounded-lg border border-dashed border-rule px-3 py-2.5 text-xs text-ink-3">
        {dir === "prev" ? "これが最初の記述です" : "これが最後の記述です"}
      </span>
    );
  }
  return (
    <Link
      href={`/passages/${to.id}`}
      rel={dir === "prev" ? "prev" : "next"}
      className={`min-w-0 flex-1 rounded-lg border border-rule bg-card px-3 py-2.5 transition hover:border-shu/40 active:bg-paper-2 ${
        dir === "next" ? "text-right" : ""
      }`}
    >
      <span className="block text-[11px] text-ink-3">
        {dir === "prev" ? "← " : ""}
        {label}
        {to.chapter && `・${to.chapter}`}
        {dir === "next" ? " →" : ""}
      </span>
      <span className="mt-0.5 line-clamp-1 text-sm text-ink">
        {to.kind === "text" ? `「${to.quote}」` : to.quote}
      </span>
    </Link>
  );
}

/** この範囲までは「この近く」と呼んでよい、とする距離。 */
const NEAR_M = 5_000;

/**
 * まず近場（5km）で探し、そこに何も無ければ範囲を広げる。
 * 一軒だけぽつんとある聖地でも行き止まりにしないための保険で、
 * 広げたときは見出しと各カードの距離でそれと分かるようにしてある。
 */
async function nearbyWithFallback(lat: number, lng: number, exceptPlaceIds: number[]) {
  const near = await passagesNearby(lat, lng, exceptPlaceIds, { radiusM: NEAR_M });
  if (near.length > 0) return near;
  return passagesNearby(lat, lng, exceptPlaceIds, { radiusM: 30_000 });
}

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passageId = Number(id);
  if (!Number.isInteger(passageId)) notFound();

  const user = await currentUser();
  const passage = await getPassage(passageId, user?.id);
  if (!passage) notFound();

  const placeIds = passage.candidates.map((c) => c.place_id);
  const top = passage.candidates[0];

  const [comments, neighbors, sameplaces, nearby, siblings, noteLinks, photos, viewerId] = await Promise.all([
    getComments(passageId),
    passageNeighbors(passage.id, passage.work.id),
    passagesAtSamePlaces(passage.id, placeIds),
    top ? nearbyWithFallback(top.lat, top.lng, placeIds) : Promise.resolve([]),
    moreFromWork(passage.work.id, [passage.id]),
    resolveWikiLinks(passage.note ?? ""),
    photosForPassage(passageId),
    contributorId(),
  ]);

  // 同じものを二度出さない。前後の送りと近隣に出したものは、以降から外す。
  const shown = new Set<number>([passage.id]);
  if (neighbors.prev) shown.add(neighbors.prev.id);
  if (neighbors.next) shown.add(neighbors.next.id);

  const atSamePlace = sameplaces.filter((s) => !shown.has(s.passage_id));
  for (const s of atSamePlace) shown.add(s.passage_id);

  const around = nearby.filter((s) => !shown.has(s.passage_id));
  for (const s of around) shown.add(s.passage_id);

  const moreOfWork = siblings.filter((s) => !shown.has(s.passage_id)).slice(0, 4);

  const aroundIsNear = around.every((a) => a.distance_m <= NEAR_M);

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
          {passage.candidates.length > 1 && <span>{passage.votes}票</span>}
          <span className="ml-auto flex items-center gap-3">
            <Link href={`/passages/${passage.id}/edit`} className="font-bold hover:text-shu">
              編集
            </Link>
            <Link href={`/passages/${passage.id}/history`} className="hover:text-shu">
              履歴{passage.revision_count > 0 && `（${passage.revision_count}）`}
            </Link>
          </span>
        </div>

        <div className="mt-3 text-xl sm:text-2xl">
          <PassageQuote kind={passage.kind} quote={passage.quote} />
        </div>
        {passage.kind === "text" && (passage.citation_detail || passage.citation_source) && (
          <p className="mt-2 text-xs text-ink-3">
            出典：
            {citationLine({
              workTitle: passage.work.title,
              author: passage.work.author,
              detail: passage.citation_detail || passage.chapter,
              source: passage.citation_source,
            })}
          </p>
        )}
        {/* 引用はここに1点だけ。現地写真は下の「この場面の写真」に何枚でも並ぶ */}
        {passage.image_path && passage.image_kind === "work_quote" && (
          <QuotedImage
            className="mt-5"
            src={passage.image_path}
            kind={passage.image_kind}
            caption={passage.image_caption}
            credit={passage.image_credit}
            workTitle={passage.work.title}
            author={passage.work.author}
            detail={passage.citation_detail || passage.chapter}
            source={passage.citation_source}
          />
        )}
        {passage.note && (
          <p className="mt-4 max-w-3xl rounded-md bg-paper-2/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
            <WikiText text={passage.note} links={noteLinks} />
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
          {passage.updated_at && passage.editor_name && (
            <>
              　最終更新：{passage.updated_at.slice(0, 10)}・
              {passage.editor_handle ? (
                <Link href={`/users/${passage.editor_handle}`} className="hover:text-shu">
                  {passage.editor_name}
                </Link>
              ) : (
                passage.editor_name
              )}
            </>
          )}
        </p>

        {user?.is_admin && (
          <div className="mt-4 max-w-xl">
            <DeleteButton
              action={deletePassageAction}
              id={passage.id}
              what="この記述と、そこに付いた説・票・コメント"
              label="この記述を削除"
            />
          </div>
        )}
      </header>

      {/* 作品のなかを順に読み進める */}
      {neighbors.total > 1 && (
        <nav aria-label="同じ作品の前後の記述" className="space-y-2">
          <p className="text-xs text-ink-3">
            <Link href={`/works/${passage.work.slug}`} className="font-bold text-ink-2 hover:text-shu">
              『{passage.work.title}』
            </Link>
            の {neighbors.position} / {neighbors.total} 件目
          </p>
          <div className="flex gap-2">
            <StepLink to={neighbors.prev} dir="prev" />
            <StepLink to={neighbors.next} dir="next" />
          </div>
        </nav>
      )}

      {/*
        この場面を実際に訪ねた人の写真。作品の絵と現地の景色が並ぶと、
        「同じ場所だ」がいちばんよく伝わる。何枚でも足せる。
      */}
      <PhotoGallery
        photos={photos}
        passageId={passage.id}
        viewerId={viewerId}
        isAdmin={!!user?.is_admin}
        title="この場面の現地写真"
        invite={top ? `${top.place_name}で撮った写真があれば、ぜひ。` : "現地で撮った写真があれば、ぜひ。"}
      />

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* 候補ランキング */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2 className="font-serif text-lg font-bold tracking-wide">
              {passage.candidates.length > 1 ? "比定の候補" : "この場所"}
              {passage.candidates.length > 1 && (
                <span className="ml-2 text-xs font-normal text-ink-3">{passage.candidates.length}件</span>
              )}
            </h2>
            <span className="text-xs text-ink-3">{CONSENSUS_LABEL[passage.consensus]}</span>
          </div>

          {passage.candidates.length === 0 ? (
            <Empty>この記述に結びついた場所がまだありません。</Empty>
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

                    {passage.candidates.length > 1 ? (
                      <div className="mt-3">
                        <ConfidenceBar share={c.confidence} />
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-ink-3">
                        異説は出ていません。この場所で定説として扱われています。
                      </p>
                    )}

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

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/places/${c.place_id}`}
                        className="text-xs font-bold text-shu hover:underline"
                      >
                        {c.place_name}の項目を読む →
                      </Link>
                      {user?.is_admin && (
                        <DeleteButton
                          action={deleteIdentificationAction}
                          id={c.id}
                          what={`「${c.place_name}」説と、それに投じられた票`}
                          label="この説を削除"
                        />
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          <AddCandidateForm passageId={passage.id} />
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
                      {user?.is_admin && (
                        <div className="mt-2">
                          <DeleteButton
                            action={deleteCommentAction}
                            id={c.id}
                            what="このコメント"
                          />
                        </div>
                      )}
                    </Card>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-4">
              <CommentForm
                passageId={passage.id}
                candidates={passage.candidates.map((c) => ({ id: c.id, place_name: c.place_name }))}
              />
            </div>
          </section>
        </div>
      </div>

      {/* ここから先へ */}
      {(atSamePlace.length > 0 || around.length > 0 || moreOfWork.length > 0) && (
        <div className="space-y-8 border-t border-rule pt-8">
          {atSamePlace.length > 0 && (
            <section className="space-y-3">
              <h2 className="border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
                同じ場所で描かれた、ほかの記述
                <span className="ml-2 text-xs font-normal text-ink-3">{atSamePlace.length}件</span>
              </h2>
              <p className="text-xs text-ink-3">
                ひとつの場所に、別々の物語が積み上がっています。
              </p>
              <PassageLinkList items={atSamePlace} />
            </section>
          )}

          {around.length > 0 && (
            <section className="space-y-3">
              <h2 className="border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
                {aroundIsNear ? "この近くで描かれた場所" : "同じあたりで描かれた場所"}
              </h2>
              <p className="text-xs text-ink-3">
                {top?.place_name}
                {aroundIsNear
                  ? "から歩いて行ける範囲で、ほかに描かれている場所です。"
                  : "の近くには他になかったので、少し範囲を広げています。"}
              </p>
              <PassageLinkList items={around} />
            </section>
          )}

          {moreOfWork.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-rule pb-2">
                <h2 className="font-serif text-lg font-bold tracking-wide">
                  『{passage.work.title}』のほかの記述
                </h2>
                <Link href={`/works/${passage.work.slug}`} className="text-xs font-bold text-shu hover:underline">
                  すべて見る →
                </Link>
              </div>
              <PassageLinkList items={moreOfWork} />
            </section>
          )}
        </div>
      )}

      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-6 text-sm">
        <Link href={`/works/${passage.work.slug}`} className="font-bold text-shu hover:underline">
          『{passage.work.title}』の一覧へ
        </Link>
        {top && (
          <Link href={`/places/${top.place_id}`} className="text-ink-2 hover:text-shu">
            {top.place_name}の項目
          </Link>
        )}
        <Link href="/works" className="text-ink-2 hover:text-shu">
          作品を探す
        </Link>
        <Link href="/random?kind=passage" prefetch={false} className="ml-auto text-ink-3 hover:text-shu">
          記述をおまかせで →
        </Link>
      </nav>
    </div>
  );
}
