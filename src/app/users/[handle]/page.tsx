import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, Stat } from "@/components/ui";
import { getUserByHandle, getUserContributions } from "@/lib/queries";
import { getVisitLog } from "@/lib/pilgrimage";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const user = await getUserByHandle(handle);
  return { title: user ? `${user.display_name}の貢献` : "ユーザーが見つかりません" };
}

export default async function UserPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = await getUserByHandle(handle);
  if (!user) notFound();

  const { idents, comments, edits, votes, likes } = await getUserContributions(user.id);
  const visits = await getVisitLog(user.id);

  return (
    <div className="space-y-8">
      <header className="border-b border-rule pb-5">
        <h1 className="font-serif text-2xl font-bold tracking-wide">
          {user.display_name}
          {user.is_anon && (
            <span className="ml-2 align-middle rounded border border-rule-2 px-1.5 py-0.5 text-[11px] font-normal text-ink-3">
              名乗らずに書いている人
            </span>
          )}
        </h1>
        <p className="text-sm text-ink-3">@{user.handle}・{user.created_at.slice(0, 10)}から参加</p>
        {user.is_anon && (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-3">
            ログインせずに書かれた分です。この名前はブラウザごとに決まるもので、
            個人を特定するものではありません。書いた本人がアカウントを作れば、
            ここの記録はそのまま引き継がれます。
          </p>
        )}
        {user.bio && <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{user.bio}</p>}
        <dl className="mt-5 flex flex-wrap gap-8">
          <Stat label="訪ねた場所" value={visits.length} unit="か所" />
          <Stat label="登録したシーン" value={idents.length} unit="件" />
          <Stat label="記事の編集" value={edits.length} unit="回" />
          <Stat label="いいね" value={likes} unit="件" />
          <Stat label="投じた票" value={votes} unit="票" />
          <Stat label="コメント" value={comments.length} unit="件" />
        </dl>
      </header>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
          訪ねた場所
          <span className="ml-2 text-xs font-normal text-ink-3">{visits.length}か所</span>
        </h2>
        {visits.length === 0 ? (
          <Empty>まだ訪問の記録はありません。行った場所で「行った」を押すと残ります。</Empty>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {visits.map((v) => (
              <li key={v.place_id}>
                <Link
                  href={`/places/${v.place_id}`}
                  className="flex items-center gap-3 rounded-lg border border-rule bg-card p-2.5 active:bg-paper-2"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-koke text-xs font-bold text-paper">
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{v.name}</span>
                    <span className="block text-[11px] text-ink-3">
                      {v.prefecture}
                      {v.visited_on && `・${String(v.visited_on).slice(0, 10)}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">記事の編集</h2>
        {edits.length === 0 ? (
          <Empty>まだ記事の編集はありません。</Empty>
        ) : (
          <Card className="divide-y divide-rule">
            {edits.map((e) => (
              <Link key={e.id} href={`/places/${e.place_id}`} className="flex gap-3 px-4 py-3 hover:bg-paper-2/50">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-bold text-ink-2">{e.place_name}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">{e.summary || "編集要約なし"}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-3">{e.created_at.slice(0, 10)}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">登録したシーン</h2>
        {idents.length === 0 ? (
          <Empty>まだ比定案の投稿はありません。</Empty>
        ) : (
          <ol className="space-y-3">
            {idents.map((it) => (
              <li key={it.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-baseline gap-2 text-xs text-ink-3">
                    <Link href={`/works/${it.work_slug}`} className="font-bold text-ink-2 hover:text-shu">
                      『{it.work_title}』
                    </Link>
                    <span>{it.created_at.slice(0, 10)}</span>
                  </div>
                  <Link href={`/passages/${it.passage_id}`} className="group mt-1.5 block">
                    <p className="text-sm font-bold group-hover:text-shu">{it.place_name} 説</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{it.quote}</p>
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">{it.rationale}</p>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">議論への書き込み</h2>
        {comments.length === 0 ? (
          <Empty>まだコメントはありません。</Empty>
        ) : (
          <ol className="space-y-3">
            {comments.map((c) => (
              <li key={c.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-baseline gap-2 text-xs text-ink-3">
                    <span className="font-bold text-ink-2">『{c.work_title}』</span>
                    <span>{c.created_at.slice(0, 10)}</span>
                  </div>
                  <Link href={`/passages/${c.passage_id}`} className="group mt-1 block">
                    <p className="line-clamp-1 text-xs text-ink-3 group-hover:text-shu">{c.quote}</p>
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{c.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
