import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapView, type MapPin } from "@/components/MapView";
import { Card, MediumBadge } from "@/components/ui";
import { decodeParam } from "@/lib/params";
import { getArea, listAreas } from "@/lib/pilgrimage";
import { siblingAreas, worksInArea } from "@/lib/wander";

/** 「東京都新宿区」を都道府県と市区町村に割る。 */
function split(key: string): { prefecture: string; municipality: string } | null {
  const m = key.match(/^(.+?[都道府県])(.+)$/);
  return m ? { prefecture: m[1], municipality: m[2] } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const key = decodeParam((await params).key);
  const parts = split(key);
  if (!parts) return { title: "地域が見つかりません" };
  return {
    title: `${parts.municipality}の聖地`,
    description: `${key}にある、小説やアニメの舞台をまとめています。`,
  };
}

export default async function AreaPage({ params }: { params: Promise<{ key: string }> }) {
  const key = decodeParam((await params).key);
  const parts = split(key);
  if (!parts) notFound();

  const area = await getArea(parts.prefecture, parts.municipality);
  if (!area) notFound();

  const [summaries, works, siblings] = await Promise.all([
    listAreas(),
    worksInArea(parts.prefecture, parts.municipality),
    siblingAreas(parts.prefecture, parts.municipality),
  ]);
  const summary = summaries.find((s) => s.key === key);

  const pins: MapPin[] = area.places.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    title: p.name,
    subtitle: p.works ?? parts.municipality,
    confidence: 1,
    primary: true,
    likes: p.likes,
    image: p.photo_path || undefined,
    href: `/places/${p.id}`,
  }));

  const center = { lat: pins[0]?.lat ?? 35.68, lng: pins[0]?.lng ?? 139.69 };

  return (
    <div className="space-y-6">
      <nav className="text-xs text-ink-3">
        <Link href="/areas" className="hover:text-shu">
          地域
        </Link>
        <span className="mx-1.5">／</span>
        <span>{key}</span>
      </nav>

      <header>
        <p className="text-sm text-ink-3">{parts.prefecture}</p>
        <h1 className="font-serif text-2xl font-bold tracking-wide sm:text-3xl">{parts.municipality}の聖地</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-y border-rule py-2.5 text-xs text-ink-3">
          <span>
            <b className="font-bold text-ink-2">{area.places.length}</b>か所
          </span>
          {summary && (
            <>
              <span>
                作品 <b className="font-bold text-ink-2">{summary.work_count}</b>
              </span>
              {summary.likes > 0 && <span className="text-shu">♥{summary.likes}</span>}
              {summary.visits > 0 && <span className="text-koke">訪問記録 {summary.visits}</span>}
            </>
          )}
        </div>
        {summary && summary.works.length > 0 && (
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{summary.works.join("／")}</p>
        )}
      </header>

      <Card className="overflow-hidden">
        <MapView pins={pins} height={300} />
        <div className="flex flex-wrap gap-3 border-t border-rule px-4 py-2.5 text-xs">
          <Link href={`/near?lat=${center.lat}&lng=${center.lng}`} className="font-bold text-shu">
            この地域を歩く（近い順に見る）→
          </Link>
          <Link href="/routes/new" className="text-ink-3 hover:text-shu">
            この地域のコースを作る
          </Link>
        </div>
      </Card>

      <ol className="grid gap-3 sm:grid-cols-2">
        {area.places.map((p) => (
          <li key={p.id}>
            <Link
              href={`/places/${p.id}`}
              className="flex h-full items-stretch gap-3 rounded-lg border border-rule bg-card active:bg-paper-2"
            >
              {p.photo_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_path} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-l-lg object-cover" />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-l-lg bg-paper-2 font-serif text-2xl text-rule-2">
                  {p.name.slice(0, 1)}
                </span>
              )}
              <span className="min-w-0 flex-1 py-2.5 pr-3">
                <span className="block truncate font-bold">{p.name}</span>
                {p.works && <span className="mt-0.5 block truncate text-xs text-ink-2">{p.works}</span>}
                {p.note && <span className="mt-1 line-clamp-2 text-[11px] text-ink-3">{p.note}</span>}
                <span className="mt-1 flex gap-2 text-[11px] text-ink-3">
                  {p.likes > 0 && <span className="text-shu">♥{p.likes}</span>}
                  <span>シーン{p.scene_count}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {works.length > 0 && (
        <section>
          <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
            この地域を舞台にしている作品
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {works.map((w) => (
              <li key={w.slug}>
                <Link
                  href={`/works/${encodeURIComponent(w.slug)}`}
                  className="flex items-center gap-2 rounded-lg border border-rule bg-card px-3 py-2.5 active:bg-paper-2"
                >
                  <MediumBadge medium={w.medium} />
                  <span className="min-w-0 flex-1 truncate font-bold">『{w.title}』</span>
                  <span className="shrink-0 text-[11px] text-ink-3">{w.place_count}か所</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {siblings.length > 0 && (
        <section>
          <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
            {parts.prefecture}のほかの地域
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((a) => (
              <Link
                key={a.key}
                href={`/areas/${encodeURIComponent(a.key)}`}
                className="rounded-full border border-rule-2 px-3 py-1.5 text-xs text-ink-2 hover:border-shu hover:text-shu"
              >
                {a.municipality}
                <span className="ml-1 text-ink-3">{a.place_count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
