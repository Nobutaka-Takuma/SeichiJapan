import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, Stat } from "@/components/ui";
import { getUserByHandle, getUserContributions } from "@/lib/queries";

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

  return (
    <div className="space-y-8">
      <header className="border-b border-rule pb-5">
        <h1 className="font-serif text-2xl font-bold tracking-wide">{user.display_name}</h1>
        <p className="text-sm text-ink-3">@{user.handle}・{user.created_at.slice(0, 10)}から参加</p>
        {user.bio && <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{user.bio}</p>}
        <dl className="mt-5 flex flex-wrap gap-8">
          <Stat label="登録したシーン" value={idents.length} unit="件" />
          <Stat label="記事の編集" value={edits.length} unit="回" />
          <Stat label="いいね" value={likes} unit="件" />
          <Stat label="投じた票" value={votes} unit="票" />
          <Stat label="コメント" value={comments.length} unit="件" />
        </dl>
      </header>

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
