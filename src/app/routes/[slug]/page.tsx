import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapView, type MapPin } from "@/components/MapView";
import { VisitButton } from "@/components/VisitButton";
import { Card } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { decodeParam } from "@/lib/params";
import { getRoute } from "@/lib/pilgrimage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeParam((await params).slug);
  const route = await getRoute(slug);
  if (!route) return { title: "コースが見つかりません" };
  return {
    title: `${route.title}｜巡礼コース`,
    description: route.description || `${route.stop_count}か所をめぐるコース。`,
  };
}

const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);
const walk = (m: number) => Math.max(1, Math.round(m / 80));

export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeParam((await params).slug);
  const user = await currentUser();
  const route = await getRoute(slug, user?.id);
  if (!route) notFound();

  const pins: MapPin[] = route.stops.map((s, i) => ({
    id: s.place_id,
    lat: s.lat,
    lng: s.lng,
    title: `${i + 1}. ${s.name}`,
    subtitle: s.works ?? s.prefecture,
    confidence: 1,
    primary: true,
    image: s.photo_path || undefined,
    href: `/places/${s.place_id}`,
  }));

  const done = route.visited_count;
  const all = route.stops.length;
  const start = route.stops[0];
  const goal = route.stops[all - 1];

  return (
    <div className="space-y-6">
      <nav className="text-xs text-ink-3">
        <Link href="/routes" className="hover:text-shu">
          巡礼コース
        </Link>
        <span className="mx-1.5">／</span>
        <span className="truncate">{route.title}</span>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
          {route.area && <span className="rounded bg-paper-2 px-1.5 py-0.5">{route.area}</span>}
          {route.work_slug && (
            <Link href={`/works/${route.work_slug}`} className="hover:text-shu">
              『{route.work_title}』
            </Link>
          )}
        </div>
        <h1 className="font-serif text-2xl font-bold tracking-wide sm:text-3xl">{route.title}</h1>
        {route.description && <p className="max-w-2xl leading-loose text-ink-2">{route.description}</p>}

        <div className="flex flex-wrap gap-x-5 gap-y-1 border-y border-rule py-2.5 text-xs text-ink-3">
          <span>
            <b className="font-bold text-ink-2">{all}</b>か所
          </span>
          <span>
            歩く距離 <b className="font-bold text-ink-2">{km(route.total_m)}</b>
          </span>
          <span>
            所要 <b className="font-bold text-ink-2">約{walk(route.total_m)}分</b>（徒歩・見学の時間は別）
          </span>
          {route.author_handle && (
            <span className="sm:ml-auto">
              作成：
              <Link href={`/users/${route.author_handle}`} className="hover:text-shu">
                {route.author_name}
              </Link>
            </span>
          )}
        </div>

        {/* 進捗 */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-rule">
              <div
                className="h-full rounded-full bg-koke transition-[width]"
                style={{ width: `${all ? (done / all) * 100 : 0}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-bold text-ink-2">
              {done === all && all > 0 ? "踏破しました" : `${done}/${all} 訪問済み`}
            </span>
          </div>
        )}

        {start && goal && (
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${goal.lat},${goal.lng}&travelmode=walking${
                route.stops.length > 2
                  ? `&waypoints=${route.stops
                      .slice(1, -1)
                      .map((s) => `${s.lat},${s.lng}`)
                      .join("|")}`
                  : ""
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center rounded bg-ai px-4 text-sm font-bold text-paper"
            >
              地図アプリでこの順に案内 ↗
            </a>
            <Link
              href={`/near?lat=${start.lat}&lng=${start.lng}`}
              className="flex min-h-[44px] items-center rounded border border-rule-2 px-4 text-sm font-bold text-ink-2"
            >
              出発地の周辺を見る
            </Link>
          </div>
        )}
      </header>

      <Card className="overflow-hidden">
        <MapView pins={pins} height={320} />
      </Card>

      <ol className="space-y-3">
        {route.stops.map((s, i) => (
          <li key={s.place_id}>
            <Card className="overflow-hidden">
              <div className="flex gap-3 p-3 sm:p-4">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    s.visited ? "bg-koke text-paper" : "bg-shu text-paper"
                  }`}
                >
                  {s.visited ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/places/${s.place_id}`} className="block">
                    <span className="block font-bold hover:text-shu">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {s.prefecture} {s.address}
                    </span>
                  </Link>
                  {s.works && <p className="mt-1 truncate text-xs text-ink-2">{s.works}</p>}
                  {s.place_note && <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{s.place_note}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <VisitButton
                      placeId={s.place_id}
                      visited={s.visited}
                      total={0}
                      loggedIn={!!user}
                      size="sm"
                    />
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[36px] items-center rounded-full border border-rule-2 px-2.5 text-xs text-ink-2"
                    >
                      ここへ ↗
                    </a>
                  </div>
                </div>
                {s.photo_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.photo_path}
                    alt=""
                    loading="lazy"
                    className="hidden h-20 w-20 shrink-0 rounded object-cover sm:block"
                  />
                )}
              </div>
              {i < route.stops.length - 1 && (
                <p className="border-t border-rule bg-paper-2/40 px-4 py-1.5 text-[11px] text-ink-3">
                  ↓ 次まで {km(route.stops[i + 1].leg_m)}・徒歩{walk(route.stops[i + 1].leg_m)}分ほど
                </p>
              )}
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3 border-t border-rule pt-4 text-sm">
        <Link href="/routes" className="text-ink-2 hover:text-shu">
          ← ほかのコース
        </Link>
        <Link href="/routes/new" className="ml-auto font-bold text-shu">
          自分でもコースを作る →
        </Link>
      </div>
    </div>
  );
}
