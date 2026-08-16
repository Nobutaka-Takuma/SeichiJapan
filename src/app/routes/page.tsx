import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { listRoutes } from "@/lib/pilgrimage";

export const metadata: Metadata = {
  title: "巡礼コース",
  description: "回る順に地点を並べたコース。所要の目安と、自分がどこまで回ったかが分かります。",
};

const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

export default async function RoutesPage() {
  const user = await currentUser();
  const routes = await listRoutes(user?.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-wide">巡礼コース</h1>
          <p className="mt-1 text-sm text-ink-3">
            回る順に地点を並べたもの。歩く距離の目安と、どこまで回ったかが出ます。
          </p>
        </div>
        <Link href="/routes/new" className="min-h-[44px] rounded bg-shu px-4 py-2.5 text-sm font-bold text-paper">
          ＋ コースを作る
        </Link>
      </div>

      {routes.length === 0 ? (
        <Empty>まだコースがありません。最初のひとつを作ってみてください。</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routes.map((r) => (
            <Link key={r.slug} href={`/routes/${encodeURIComponent(r.slug)}`} className="group">
              <Card className="h-full p-4 active:bg-paper-2 sm:p-5">
                <div className="flex items-center gap-2 text-xs text-ink-3">
                  {r.area && <span className="rounded bg-paper-2 px-1.5 py-0.5">{r.area}</span>}
                  {r.work_title && <span>『{r.work_title}』</span>}
                </div>
                <h2 className="mt-1.5 font-serif text-lg font-bold group-hover:text-shu">{r.title}</h2>
                {r.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">{r.description}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3 text-xs text-ink-3">
                  <span>
                    <b className="font-bold text-ink-2">{r.stop_count}</b>か所
                  </span>
                  <span>
                    歩く距離 <b className="font-bold text-ink-2">{km(r.total_m)}</b>
                  </span>
                  {user && (
                    <span className={r.visited_count === r.stop_count && r.stop_count > 0 ? "font-bold text-koke" : ""}>
                      {r.visited_count === r.stop_count && r.stop_count > 0
                        ? "踏破"
                        : `${r.visited_count}/${r.stop_count} 訪問済み`}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
