import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/ui";
import { listPlaces } from "@/lib/queries";

export const metadata: Metadata = {
  title: "場所一覧",
  description: "登録された実在の場所と、そこに重なる作品の数。",
};

export default function PlacesPage() {
  const places = listPlaces();
  const byPref = new Map<string, typeof places>();
  for (const p of places) {
    const key = p.prefecture || "その他";
    byPref.set(key, [...(byPref.get(key) ?? []), p]);
  }
  const prefs = [...byPref.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-6">
      <div className="border-b border-rule pb-4">
        <h1 className="font-serif text-2xl font-bold tracking-wide">場所一覧</h1>
        <p className="mt-1 text-sm text-ink-3">
          {places.length}件の実在の場所が登録されています。ひとつの場所に複数の作品が重なることがあります。
        </p>
      </div>

      {places.length === 0 ? (
        <Empty>まだ場所が登録されていません。</Empty>
      ) : (
        <div className="space-y-8">
          {prefs.map(([pref, items]) => (
            <section key={pref}>
              <h2 className="mb-3 border-b border-rule pb-1.5 font-serif text-base font-bold tracking-wide">
                {pref}
                <span className="ml-2 text-xs font-normal text-ink-3">{items.length}件</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <Link key={p.id} href={`/places/${p.id}`} className="group">
                    <Card className="h-full p-4 transition group-hover:shadow-[0_4px_16px_rgba(36,33,29,0.07)]">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="truncate font-bold group-hover:text-shu">{p.name}</h3>
                        {p.work_count > 1 && (
                          <span className="shrink-0 rounded-full bg-shu-soft px-2 py-0.5 text-[10px] font-bold text-shu">
                            {p.work_count}作品
                          </span>
                        )}
                      </div>
                      {p.address && <p className="mt-0.5 truncate text-xs text-ink-3">{p.address}</p>}
                      {p.note && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">{p.note}</p>}
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
