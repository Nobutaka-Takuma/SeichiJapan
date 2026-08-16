import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/ui";
import { listAreas } from "@/lib/pilgrimage";

export const metadata: Metadata = {
  title: "地域から探す",
  description: "市区町村ごとに、その土地にある作品の舞台をまとめています。",
};

export default async function AreasPage() {
  const areas = await listAreas();

  const byPref = new Map<string, typeof areas>();
  for (const a of areas) byPref.set(a.prefecture, [...(byPref.get(a.prefecture) ?? []), a]);

  return (
    <div className="space-y-6">
      <div className="border-b border-rule pb-4">
        <h1 className="font-serif text-2xl font-bold tracking-wide">地域から探す</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          市区町村ごとのまとまり。その土地にどの作品の舞台がいくつあるかが分かります。
          迎える側が「うちの町の聖地」を見渡すのにも使えます。
        </p>
      </div>

      {areas.length === 0 ? (
        <Empty>まだ地域のデータがありません。</Empty>
      ) : (
        <div className="space-y-8">
          {[...byPref.entries()]
            .sort((a, b) => b[1].length - a[1].length)
            .map(([pref, list]) => (
              <section key={pref}>
                <h2 className="mb-3 border-b border-rule pb-1.5 font-serif text-base font-bold tracking-wide">
                  {pref}
                  <span className="ml-2 text-xs font-normal text-ink-3">{list.length}市区町村</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => (
                    <Link
                      key={a.key}
                      href={`/areas/${encodeURIComponent(a.key)}`}
                      className="group"
                    >
                      <Card className="h-full p-4 active:bg-paper-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-bold group-hover:text-shu">{a.municipality}</h3>
                          <span className="shrink-0 text-xs text-ink-3">{a.place_count}か所</span>
                        </div>
                        {a.works.length > 0 && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-2">
                            {a.works.join("／")}
                          </p>
                        )}
                        <p className="mt-2 flex gap-3 text-[11px] text-ink-3">
                          <span>作品{a.work_count}</span>
                          {a.likes > 0 && <span className="text-shu">♥{a.likes}</span>}
                          {a.visits > 0 && <span className="text-koke">訪問{a.visits}</span>}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
