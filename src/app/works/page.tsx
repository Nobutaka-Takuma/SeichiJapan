import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, MediumBadge } from "@/components/ui";
import { MEDIUM_LABEL, listWorks, type Medium } from "@/lib/queries";

export const metadata: Metadata = { title: "作品一覧" };

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "すべて" },
  ...(Object.keys(MEDIUM_LABEL) as Medium[]).map((m) => ({ key: m, label: MEDIUM_LABEL[m] })),
];

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; medium?: string }>;
}) {
  const { q = "", medium = "all" } = await searchParams;
  const works = await listWorks(q, medium);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-wide">作品一覧</h1>
          <p className="mt-1 text-sm text-ink-3">{works.length}作品が登録されています</p>
        </div>
        <Link href="/works/new" className="rounded bg-shu px-4 py-2 text-sm font-bold text-paper hover:opacity-90">
          作品を追加する
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="作品名・作者で検索"
          className="w-full max-w-xs rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu sm:w-auto"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/works?${new URLSearchParams({ ...(q ? { q } : {}), medium: f.key })}`}
              className={`rounded-full px-3.5 py-2.5 text-xs font-bold sm:px-3 sm:py-1.5 ${
                medium === f.key ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <button type="submit" className="rounded border border-rule-2 px-3 py-2 text-xs font-bold text-ink-2 hover:border-shu">
          検索
        </button>
      </form>

      {works.length === 0 ? (
        <Empty>該当する作品がありません。新しく追加してみてください。</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w) => (
            <Link key={w.id} href={`/works/${w.slug}`} className="group">
              <Card className="flex h-full flex-col p-5 transition group-hover:shadow-[0_4px_16px_rgba(36,33,29,0.07)]">
                <div className="flex items-center gap-2">
                  <MediumBadge medium={w.medium} />
                  <span className="text-xs text-ink-3">{w.year}</span>
                </div>
                <h2 className="mt-2 font-serif text-xl font-bold group-hover:text-shu">{w.title}</h2>
                <p className="text-sm text-ink-3">{w.author}</p>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-2">{w.description}</p>
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
      )}
    </div>
  );
}
