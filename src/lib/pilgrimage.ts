import { count, one, query } from "./db";
import { ensureDatabaseReady } from "./data";
import type { Medium } from "./queries";

/**
 * 巡礼のための問い合わせ。
 *
 * 「いま近くに何があるか」「どう回るか」「どこへ行ったか」を扱う。
 * 訪ねる人にとっても、迎える側にとっても、ここが実際に使う部分になる。
 */

const ready = () => ensureDatabaseReady();

/** 緯度経度から距離（m）を出すSQL片。粗い近似で足りる。 */
const DISTANCE_SQL = `round(sqrt(
  power((pl.lat - $1) * 111000, 2) +
  power((pl.lng - $2) * 111000 * cos(radians($1)), 2)
))::int`;

export type NearbyPlace = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  prefecture: string;
  address: string;
  note: string;
  photo_path: string;
  distance_m: number;
  likes: number;
  work_count: number;
  scene_count: number;
  works: string | null;
  visited: boolean;
};

/** 現在地から近い順の聖地。巡礼中にいちばん使う問い合わせ。 */
export async function placesNear(
  lat: number,
  lng: number,
  opts: { limit?: number; radiusM?: number; viewerId?: number } = {},
): Promise<NearbyPlace[]> {
  await ready();
  const { limit = 30, radiusM = 50_000, viewerId } = opts;
  // 緯度1度≒111km。半径から矩形の幅を出して先に絞る。
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

  return query<NearbyPlace>(
    `SELECT pl.id, pl.name, pl.lat, pl.lng, pl.prefecture, pl.address, pl.note, pl.photo_path,
            ${DISTANCE_SQL} AS distance_m,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = pl.id) AS likes,
            (SELECT COUNT(DISTINCT p.work_id)::int FROM identifications i
               JOIN passages p ON p.id = i.passage_id WHERE i.place_id = pl.id) AS work_count,
            (SELECT COUNT(*)::int FROM identifications i WHERE i.place_id = pl.id) AS scene_count,
            (SELECT string_agg(DISTINCT w.title, '／') FROM identifications i
               JOIN passages p ON p.id = i.passage_id
               JOIN works w ON w.id = p.work_id WHERE i.place_id = pl.id) AS works,
            EXISTS (SELECT 1 FROM visits v WHERE v.place_id = pl.id AND v.user_id = $5) AS visited
       FROM places pl
      WHERE pl.lat BETWEEN $1 - $3 AND $1 + $3
        AND pl.lng BETWEEN $2 - $4 AND $2 + $4
      ORDER BY distance_m ASC
      LIMIT $6`,
    [lat, lng, dLat, dLng, viewerId ?? -1, limit],
  );
}

/* ---------- 訪問記録 ---------- */

export type VisitState = { visited: boolean; visited_on: string | null; note: string; total: number };

export async function getVisitState(placeId: number, viewerId?: number): Promise<VisitState> {
  await ready();
  const total = await count("SELECT COUNT(*) AS n FROM visits WHERE place_id = $1", [placeId]);
  if (!viewerId) return { visited: false, visited_on: null, note: "", total };
  const row = await one<{ visited_on: string | null; note: string }>(
    "SELECT visited_on, note FROM visits WHERE place_id = $1 AND user_id = $2",
    [placeId, viewerId],
  );
  return { visited: !!row, visited_on: row?.visited_on ?? null, note: row?.note ?? "", total };
}

export async function visitedPlaceIds(userId?: number): Promise<Set<number>> {
  if (!userId) return new Set();
  await ready();
  const rows = await query<{ place_id: number }>("SELECT place_id FROM visits WHERE user_id = $1", [userId]);
  return new Set(rows.map((r) => r.place_id));
}

export type VisitLogItem = {
  place_id: number;
  name: string;
  prefecture: string;
  visited_on: string | null;
  note: string;
  photo_path: string;
};

export async function getVisitLog(userId: number, limit = 100): Promise<VisitLogItem[]> {
  await ready();
  return query<VisitLogItem>(
    `SELECT v.place_id, pl.name, pl.prefecture, v.visited_on, v.note, pl.photo_path
       FROM visits v JOIN places pl ON pl.id = v.place_id
      WHERE v.user_id = $1
      ORDER BY COALESCE(v.visited_on, v.created_at::date) DESC, v.created_at DESC
      LIMIT $2`,
    [userId, limit],
  );
}

/* ---------- 巡礼コース ---------- */

export type RouteSummary = {
  id: number;
  slug: string;
  title: string;
  description: string;
  area: string;
  work_title: string | null;
  work_slug: string | null;
  author_handle: string | null;
  author_name: string | null;
  stop_count: number;
  total_m: number;
  visited_count: number;
};

const ROUTE_COLUMNS = `r.id, r.slug, r.title, r.description, r.area,
       w.title AS work_title, w.slug AS work_slug,
       u.handle AS author_handle, u.display_name AS author_name,
       (SELECT COUNT(*)::int FROM route_stops s WHERE s.route_id = r.id) AS stop_count`;

/** コースの総距離。地点を順に結んだ直線距離の合計。 */
async function routeDistance(routeId: number): Promise<number> {
  const rows = await query<{ lat: number; lng: number }>(
    `SELECT pl.lat, pl.lng FROM route_stops s JOIN places pl ON pl.id = s.place_id
      WHERE s.route_id = $1 ORDER BY s.position`,
    [routeId],
  );
  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    const dy = (b.lat - a.lat) * 111_000;
    const dx = (b.lng - a.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
    total += Math.hypot(dx, dy);
  }
  return Math.round(total);
}

export async function listRoutes(viewerId?: number): Promise<RouteSummary[]> {
  await ready();
  const rows = await query<Omit<RouteSummary, "total_m" | "visited_count">>(
    `SELECT ${ROUTE_COLUMNS}
       FROM routes r
       LEFT JOIN works w ON w.id = r.work_id
       LEFT JOIN users u ON u.id = r.created_by
      ORDER BY stop_count DESC, r.created_at DESC`,
  );
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      total_m: await routeDistance(r.id),
      visited_count: viewerId
        ? await count(
            `SELECT COUNT(*) AS n FROM route_stops s
               JOIN visits v ON v.place_id = s.place_id AND v.user_id = $2
              WHERE s.route_id = $1`,
            [r.id, viewerId],
          )
        : 0,
    })),
  );
}

export type RouteStop = {
  position: number;
  place_id: number;
  name: string;
  prefecture: string;
  address: string;
  note: string;
  place_note: string;
  lat: number;
  lng: number;
  photo_path: string;
  works: string | null;
  visited: boolean;
  /** ひとつ前の地点からの距離（m） */
  leg_m: number;
};

export async function getRoute(
  slug: string,
  viewerId?: number,
): Promise<(RouteSummary & { stops: RouteStop[] }) | undefined> {
  await ready();
  const route = await one<Omit<RouteSummary, "total_m" | "visited_count">>(
    `SELECT ${ROUTE_COLUMNS}
       FROM routes r
       LEFT JOIN works w ON w.id = r.work_id
       LEFT JOIN users u ON u.id = r.created_by
      WHERE r.slug = $1`,
    [slug],
  );
  if (!route) return undefined;

  const stops = await query<Omit<RouteStop, "leg_m">>(
    `SELECT s.position, s.place_id, s.note, pl.name, pl.prefecture, pl.address,
            pl.note AS place_note, pl.lat, pl.lng, pl.photo_path,
            (SELECT string_agg(DISTINCT w.title, '／') FROM identifications i
               JOIN passages p ON p.id = i.passage_id
               JOIN works w ON w.id = p.work_id WHERE i.place_id = pl.id) AS works,
            EXISTS (SELECT 1 FROM visits v WHERE v.place_id = pl.id AND v.user_id = $2) AS visited
       FROM route_stops s JOIN places pl ON pl.id = s.place_id
      WHERE s.route_id = $1 ORDER BY s.position`,
    [route.id, viewerId ?? -1],
  );

  const withLegs: RouteStop[] = stops.map((s, i) => {
    if (i === 0) return { ...s, leg_m: 0 };
    const a = stops[i - 1];
    const dy = (s.lat - a.lat) * 111_000;
    const dx = (s.lng - a.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
    return { ...s, leg_m: Math.round(Math.hypot(dx, dy)) };
  });

  return {
    ...route,
    stops: withLegs,
    total_m: withLegs.reduce((a, s) => a + s.leg_m, 0),
    visited_count: withLegs.filter((s) => s.visited).length,
  };
}

/** ある場所を含むコース。場所ページから辿れるようにする。 */
export async function routesForPlace(placeId: number): Promise<{ slug: string; title: string; stop_count: number }[]> {
  await ready();
  return query(
    `SELECT r.slug, r.title, (SELECT COUNT(*)::int FROM route_stops s2 WHERE s2.route_id = r.id) AS stop_count
       FROM route_stops s JOIN routes r ON r.id = s.route_id
      WHERE s.place_id = $1 ORDER BY r.title`,
    [placeId],
  );
}

/* ---------- 市区町村ごとのまとまり（迎える側の視点） ---------- */

export type AreaSummary = {
  key: string;
  prefecture: string;
  municipality: string;
  place_count: number;
  work_count: number;
  likes: number;
  visits: number;
  lat: number;
  lng: number;
  works: string[];
};

/** 住所から市区町村を切り出すSQL片。「南魚沼郡湯沢町土樽」→「湯沢町」 */
const MUNI_SQL = `substring(regexp_replace(pl.address, '^.+?郡', '') from '^(.+?[市区町村])')`;

export async function listAreas(): Promise<AreaSummary[]> {
  await ready();
  const rows = await query<Omit<AreaSummary, "works" | "key"> & { works: string | null }>(
    `SELECT pl.prefecture,
            ${MUNI_SQL} AS municipality,
            COUNT(*)::int AS place_count,
            AVG(pl.lat)::double precision AS lat,
            AVG(pl.lng)::double precision AS lng,
            (SELECT COUNT(DISTINCT p.work_id)::int FROM identifications i
               JOIN passages p ON p.id = i.passage_id
              WHERE i.place_id = ANY(array_agg(pl.id))) AS work_count,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = ANY(array_agg(pl.id))) AS likes,
            (SELECT COUNT(*)::int FROM visits v WHERE v.place_id = ANY(array_agg(pl.id))) AS visits,
            (SELECT string_agg(DISTINCT w.title, '／') FROM identifications i
               JOIN passages p ON p.id = i.passage_id
               JOIN works w ON w.id = p.work_id
              WHERE i.place_id = ANY(array_agg(pl.id))) AS works
       FROM places pl
      WHERE ${MUNI_SQL} IS NOT NULL
      GROUP BY pl.prefecture, ${MUNI_SQL}
      ORDER BY place_count DESC, pl.prefecture`,
  );
  return rows.map((r) => ({
    ...r,
    key: `${r.prefecture}${r.municipality}`,
    works: r.works ? r.works.split("／") : [],
  }));
}

export type AreaPlace = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  note: string;
  photo_path: string;
  address: string;
  likes: number;
  scene_count: number;
  works: string | null;
};

export async function getArea(
  prefecture: string,
  municipality: string,
): Promise<{ prefecture: string; municipality: string; places: AreaPlace[] } | undefined> {
  await ready();
  const places = await query<AreaPlace>(
    `SELECT pl.id, pl.name, pl.lat, pl.lng, pl.note, pl.photo_path, pl.address,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = pl.id) AS likes,
            (SELECT COUNT(*)::int FROM identifications i WHERE i.place_id = pl.id) AS scene_count,
            (SELECT string_agg(DISTINCT w.title, '／') FROM identifications i
               JOIN passages p ON p.id = i.passage_id
               JOIN works w ON w.id = p.work_id WHERE i.place_id = pl.id) AS works
       FROM places pl
      WHERE pl.prefecture = $1 AND ${MUNI_SQL} = $2
      ORDER BY likes DESC, pl.name`,
    [prefecture, municipality],
  );
  if (places.length === 0) return undefined;
  return { prefecture, municipality, places };
}

/* ---------- 回遊のための関連項目 ---------- */

export type RelatedPlace = {
  id: number;
  name: string;
  prefecture: string;
  note: string;
  photo_path: string;
  reason: string;
  likes: number;
};

/**
 * この項目から辿れる先。
 * 「同じ作品に出てくる場所」と「同じ市区町村の場所」を混ぜて返す。
 */
export async function relatedPlaces(placeId: number, limit = 8): Promise<RelatedPlace[]> {
  await ready();
  const sameWork = await query<RelatedPlace>(
    `SELECT DISTINCT pl.id, pl.name, pl.prefecture, pl.note, pl.photo_path,
            '同じ作品に登場' AS reason,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = pl.id) AS likes
       FROM identifications i
       JOIN passages p ON p.id = i.passage_id
       JOIN passages p2 ON p2.work_id = p.work_id
       JOIN identifications i2 ON i2.passage_id = p2.id
       JOIN places pl ON pl.id = i2.place_id
      WHERE i.place_id = $1 AND pl.id <> $1
      LIMIT $2`,
    [placeId, limit],
  );

  const remaining = limit - sameWork.length;
  if (remaining <= 0) return sameWork.slice(0, limit);

  const seen = new Set(sameWork.map((p) => p.id));
  const sameArea = await query<RelatedPlace>(
    `SELECT pl.id, pl.name, pl.prefecture, pl.note, pl.photo_path,
            '同じ市区町村' AS reason,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = pl.id) AS likes
       FROM places pl
      WHERE pl.id <> $1
        AND pl.prefecture = (SELECT prefecture FROM places WHERE id = $1)
        AND ${MUNI_SQL} = (SELECT substring(regexp_replace(address, '^.+?郡', '') from '^(.+?[市区町村])') FROM places WHERE id = $1)
      ORDER BY likes DESC
      LIMIT $2`,
    [placeId, remaining + seen.size],
  );

  return [...sameWork, ...sameArea.filter((p) => !seen.has(p.id))].slice(0, limit);
}

/** 記事本文の [[…]] で、この項目を指している他の項目（被リンク）。 */
export async function backlinks(placeName: string, placeId: number): Promise<{ id: number; name: string }[]> {
  await ready();
  return query(
    `SELECT id, name FROM places
      WHERE id <> $2 AND body LIKE $1
      ORDER BY name LIMIT 20`,
    [`%[[${placeName}]]%`, placeId],
  );
}

/** おまかせ表示。Wikipedia の「おまかせ表示」にあたる。 */
export async function randomPlaceId(): Promise<number | undefined> {
  await ready();
  const row = await one<{ id: number }>("SELECT id FROM places ORDER BY random() LIMIT 1");
  return row?.id;
}

/* ---------- 記事本文の [[リンク]] ---------- */

/** 本文に出てくる [[名前]] を、実在する項目のIDに解決する。 */
export async function resolveWikiLinks(body: string): Promise<Map<string, number>> {
  const names = [...body.matchAll(/\[\[([^\]]{1,60})\]\]/g)].map((m) => m[1]);
  const map = new Map<string, number>();
  if (names.length === 0) return map;
  await ready();
  const rows = await query<{ id: number; name: string }>(
    "SELECT id, name FROM places WHERE name = ANY($1::text[])",
    [[...new Set(names)]],
  );
  for (const r of rows) map.set(r.name, r.id);
  return map;
}

export type MediumLabel = Medium;
