import Link from "next/link";
import type { Metadata } from "next";
import { MapView, type MapPin } from "@/components/MapView";
import { Card, ConfidenceBar, Empty } from "@/components/ui";
import { MEDIUM_LABEL, getPins, listWorks, type Medium } from "@/lib/queries";

export const metadata: Metadata = {
  title: "全国地図",
  description: "登録されたすべての作品の舞台を、確度つきで日本地図の上に重ねて表示します。",
};

const FILTERS = [
  { key: "all", label: "すべて" },
  ...(Object.keys(MEDIUM_LABEL) as Medium[]).map((m) => ({ key: m, label: MEDIUM_LABEL[m] })),
];

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ medium?: string; work?: string }>;
}) {
  const { medium = "all", work: workSlug } = await searchParams;
  const works = listWorks();
  const work = workSlug ? works.find((w) => w.slug === workSlug) : undefined;
  const pins = getPins({ medium, workId: work?.id });

  const mapPins: MapPin[] = pins.map((p) => ({
    id: p.identification_id,
    lat: p.lat,
    lng: p.lng,
    title: p.place_name,
    subtitle: p.work_title,
    quote: p.quote.length > 70 ? `${p.quote.slice(0, 70)}…` : p.quote,
    confidence: p.confidence,
    primary: p.rank === 0,
    href: `/passages/${p.passage_id}`,
  }));

  const primary = pins.filter((p) => p.rank === 0);
  const byPref = new Map<string, typeof primary>();
  for (const p of primary) {
    const key = p.prefecture || "その他";
    byPref.set(key, [...(byPref.get(key) ?? []), p]);
  }
  const prefs = [...byPref.entries()].sort((a, b) => b[1].length - a[1].length);

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { medium, work: workSlug, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") sp.set(k, v);
    return `/map${sp.toString() ? `?${sp}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-rule pb-4">
        <h1 className="font-serif text-2xl font-bold tracking-wide">全国地図</h1>
        <p className="mt-1 text-sm text-ink-3">
          {primary.length}件の場所（対立説を含め {pins.length}件のピン）を表示しています。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={qs({ medium: f.key })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              medium === f.key ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 text-rule-2">｜</span>
        <Link
          href={qs({ work: undefined })}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            !workSlug ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
          }`}
        >
          全作品
        </Link>
        {works.map((w) => (
          <Link
            key={w.id}
            href={qs({ work: w.slug })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              workSlug === w.slug
                ? "bg-shu text-paper"
                : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
            }`}
          >
            {w.title}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        {mapPins.length === 0 ? (
          <div className="p-10">
            <Empty>条件に合う場所がありません。</Empty>
          </div>
        ) : (
          <MapView pins={mapPins} height={620} />
        )}
      </Card>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">都道府県別</h2>
        {prefs.length === 0 ? (
          <Empty>表示できる場所がありません。</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prefs.map(([pref, items]) => (
              <Card key={pref} className="p-4">
                <h3 className="flex items-baseline justify-between font-bold">
                  {pref}
                  <span className="text-xs font-normal text-ink-3">{items.length}件</span>
                </h3>
                <ul className="mt-3 space-y-2">
                  {items.map((p) => (
                    <li key={p.identification_id}>
                      <Link href={`/passages/${p.passage_id}`} className="group block">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm group-hover:text-shu">{p.place_name}</span>
                          <span className="shrink-0 text-[11px] text-ink-3">{p.work_title}</span>
                        </div>
                        <div className="mt-1">
                          <ConfidenceBar share={p.confidence} showLabel={false} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
