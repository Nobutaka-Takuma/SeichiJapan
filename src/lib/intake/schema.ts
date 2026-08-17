import { z } from "zod";

/**
 * 外部（別のAI・調査担当者）から受け取る聖地データの形。
 *
 * 設計の要点はひとつ。**座標を信用しない**こと。
 *
 * 大規模言語モデルは緯度経度を「それらしく」書くが、数百メートル単位で
 * ずれることも、隣の市の座標を出すこともある。だから座標は参考値として
 * しか受け取らず、位置の根拠は **Wikidata / OpenStreetMap のID** と
 * **住所** で受け取る。実際の座標はこちらが引き直し、食い違えば止める。
 */

/** 日本のだいたいの範囲。ここを外れる座標は、まず入力の誤り。 */
export const JAPAN_BOUNDS = { minLat: 20, maxLat: 46, minLng: 122, maxLng: 154 };

const trimmed = z.string().trim();

/**
 * 省略できる文字列。
 *
 * 相手が言語モデルなので、「無い」は `null` で来たり、キーごと無かったり、
 * 空文字で来たりする。三つとも「無い」として同じに扱う。
 * ここで受け止めておかないと、中身は正しいのに形式だけで弾いてしまう。
 */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

/** URLらしきものだけ通す。ここで弾いておくと、あとの検査が楽になる。 */
const httpUrl = trimmed.refine((v) => /^https?:\/\/\S+$/.test(v), {
  message: "http(s) から始まるURLにしてください",
});

/**
 * 位置の細かさ。
 * 「この商店街が聖地」のような広がりのあるものを、点として扱わないための区別。
 */
export const PRECISION = ["point", "site", "area"] as const;
export const PRECISION_LABEL: Record<(typeof PRECISION)[number], string> = {
  point: "一点（建物・鳥居・踏切など）",
  site: "敷地全体（境内・公園など）",
  area: "広がり（商店街・地区など。座標は代表点）",
};

/** 根拠の強さ。確度の初期値ではなく、出典の種類を表す。 */
export const EVIDENCE = ["official", "research", "guess"] as const;

export const placeSchema = z.object({
  /** このサイトでの見出し。既存の項目と同じ名前なら、その項目に足される。 */
  name: trimmed.min(1).max(80),
  /** 正式名称。照合に使う。見出しと同じなら省略可。 */
  official_name: optionalText(120),

  prefecture: trimmed.min(2).max(10),
  /** 市区町村。地域の索引に使うので、できるだけ入れてほしい。 */
  municipality: optionalText(30),
  address: optionalText(160),

  /* ---- 位置の根拠。上ほど強い。分かるものだけでよい ---- */

  /** Wikidata の項目ID（例: Q11529113）。P625 から座標を引く。 */
  wikidata: trimmed
    .regex(/^Q[1-9]\d*$/, "Wikidata の項目IDは Q で始まる番号です")
    .optional()
    .nullable(),
  /** OpenStreetMap の要素（例: way/123456789）。 */
  osm: trimmed
    .regex(/^(node|way|relation)\/[1-9]\d*$/, "node/123 や way/123 の形で書いてください")
    .optional()
    .nullable(),

  /** 参考の座標。**照合にだけ使う。** 分からなければ書かないこと。 */
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),

  precision: z.preprocess((v) => v ?? undefined, z.enum(PRECISION).default("point")),
  /** 座標が何を指しているか（例: 石段の下端）。area のときは特に。 */
  precision_note: optionalText(120),

  /* ---- 記事の中身 ---- */

  /** 一行の説明。一覧や地図の吹き出しに出る。 */
  note: optionalText(200),
  /** 解説の本文。空行で段落、行頭の「■」で小見出し。 */
  body: optionalText(4000),
  /** 行き方と、訪ねるときの注意。 */
  access: optionalText(1200),

  sources: z.preprocess((v) => v ?? undefined, z.array(httpUrl).default([])),
  /** 私有地・個人宅にあたるなら true。取り込みを止める。 */
  is_private_property: z.preprocess((v) => v ?? undefined, z.boolean().default(false)),
});

export const sceneSchema = z.object({
  /** works の slug、または title。 */
  work: trimmed.min(1),
  /** places の name。 */
  place: trimmed.min(1),

  chapter: optionalText(60),
  /**
   * text = 本文の逐語引用（**保護期間の終わった作品に限る**）
   * scene = 場面の記述（自分の言葉での要約）
   */
  kind: z.preprocess((v) => v ?? undefined, z.enum(["text", "scene"]).default("scene")),
  quote: trimmed.min(5).max(600),
  note: optionalText(600),

  /** なぜその場所だと言えるか。ここが薄いと取り込まない。 */
  rationale: trimmed.min(10).max(800),
  evidence: z.preprocess((v) => v ?? undefined, z.enum(EVIDENCE).default("research")),
  sources: z.preprocess((v) => v ?? undefined, z.array(httpUrl).default([])),
  /** 言い切れないことがあれば、ここに書く。空でよい。 */
  uncertainty: optionalText(400),
});

export const workSchema = z.object({
  slug: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().trim().regex(/^[a-z0-9-]+$/, "slug は半角小文字・数字・ハイフンで").max(60).optional(),
  ),
  title: trimmed.min(1).max(120),
  author: trimmed.min(1).max(120),
  medium: z.enum(["novel", "anime", "manga", "film"]),
  year: z.number().int().min(500).max(2200).optional().nullable(),
  description: optionalText(600).default(""),
  wikidata: trimmed.regex(/^Q[1-9]\d*$/).optional().nullable(),
});

export const researchSchema = z.object({
  /** 形式の版。増やしたらここを上げる。 */
  version: z.literal(1),
  /** データパックのID（例: 0004-yamanashi）。省略時はファイル名から作る。 */
  pack_id: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  ),
  description: optionalText(200).default(""),
  works: z.preprocess((v) => v ?? undefined, z.array(workSchema).default([])),
  places: z.preprocess((v) => v ?? undefined, z.array(placeSchema).default([])),
  scenes: z.preprocess((v) => v ?? undefined, z.array(sceneSchema).default([])),
});

export type ResearchInput = z.infer<typeof researchSchema>;
export type PlaceInput = z.infer<typeof placeSchema>;
export type SceneInput = z.infer<typeof sceneSchema>;
export type WorkInput = z.infer<typeof workSchema>;
