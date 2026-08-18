import Link from "next/link";
import type { Metadata } from "next";
import { MapContribute } from "@/components/MapContribute";
import type { MapPin } from "@/components/MapView";
import { PrefectureJump } from "@/components/PrefectureJump";
import { RegionPicker, type PrefCount } from "@/components/RegionPicker";
import { WorkFilterSelect } from "@/components/WorkFilterSelect";
import { Empty } from "@/components/ui";
import { decodeParam } from "@/lib/params";
import { MEDIUM_LABEL, countsByPrefecture, getPins, listWorks, type Medium } from "@/lib/queries";
import { ALL_PREFECTURES, PREF_VIEW, regionOf } from "@/lib/regions";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string }>;
}): Promise<Metadata> {
  const pref = decodeParam((await searchParams).pref ?? "");
  return pref
    ? {
        title: `${pref}の地図`,
        description: `${pref}にある、小説やアニメの舞台を地図で。地図から直接シーンを書き込めます。`,
      }
    : {
        title: "地図から探す",
        description: "地方と都道府県をえらぶと、その範囲の舞台を地図で見られます。",
      };
}

const FILTERS = [
  { key: "all", label: "すべて" },
  ...(Object.keys(MEDIUM_LABEL) as Medium[]).map((m) => ({ key: m, label: MEDIUM_LABEL[m] })),
];

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ medium?: string; work?: string; pref?: string; region?: string }>;
}) {
  const { medium = "all", work: workSlug, pref: prefParam, region } = await searchParams;
  const pref = decodeParam(prefParam ?? "");
  // 表にない県名が来たら、選び直しの画面に戻す
  const prefecture = ALL_PREFECTURES.includes(pref) ? pref : "";

  const counts = await countsByPrefecture();
  const byPref: Record<string, PrefCount> = {};
  for (const c of counts) byPref[c.prefecture] = { places: c.places, works: c.works };

  /* ---- まだ県が決まっていない：地方 → 都道府県 をえらんでもらう ---- */

  if (!prefecture) {
    const totalPlaces = counts.reduce((n, c) => n + c.places, 0);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="border-b border-rule pb-3 sm:pb-4">
          <h1 className="font-serif text-xl font-bold tracking-wide sm:text-2xl">地図から探す</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-3 sm:text-sm">
            地方と都道府県をえらぶと、その範囲の地図が開きます。
            地図の上を押せば、その場に直接シーンを書き込めます。
          </p>
        </div>

        <PrefectureJump />

        <RegionPicker counts={byPref} defaultRegion={region} />

        <p className="border-t border-rule pt-4 text-xs text-ink-3">
          いま {totalPlaces} 件の場所が登録されています。
          <Link href="/places" className="ml-2 font-bold text-shu hover:underline">
            一覧で見る
          </Link>
          <Link href="/areas" className="ml-3 hover:text-shu">
            市区町村から探す
          </Link>
        </p>
      </div>
    );
  }

  /* ---- 県が決まった：その範囲の地図 ---- */

  const works = await listWorks();
  const work = workSlug ? works.find((w) => w.slug === workSlug) : undefined;
  const pins = await getPins({ medium, workId: work?.id, prefecture });
  const home = regionOf(prefecture);

  const mapPins: MapPin[] = pins.map((p) => ({
    id: p.identification_id,
    lat: p.lat,
    lng: p.lng,
    title: p.place_name,
    subtitle: p.work_title,
    quote: p.quote.length > 70 ? `${p.quote.slice(0, 70)}…` : p.quote,
    confidence: p.confidence,
    primary: p.rank === 0,
    disputed: p.disputed,
    likes: p.likes,
    image: p.image_path || undefined,
    href: `/places/${p.place_id}`,
  }));

  const primary = pins.filter((p) => p.rank === 0);

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { pref: prefecture, medium, work: workSlug, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") sp.set(k, v);
    return `/map${sp.toString() ? `?${sp}` : ""}`;
  };

  // 場所が無い県でも地図は出す。控えの中心と縮尺に合わせる。
  const view = PREF_VIEW[prefecture];
  const focus =
    mapPins.length === 0 && view ? { lat: view.lat, lng: view.lng, zoom: view.zoom, nonce: 1 } : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        <Link href="/map" className="hover:text-shu">
          地図
        </Link>
        <span>／</span>
        {home && (
          <>
            <Link href={`/map?region=${home.key}`} className="hover:text-shu">
              {home.name}
            </Link>
            <span>／</span>
          </>
        )}
        <span className="font-bold text-ink-2">{prefecture}</span>
        <Link
          href={home ? `/map?region=${home.key}` : "/map"}
          className="ml-auto rounded border border-rule-2 px-2.5 py-1.5 font-bold text-ink-2 hover:border-shu hover:text-shu"
        >
          えらび直す
        </Link>
      </nav>

      <div className="border-b border-rule pb-3 sm:pb-4">
        <h1 className="font-serif text-xl font-bold tracking-wide sm:text-2xl">{prefecture}の地図</h1>
        <p className="mt-1 text-xs text-ink-3 sm:text-sm">
          {primary.length > 0
            ? `${primary.length}件の場所を表示しています。地図を押せば、その場に直接シーンを書き込めます。`
            : "この県にはまだ場所がありません。地図を押して、最初の1件を登録してみてください。"}
        </p>
      </div>

      {/* 携帯では横スクロールの一列にして、地図をできるだけ上に出す */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={qs({ medium: f.key })}
            className={`shrink-0 rounded-full px-3.5 py-2.5 text-xs font-bold sm:px-3 sm:py-1.5 ${
              medium === f.key ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 shrink-0 text-rule-2">｜</span>
        <div className="shrink-0">
          <WorkFilterSelect
            works={works.map((w) => ({ slug: w.slug, title: w.title, author: w.author }))}
            value={workSlug}
            medium={medium}
            keep={{ pref: prefecture }}
          />
        </div>
        {work && (
          <Link href={qs({ work: undefined })} className="shrink-0 text-xs text-ink-3 hover:text-shu">
            絞り込みを解除
          </Link>
        )}
      </div>

      <MapContribute pins={mapPins} height="clamp(360px, 58vh, 620px)" focus={focus} />

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
          {prefecture}の場所
          <span className="ml-2 text-xs font-normal text-ink-3">{primary.length}件</span>
        </h2>
        {primary.length === 0 ? (
          <Empty>条件に合う場所がありません。</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {primary.map((p) => (
              <li key={p.identification_id}>
                <Link
                  href={`/places/${p.place_id}`}
                  className="flex items-baseline justify-between gap-2 rounded-lg border border-rule bg-card px-3 py-2.5 active:bg-paper-2"
                >
                  <span className="truncate text-sm font-bold">{p.place_name}</span>
                  <span className="shrink-0 text-[11px] text-ink-3">
                    {p.likes > 0 && <span className="mr-1.5 text-shu">♥{p.likes}</span>}
                    {p.work_title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {home && home.prefectures.length > 1 && (
        <section className="border-t border-rule pt-4">
          <p className="mb-2 text-xs text-ink-3">{home.name}のほかの県</p>
          <div className="flex flex-wrap gap-2">
            {home.prefectures
              .filter((p) => p !== prefecture)
              .map((p) => (
                <Link
                  key={p}
                  href={`/map?pref=${encodeURIComponent(p)}`}
                  className="rounded-full border border-rule-2 px-3 py-1.5 text-xs text-ink-2 hover:border-shu hover:text-shu"
                >
                  {p}
                  <span className="ml-1 text-ink-3">{byPref[p]?.places ?? 0}</span>
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
