import { query } from "./db";

/**
 * 地名から地図の行き先を引く。
 *
 * 目的は「目的地の近くまで一息で飛ぶ」こと。厳密な住所検索ではないので、
 * 手元のデータ（登録済みの場所とその住所）で引けるものは手元で引き、
 * それでも見つからないときだけ外部の地名検索に問い合わせる。
 */

export type GeoHit = {
  kind: "place" | "area" | "prefecture" | "external";
  label: string;
  sub: string;
  lat: number;
  lng: number;
  zoom: number;
  /** 範囲が分かるものは範囲で寄せる */
  bounds?: [[number, number], [number, number]];
  count?: number;
  /** どの都道府県の話か。地方→県とたどる画面から、県の地図へ直接飛ぶために使う。 */
  prefecture?: string;
};

/** 都道府県庁のおおよその位置。県名だけで引かれたときの行き先。 */
const PREFECTURES: [string, number, number][] = [
  ["北海道", 43.0642, 141.3469],
  ["青森県", 40.8244, 140.74],
  ["岩手県", 39.7036, 141.1527],
  ["宮城県", 38.2688, 140.8721],
  ["秋田県", 39.7186, 140.1024],
  ["山形県", 38.2404, 140.3633],
  ["福島県", 37.7503, 140.4676],
  ["茨城県", 36.3418, 140.4468],
  ["栃木県", 36.5657, 139.8836],
  ["群馬県", 36.3907, 139.0604],
  ["埼玉県", 35.857, 139.6489],
  ["千葉県", 35.605, 140.1233],
  ["東京都", 35.6895, 139.6917],
  ["神奈川県", 35.4478, 139.6425],
  ["新潟県", 37.9026, 139.0232],
  ["富山県", 36.6953, 137.2114],
  ["石川県", 36.5947, 136.6256],
  ["福井県", 36.0652, 136.2216],
  ["山梨県", 35.6642, 138.5684],
  ["長野県", 36.6513, 138.181],
  ["岐阜県", 35.3912, 136.7223],
  ["静岡県", 34.9769, 138.3831],
  ["愛知県", 35.1802, 136.9066],
  ["三重県", 34.7303, 136.5086],
  ["滋賀県", 35.0045, 135.8686],
  ["京都府", 35.0212, 135.7556],
  ["大阪府", 34.6863, 135.5199],
  ["兵庫県", 34.6913, 135.183],
  ["奈良県", 34.6851, 135.8329],
  ["和歌山県", 34.226, 135.1675],
  ["鳥取県", 35.5036, 134.2383],
  ["島根県", 35.4723, 133.0505],
  ["岡山県", 34.6618, 133.935],
  ["広島県", 34.3966, 132.4596],
  ["山口県", 34.1859, 131.4706],
  ["徳島県", 34.0658, 134.5593],
  ["香川県", 34.3401, 134.0434],
  ["愛媛県", 33.8416, 132.7657],
  ["高知県", 33.5597, 133.5311],
  ["福岡県", 33.6064, 130.4183],
  ["佐賀県", 33.2494, 130.2988],
  ["長崎県", 32.7448, 129.8737],
  ["熊本県", 32.7898, 130.7417],
  ["大分県", 33.2382, 131.6126],
  ["宮崎県", 31.9111, 131.4239],
  ["鹿児島県", 31.5602, 130.5581],
  ["沖縄県", 26.2124, 127.6809],
];

/** 住所から市区町村にあたる部分を切り出す。「南魚沼郡湯沢町土樽」→「湯沢町」 */
function municipality(address: string): string | null {
  const withoutCounty = address.replace(/^.+?郡/, "");
  const m = withoutCounty.match(/^(.+?[市区町村])/);
  return m ? m[1] : null;
}

type Area = { key: string; muni: string; pref: string; lats: number[]; lngs: number[] };

/** 登録済みの場所の住所から、市区町村ごとのまとまりを作る。 */
async function areaIndex(): Promise<Area[]> {
  const rows = await query<{ lat: number; lng: number; prefecture: string; address: string }>(
    "SELECT lat, lng, prefecture, address FROM places",
  );

  const map = new Map<string, Area>();
  for (const r of rows) {
    const muni = municipality(r.address ?? "");
    if (!muni) continue;
    const key = `${r.prefecture}${muni}`;
    const area = map.get(key) ?? { key, muni, pref: r.prefecture, lats: [], lngs: [] };
    area.lats.push(r.lat);
    area.lngs.push(r.lng);
    map.set(key, area);
  }
  return [...map.values()];
}

function areaHit(a: Area): GeoHit {
  const south = Math.min(...a.lats);
  const north = Math.max(...a.lats);
  const west = Math.min(...a.lngs);
  const east = Math.max(...a.lngs);
  return {
    kind: "area",
    label: a.muni,
    sub: `${a.pref}・登録された場所 ${a.lats.length}件`,
    prefecture: a.pref,
    lat: (south + north) / 2,
    lng: (west + east) / 2,
    zoom: 14,
    bounds: [
      [south, west],
      [north, east],
    ],
    count: a.lats.length,
  };
}

/** 外部の地名検索（Nominatim）の結果をしばらく覚えておく。 */
const externalCache = new Map<string, GeoHit[]>();
let lastExternalCall = 0;

/**
 * 手元のデータで見つからない地名を外部に問い合わせる。
 * 利用規約に配慮して、直列・1秒間隔・結果はキャッシュ。
 * 到達できない環境では黙って空を返す（地図検索は手元の結果だけで成立する）。
 */
async function searchExternal(q: string): Promise<GeoHit[]> {
  if (process.env.SEICHI_GEOCODING === "off") return [];
  const cached = externalCache.get(q);
  if (cached) return cached;

  const wait = 1000 - (Date.now() - lastExternalCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastExternalCall = Date.now();

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "jp");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "ja");

    const res = await fetch(url, {
      headers: {
        "User-Agent": `SeichiJapan/1.0 (${process.env.SEICHI_CONTACT ?? "https://github.com/"})`,
        "Accept-Language": "ja",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      display_name: string;
      name?: string;
      lat: string;
      lon: string;
      boundingbox?: [string, string, string, string];
    }[];

    const hits: GeoHit[] = data.map((d) => {
      const bb = d.boundingbox;
      return {
        kind: "external",
        label: d.name || d.display_name.split(",")[0],
        sub: d.display_name.split(",").slice(1, 4).join("").trim() || "地名検索",
        lat: Number(d.lat),
        lng: Number(d.lon),
        zoom: 14,
        bounds: bb
          ? [
              [Number(bb[0]), Number(bb[2])],
              [Number(bb[1]), Number(bb[3])],
            ]
          : undefined,
      };
    });
    externalCache.set(q, hits);
    return hits;
  } catch {
    // 外部に出られない環境でも、手元の検索だけで使えるようにする
    return [];
  }
}

export async function searchGeo(term: string, limit = 8): Promise<GeoHit[]> {
  const q = term.trim();
  if (!q) return [];

  const hits: GeoHit[] = [];

  // 1. 市区町村（手元のデータから作った索引）
  for (const a of await areaIndex()) {
    if (a.muni.includes(q) || a.key.includes(q)) hits.push(areaHit(a));
  }
  hits.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  // 2. 都道府県
  for (const [name, lat, lng] of PREFECTURES) {
    if (name.includes(q) || name.replace(/[都道府県]$/, "") === q) {
      hits.push({ kind: "prefecture", label: name, sub: "都道府県", lat, lng, zoom: 10, prefecture: name });
    }
  }

  // 3. 登録済みの場所そのもの
  const places = await query<{
    id: number;
    name: string;
    lat: number;
    lng: number;
    prefecture: string;
    address: string;
  }>(
    `SELECT id, name, lat, lng, prefecture, address FROM places
      WHERE name ILIKE $1 OR address ILIKE $1 OR prefecture ILIKE $1
      ORDER BY (SELECT COUNT(*) FROM place_likes l WHERE l.place_id = places.id) DESC
      LIMIT 6`,
    [`%${q}%`],
  );

  for (const p of places) {
    hits.push({
      kind: "place",
      label: p.name,
      sub: `${p.prefecture} ${p.address}`.trim(),
      prefecture: p.prefecture,
      lat: p.lat,
      lng: p.lng,
      zoom: 16,
    });
  }

  // 4. 手元で見つからない地名だけ外部に聞く
  if (hits.length === 0) {
    hits.push(...(await searchExternal(q)));
  }

  return hits.slice(0, limit);
}
