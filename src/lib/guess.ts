import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { ensureDatabaseReady } from "./data";

/**
 * 「この場面はどこ？」— 地図で当てる遊び。
 *
 * 聖地巡礼は、作品の風景と実際の土地を重ねる遊びでもある。
 * それをそのまま遊びの形にしたのがこれ。手がかりを見て地図を指し、
 * どれだけ近いかで点が出る。答え合わせの画面から、
 * その場所の項目・作品・行き方へつながるようにしてある。
 *
 * **手がかりに何を使うか**は、順に選ぶ。
 *
 *   1. 現地の写真   … いちばん面白く、権利の問題も無い（投稿者自身の写真）
 *   2. 場面の記述   … 投稿者が自分の言葉で書いたもの。これも投稿者のもの
 *   3. 本文の引用   … 出所を添えて出す
 *
 * 作品からの引用画像は**手がかりに使わない**。引用は説明の裏づけとして
 * 載せるもので、遊びの題材にすると引用の目的から外れてしまうため。
 */

const ready = () => ensureDatabaseReady();

/** 1組の問題数。 */
export const ROUNDS = 5;

/** 満点。距離が離れるほど下がる。 */
export const MAX_SCORE = 5000;

/**
 * 距離から点を出す。
 *
 * 日本の中で遊ぶので、数十km外すと大きく減る目盛りにしてある。
 * 100m以内はほぼ満点、1kmで4800点台、20kmで2500点台、100kmで200点弱。
 */
export function scoreFor(distanceM: number): number {
  return Math.round(MAX_SCORE * Math.exp(-distanceM / 30_000));
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return Math.round(
    Math.hypot((aLat - bLat) * 111_000, (aLng - bLng) * 111_000 * Math.cos((aLat * Math.PI) / 180)),
  );
}

export type ClueKind = "photo" | "scene" | "text";

export type Clue = {
  /** 問題の通し番号（0始まり）。答えは持たせない。 */
  index: number;
  kind: ClueKind;
  /** 写真のとき。 */
  image?: string;
  /** 記述・引用のとき。場所名は伏せてある。 */
  text?: string;
  /** 作品名。手がかりとして出す（作品が分かっても場所は当てないと分からない）。 */
  work: string;
  medium: string;
  chapter: string;
  /** 引用のときだけ、出所を添える。 */
  citation?: string;
};

export type Answer = {
  placeId: number;
  name: string;
  prefecture: string;
  address: string;
  lat: number;
  lng: number;
  passageId: number;
  workSlug: string;
  workTitle: string;
};

type Row = {
  place_id: number;
  name: string;
  prefecture: string;
  address: string;
  lat: number;
  lng: number;
  photo_path: string;
  passage_id: number;
  quote: string;
  kind: string;
  chapter: string;
  image_path: string;
  image_kind: string;
  citation_detail: string;
  citation_source: string;
  work_slug: string;
  work_title: string;
  work_author: string;
  medium: string;
  /** その場所・その場面に載っている現地写真から、1枚を選んだもの。 */
  photo: string | null;
};

/**
 * 手がかりから場所の名前を伏せる。
 *
 * 記述には「須賀神社の石段」のように場所名がそのまま入っていることが多い。
 * 名前と、その中の2文字以上のまとまりを伏せ字にする。
 */
function mask(text: string, placeName: string): string {
  let out = text;
  const parts = new Set<string>([placeName]);
  // 「須賀神社 男坂」→「須賀神社」「男坂」のように、区切りでもばらす
  for (const p of placeName.split(/[\s　・（）()]+/)) if (p.length >= 2) parts.add(p);
  for (const p of [...parts].sort((a, b) => b.length - a.length)) {
    out = out.split(p).join("◯◯");
  }
  return out;
}

/** 問題に使える場所を、手がかりの作りやすい順に引く。 */
async function candidates(limit: number): Promise<Row[]> {
  await ready();
  return query<Row>(
    `SELECT pl.id AS place_id, pl.name, pl.prefecture, pl.address, pl.lat, pl.lng, pl.photo_path,
            p.id AS passage_id, p.quote, p.kind, p.chapter, p.image_path,
            COALESCE(p.image_kind, 'site_photo') AS image_kind,
            COALESCE(p.citation_detail, '') AS citation_detail,
            COALESCE(p.citation_source, '') AS citation_source,
            w.slug AS work_slug, w.title AS work_title, w.author AS work_author, w.medium,
            pic.path AS photo
       FROM identifications i
       JOIN places pl ON pl.id = i.place_id
       JOIN passages p ON p.id = i.passage_id
       JOIN works w ON w.id = p.work_id
       -- 現地写真は何枚でもあるので、そのつど1枚を選ぶ。
       -- 同じ場所が出ても違う写真になり、写真が増えるほど問題も新しくなる。
       LEFT JOIN LATERAL (
         SELECT ph.path FROM photos ph
          WHERE ph.kind = 'site_photo' AND (ph.place_id = pl.id OR ph.passage_id = p.id)
          ORDER BY random() LIMIT 1
       ) pic ON true
      WHERE length(p.quote) >= 12
      ORDER BY random()
      LIMIT $1`,
    [limit],
  );
}

function toClue(row: Row, index: number): Clue {
  const base = {
    index,
    work: row.work_title,
    medium: row.medium,
    chapter: row.chapter,
  };

  // 現地写真があればそれを使う。載っている写真から選んだ1枚、無ければ代表の1枚。
  const photo =
    row.photo || row.photo_path || (row.image_kind !== "work_quote" ? row.image_path : "") || "";
  if (photo) return { ...base, kind: "photo", image: photo };

  if (row.kind === "text") {
    return {
      ...base,
      kind: "text",
      text: mask(row.quote, row.name),
      citation: [row.work_title, row.work_author, row.citation_detail || row.chapter, row.citation_source]
        .filter((v) => v && v.trim())
        .join("／"),
    };
  }

  return { ...base, kind: "scene", text: mask(row.quote, row.name) };
}

export type Round = { clue: Clue; answer: Answer };

/** 1組ぶんの問題を作る。同じ場所が2度出ないようにする。 */
export async function makeRounds(count = ROUNDS): Promise<Round[]> {
  // 重複を避けたいので多めに引いてから絞る
  const rows = await candidates(count * 4);
  const seen = new Set<number>();
  const rounds: Round[] = [];

  for (const row of rows) {
    if (rounds.length >= count) break;
    if (seen.has(row.place_id)) continue;
    seen.add(row.place_id);
    rounds.push({
      clue: toClue(row, rounds.length),
      answer: {
        placeId: row.place_id,
        name: row.name,
        prefecture: row.prefecture,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        passageId: row.passage_id,
        workSlug: row.work_slug,
        workTitle: row.work_title,
      },
    });
  }
  return rounds;
}

/* ---------- 出題の控え ---------- */

/**
 * 答えは画面に出さず、署名した控えに入れて Cookie で持ち回る。
 *
 * 手がかりと一緒に答えを送ってしまうと、画面の中身を覗くだけで分かってしまう。
 * かといって出題ごとにDBへ書くのは、遊びに対して重い。
 * httpOnly の Cookie に署名付きで載せ、採点はサーバ側で行う。
 */
const SECRET =
  process.env.SEICHI_SECRET ??
  process.env.DATABASE_URL ??
  "seichi-guess-local-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function sealRounds(rounds: Round[]): string {
  const body = Buffer.from(
    JSON.stringify({ n: randomBytes(6).toString("hex"), a: rounds.map((r) => r.answer) }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function openRounds(sealed: string | undefined): Answer[] | null {
  if (!sealed) return null;
  const [body, mac] = sealed.split(".");
  if (!body || !mac) return null;

  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString());
    return Array.isArray(parsed?.a) ? (parsed.a as Answer[]) : null;
  } catch {
    return null;
  }
}
