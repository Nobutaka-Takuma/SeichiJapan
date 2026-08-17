import { query } from "../db";
import { ensureDatabaseReady } from "../data";
import { JAPAN_BOUNDS, type PlaceInput, type ResearchInput, type SceneInput } from "./schema";

/**
 * 受け取ったデータを、書き込む前に点検する。
 *
 * いちばん怖いのは「それらしいが間違っている座標」なので、
 * 座標については次の順でこちらが引き直す。
 *
 *   1. Wikidata の項目ID（P625）
 *   2. OpenStreetMap の要素ID
 *   3. 住所（Nominatim）
 *
 * 引けた座標と、相手が書いてきた座標がずれていれば、そこで止める。
 * 外に出られない環境では照合を「未実施」として報告し、
 * **黙って通すことはしない**。
 */

export type Severity = "error" | "warn" | "info";

export type Finding = { level: Severity; what: string; detail?: string };

export type PlaceReport = {
  name: string;
  /** 最終的に採用する座標。決められなければ null。 */
  lat: number | null;
  lng: number | null;
  /** 座標の出どころ。 */
  source: "wikidata" | "osm" | "nominatim" | "declared" | "none";
  findings: Finding[];
};

const dist = (aLat: number, aLng: number, bLat: number, bLng: number) =>
  Math.round(
    Math.hypot((aLat - bLat) * 111_000, (aLng - bLng) * 111_000 * Math.cos((aLat * Math.PI) / 180)),
  );

const inJapan = (lat: number, lng: number) =>
  lat >= JAPAN_BOUNDS.minLat &&
  lat <= JAPAN_BOUNDS.maxLat &&
  lng >= JAPAN_BOUNDS.minLng &&
  lng <= JAPAN_BOUNDS.maxLng;

/** 座標をどれだけ離れていたら別物とみなすか。細かさごとに変える。 */
const TOLERANCE_M: Record<string, number> = { point: 150, site: 400, area: 1500 };

const UA = `SeichiJapan/1.0 (${process.env.SEICHI_CONTACT ?? "https://example.com"})`;

/**
 * 外への問い合わせ。
 *
 * 失敗の理由を分けて返すのが肝心。**「その識別子には座標が無い」と
 * 「こちらから外に出られない」は、まったく別のこと**だからだ。
 * 前者はデータの不備、後者はこちらの都合で、利用者に伝えるべき次の一手も違う。
 */
type Fetched = { ok: true; data: unknown } | { ok: false; reason: "off" | "unreachable" | "notfound" };

/** 外に出られないことが一度でも分かったら、以降は待たずに諦める。 */
let unreachableSeen = false;

/**
 * 「見つからなかった」と言ってよいのは 404 のときだけ。
 *
 * 串（プロキシ）や踏み台のある環境では、遮断が 403 や 407 として返る。
 * これを「その識別子は存在しない」と読み替えてしまうと、
 * **正しいデータに誤りの札を貼る**ことになる。回数制限や相手方の不調も同じ。
 */
function reasonFor(status: number): "unreachable" | "notfound" {
  return status === 404 ? "notfound" : "unreachable";
}

async function getJson(url: string, timeoutMs = 12_000): Promise<Fetched> {
  if (process.env.SEICHI_GEOCODING === "off") return { ok: false, reason: "off" };
  if (unreachableSeen) return { ok: false, reason: "unreachable" };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const reason = reasonFor(res.status);
      if (reason === "unreachable") unreachableSeen = true;
      return { ok: false, reason };
    }
    return { ok: true, data: await res.json() };
  } catch {
    unreachableSeen = true;
    return { ok: false, reason: "unreachable" };
  }
}

/** 照合が一度でもできなかったか。まとめの但し書きに使う。 */
export const lookupWasBlocked = () => unreachableSeen;

/** 照合が「できなかった」のか「して合わなかった」のかを持ち回る。 */
type Lookup = { coords: { lat: number; lng: number } | null; unreachable: boolean };

/** Wikidata の項目から座標（P625）を引く。 */
async function fromWikidata(qid: string): Promise<Lookup> {
  const res = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!res.ok) return { coords: null, unreachable: res.reason !== "notfound" };
  const data = res.data as { entities?: Record<string, { claims?: Record<string, unknown[]> }> };
  const claims = data?.entities?.[qid]?.claims?.P625;
  const value = (claims?.[0] as { mainsnak?: { datavalue?: { value?: { latitude?: number; longitude?: number } } } })
    ?.mainsnak?.datavalue?.value;
  if (typeof value?.latitude !== "number" || typeof value?.longitude !== "number") {
    return { coords: null, unreachable: false };
  }
  return { coords: { lat: value.latitude, lng: value.longitude }, unreachable: false };
}

function firstHit(res: Fetched): Lookup {
  if (!res.ok) return { coords: null, unreachable: res.reason !== "notfound" };
  const hit = (res.data as { lat?: string; lon?: string }[] | null)?.[0];
  if (!hit?.lat || !hit?.lon) return { coords: null, unreachable: false };
  return { coords: { lat: Number(hit.lat), lng: Number(hit.lon) }, unreachable: false };
}

/** OpenStreetMap の要素から座標を引く。 */
async function fromOsm(ref: string): Promise<Lookup> {
  const [kind, id] = ref.split("/");
  const prefix = { node: "N", way: "W", relation: "R" }[kind];
  if (!prefix) return { coords: null, unreachable: false };
  return firstHit(await getJson(`https://nominatim.openstreetmap.org/lookup?osm_ids=${prefix}${id}&format=json`));
}

/** 住所から引く。いちばん粗いので、最後の手段。 */
async function fromAddress(q: string): Promise<Lookup> {
  return firstHit(
    await getJson(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=jp&format=json&limit=1`,
    ),
  );
}

/** すでに登録されている場所。名前の一致と、近さの両方で見る。 */
async function existingNearby(name: string, lat: number | null, lng: number | null) {
  await ensureDatabaseReady();
  const sameName = await query<{ id: number; name: string }>("SELECT id, name FROM places WHERE name = $1", [
    name,
  ]);
  if (lat === null || lng === null) return { sameName, near: [] as { id: number; name: string; d: number }[] };

  const near = await query<{ id: number; name: string; d: number }>(
    `SELECT id, name,
            round(sqrt(power((lat - $1) * 111000, 2)
                     + power((lng - $2) * 111000 * cos(radians($1)), 2)))::int AS d
       FROM places
      WHERE lat BETWEEN $1 - 0.005 AND $1 + 0.005
        AND lng BETWEEN $2 - 0.006 AND $2 + 0.006
      ORDER BY d LIMIT 5`,
    [lat, lng],
  );
  return { sameName, near: near.filter((p) => p.d <= 120 && p.name !== name) };
}

export async function checkPlace(p: PlaceInput): Promise<PlaceReport> {
  const findings: Finding[] = [];
  const declared = typeof p.lat === "number" && typeof p.lng === "number" ? { lat: p.lat, lng: p.lng } : null;

  if (p.is_private_property) {
    findings.push({ level: "error", what: "私有地・個人宅として申告されています。取り込みません" });
  }

  /* ---- 相手の座標そのものの点検（外に出られなくてもできる） ---- */

  if (declared) {
    if (!inJapan(declared.lat, declared.lng)) {
      const swapped = inJapan(declared.lng, declared.lat);
      findings.push({
        level: "error",
        what: "座標が日本の範囲外です",
        detail: swapped
          ? `緯度と経度が入れ替わっている可能性があります（${declared.lng}, ${declared.lat} なら範囲内）`
          : `${declared.lat}, ${declared.lng}`,
      });
    }
    // 小数第3位までしかない座標は、だいたい「丸めた推測」
    const digits = Math.max(
      (String(declared.lat).split(".")[1] ?? "").length,
      (String(declared.lng).split(".")[1] ?? "").length,
    );
    if (digits <= 3) {
      findings.push({
        level: "warn",
        what: "座標の桁が粗すぎます",
        detail: `小数第${digits}位まで。約100m以上の誤差になります`,
      });
    }
  }

  if (!p.wikidata && !p.osm && !p.address) {
    findings.push({
      level: "error",
      what: "位置の根拠がありません",
      detail: "wikidata / osm / address のうち、少なくともひとつを入れてください",
    });
  }

  /* ---- こちらで座標を引き直す ---- */

  let resolved: { lat: number; lng: number } | null = null;
  let source: PlaceReport["source"] = "none";
  let unreachable = false;

  if (p.wikidata) {
    const r = await fromWikidata(p.wikidata);
    resolved = r.coords;
    unreachable ||= r.unreachable;
    if (resolved) source = "wikidata";
    else if (!r.unreachable) {
      findings.push({
        level: "warn",
        what: `Wikidata ${p.wikidata} に座標（P625）がありません`,
        detail: "項目の取り違えかもしれません。IDを確かめてください",
      });
    }
  }
  if (!resolved && p.osm) {
    const r = await fromOsm(p.osm);
    resolved = r.coords;
    unreachable ||= r.unreachable;
    if (resolved) source = "osm";
    else if (!r.unreachable) {
      findings.push({ level: "warn", what: `OpenStreetMap ${p.osm} が見つかりません` });
    }
  }
  if (!resolved && p.address) {
    const r = await fromAddress(`${p.prefecture}${p.address}`);
    resolved = r.coords;
    unreachable ||= r.unreachable;
    if (resolved) source = "nominatim";
  }

  /* ---- 引けた座標と、書いてきた座標を突き合わせる ---- */

  let lat: number | null = null;
  let lng: number | null = null;

  if (resolved && declared) {
    const d = dist(resolved.lat, resolved.lng, declared.lat, declared.lng);
    const tol = TOLERANCE_M[p.precision] ?? 150;
    if (d > tol) {
      findings.push({
        level: "error",
        what: "書かれた座標と、引き直した座標が食い違います",
        detail: `${d}m離れています（${p.precision} の許容 ${tol}m）／引き直し: ${resolved.lat}, ${resolved.lng}`,
      });
    } else if (d > tol / 3) {
      findings.push({ level: "info", what: `座標のずれ ${d}m（許容内）` });
    }
    // 引き直したほうを採る。IDから引いた座標のほうが信用できる
    lat = resolved.lat;
    lng = resolved.lng;
  } else if (resolved) {
    lat = resolved.lat;
    lng = resolved.lng;
    findings.push({ level: "info", what: `座標は ${source} から補いました` });
  } else if (declared) {
    lat = declared.lat;
    lng = declared.lng;
    source = "declared";
    findings.push({
      level: "warn",
      what: "座標を照合できませんでした。書かれた座標をそのまま使います",
      detail: unreachable
        ? "外部（Wikidata・OpenStreetMap）に接続できません。つながる環境で流し直すことを勧めます"
        : "照合の手がかりから座標を引けませんでした。目視で確かめてください",
    });
  } else if (unreachable) {
    findings.push({
      level: "error",
      what: "座標を決められませんでした（照合先に接続できません）",
      detail:
        "データの不備ではありません。外部につながる環境で流し直すか、" +
        "lat / lng を入れてもらってください",
    });
  } else {
    findings.push({
      level: "error",
      what: "座標が決まりません",
      detail: "wikidata / osm / address のどれからも引けず、lat / lng もありません",
    });
  }

  if (p.precision === "area" && !p.precision_note) {
    findings.push({
      level: "warn",
      what: "広がりのある場所ですが、代表点の説明がありません",
      detail: "precision_note に「◯◯の中央」などを書いてください",
    });
  }

  if (p.sources.length === 0) {
    findings.push({ level: "warn", what: "出典がありません" });
  }

  /* ---- すでにあるものとぶつからないか ---- */

  const { sameName, near } = await existingNearby(p.name, lat, lng);
  if (sameName.length > 0) {
    findings.push({
      level: "info",
      what: `同じ名前の項目がすでにあります（#${sameName[0].id}）`,
      detail: "既存の記事は上書きされません。シーンだけが足されます",
    });
  }
  for (const n of near) {
    findings.push({
      level: "warn",
      what: `${n.d}m先に「${n.name}」（#${n.id}）があります`,
      detail: "同じ場所なら、name をそちらに合わせると項目が分かれずに済みます",
    });
  }

  return { name: p.name, lat, lng, source, findings };
}

export type SceneReport = { quote: string; findings: Finding[] };

/** 保護期間が終わっているとみて逐語引用を許す作者。ここに無ければ要約で。 */
const PUBLIC_DOMAIN_AUTHORS = ["夏目漱石", "川端康成", "芥川龍之介", "森鷗外", "森鴎外", "太宰治", "梶井基次郎"];

export function checkScene(s: SceneInput, works: ResearchInput["works"]): SceneReport {
  const findings: Finding[] = [];
  const work = works.find((w) => w.slug === s.work || w.title === s.work);

  if (!work) {
    findings.push({ level: "error", what: `works に「${s.work}」がありません` });
  } else if (s.kind === "text" && !PUBLIC_DOMAIN_AUTHORS.includes(work.author)) {
    findings.push({
      level: "error",
      what: "逐語引用は保護期間の終わった作品に限ります",
      detail: `${work.author}の作品です。kind を scene にして、自分の言葉で場面を書いてください`,
    });
  }

  if (s.evidence === "official" && s.sources.length === 0) {
    findings.push({
      level: "error",
      what: "「公式」と書くなら出典が要ります",
      detail: "公式サイト・公式の聖地マップなどのURLを sources に入れてください",
    });
  }
  if (s.evidence === "guess" && !s.uncertainty) {
    findings.push({ level: "warn", what: "推測なら、何が不確かかを uncertainty に書いてください" });
  }
  if (s.sources.length === 0 && s.evidence !== "guess") {
    findings.push({ level: "warn", what: "出典がありません" });
  }

  return { quote: s.quote.slice(0, 40), findings };
}

export const worst = (findings: Finding[]): Severity =>
  findings.some((f) => f.level === "error") ? "error" : findings.some((f) => f.level === "warn") ? "warn" : "info";
