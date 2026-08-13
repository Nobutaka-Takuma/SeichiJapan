import Link from "next/link";
import type { Metadata } from "next";
import { LikeButton } from "@/components/LikeButton";
import { Card, Empty } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { listPlaces } from "@/lib/queries";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "場所一覧",
  description: "登録された聖地の一覧。人気順・作品数順で並べ替えられます。",
};

const SORTS = [
  { key: "likes", label: "いいねが多い順" },
  { key: "works", label: "作品が多い順" },
  { key: "name", label: "名前順" },
] as const;

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { sort = "likes", q = "" } = await searchParams;
  const key = (SORTS.find((s) => s.key === sort)?.key ?? "likes") as "likes" | "works" | "name";
  const all = listPlaces(500, key);
  const term = q.trim();
  const places = term
    ? all.filter((p) =>
        [p.name, p.prefecture, p.address, p.note].some((v) => v?.includes(term)),
      )
    : all;
  const user = await currentUser();

  const likedIds = new Set(
    user
      ? (db.prepare("SELECT place_id FROM place_likes WHERE user_id = ?").all(user.id) as { place_id: number }[]).map(
          (r) => r.place_id,
        )
      : [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-wide">場所一覧</h1>
          <p className="mt-1 text-sm text-ink-3">
            {term ? `「${term}」の検索結果 ${places.length}件` : `${places.length}件`}
            。ひとつの場所に複数の作品が重なることがあります。
          </p>
        </div>
        <Link href="/map" className="rounded bg-shu px-4 py-2 text-sm font-bold text-paper hover:opacity-90">
          地図から場所を追加
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="場所名・都道府県で検索"
            className="w-56 rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu"
          />
          <input type="hidden" name="sort" value={key} />
          <button
            type="submit"
            className="rounded border border-rule-2 px-3 py-2 text-xs font-bold text-ink-2 hover:border-shu hover:text-shu"
          >
            検索
          </button>
        </form>
        <div className="flex gap-1">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/places?${new URLSearchParams({ ...(term ? { q: term } : {}), sort: s.key })}`}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                key === s.key ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {places.length === 0 ? (
        <Empty>
          {term ? `「${term}」に一致する場所はありません。` : "まだ場所が登録されていません。"}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((p) => (
            <Card key={p.id} className="flex h-full flex-col overflow-hidden">
              <Link href={`/places/${p.id}`} className="group">
                {p.photo_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_path} alt="" className="h-32 w-full object-cover" />
                ) : null}
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate font-bold group-hover:text-shu">{p.name}</h2>
                    {p.work_count > 1 && (
                      <span className="shrink-0 rounded-full bg-shu-soft px-2 py-0.5 text-[10px] font-bold text-shu">
                        {p.work_count}作品
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-3">
                    {p.prefecture} {p.address}
                  </p>
                  {p.note && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">{p.note}</p>}
                </div>
              </Link>
              <div className="mt-auto flex items-center justify-between border-t border-rule px-4 py-2.5">
                <span className="text-[11px] text-ink-3">シーン {p.scene_count}件</span>
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
    </div>
  );
}
