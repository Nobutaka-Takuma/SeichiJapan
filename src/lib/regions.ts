/**
 * 地方と都道府県。
 *
 * 全国地図をいきなり出しても、日本のかたちが小さく映るだけで
 * 「どこに何があるか」は分からない。まず地方、次に都道府県と絞ってから
 * 地図を見せるほうが、目的の場所に早く着く。その順番を決めるための表。
 *
 * 区分は一般的な8地方に、中部を「北陸・甲信越」と「東海」に割ったもの。
 * 三重県は近畿に含める流儀もあるが、ここでは東海に置いている。
 */

export type Region = {
  key: string;
  name: string;
  /** 地図で見たときのおおよその位置。並べる順にも使う。 */
  prefectures: string[];
};

export const REGIONS: Region[] = [
  { key: "hokkaido", name: "北海道", prefectures: ["北海道"] },
  {
    key: "tohoku",
    name: "東北",
    prefectures: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  },
  {
    key: "kanto",
    name: "関東",
    prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
  },
  {
    key: "koshinetsu",
    name: "北陸・甲信越",
    prefectures: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県"],
  },
  { key: "tokai", name: "東海", prefectures: ["岐阜県", "静岡県", "愛知県", "三重県"] },
  {
    key: "kinki",
    name: "近畿",
    prefectures: ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  },
  {
    key: "chugoku",
    name: "中国",
    prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
  },
  { key: "shikoku", name: "四国", prefectures: ["徳島県", "香川県", "愛媛県", "高知県"] },
  {
    key: "kyushu",
    name: "九州・沖縄",
    prefectures: [
      "福岡県",
      "佐賀県",
      "長崎県",
      "熊本県",
      "大分県",
      "宮崎県",
      "鹿児島県",
      "沖縄県",
    ],
  },
];

/** 都道府県 → 地方。 */
const REGION_OF = new Map<string, Region>();
for (const r of REGIONS) for (const p of r.prefectures) REGION_OF.set(p, r);

export function regionOf(prefecture: string): Region | undefined {
  return REGION_OF.get(prefecture);
}

export function regionByKey(key: string): Region | undefined {
  return REGIONS.find((r) => r.key === key);
}

export const ALL_PREFECTURES = REGIONS.flatMap((r) => r.prefectures);

/**
 * 地図をその都道府県に合わせるための、おおよその中心と縮尺。
 *
 * 登録された場所が1件も無い県でも地図を出せるようにするための控え。
 * 場所があるときは、そちらの座標に合わせて自動で収める。
 */
export const PREF_VIEW: Record<string, { lat: number; lng: number; zoom: number }> = {
  北海道: { lat: 43.4, lng: 142.6, zoom: 7 },
  青森県: { lat: 40.75, lng: 140.75, zoom: 9 },
  岩手県: { lat: 39.6, lng: 141.3, zoom: 9 },
  宮城県: { lat: 38.4, lng: 140.9, zoom: 9 },
  秋田県: { lat: 39.65, lng: 140.4, zoom: 9 },
  山形県: { lat: 38.4, lng: 140.15, zoom: 9 },
  福島県: { lat: 37.4, lng: 140.3, zoom: 9 },
  茨城県: { lat: 36.3, lng: 140.4, zoom: 9 },
  栃木県: { lat: 36.7, lng: 139.8, zoom: 9 },
  群馬県: { lat: 36.5, lng: 138.95, zoom: 9 },
  埼玉県: { lat: 36.0, lng: 139.3, zoom: 10 },
  千葉県: { lat: 35.4, lng: 140.2, zoom: 9 },
  東京都: { lat: 35.69, lng: 139.65, zoom: 11 },
  神奈川県: { lat: 35.4, lng: 139.4, zoom: 10 },
  新潟県: { lat: 37.6, lng: 139.0, zoom: 8 },
  富山県: { lat: 36.65, lng: 137.25, zoom: 10 },
  石川県: { lat: 36.75, lng: 136.85, zoom: 9 },
  福井県: { lat: 35.85, lng: 136.2, zoom: 9 },
  山梨県: { lat: 35.6, lng: 138.6, zoom: 10 },
  長野県: { lat: 36.2, lng: 138.1, zoom: 8 },
  岐阜県: { lat: 35.8, lng: 137.0, zoom: 9 },
  静岡県: { lat: 34.95, lng: 138.4, zoom: 9 },
  愛知県: { lat: 35.05, lng: 137.1, zoom: 10 },
  三重県: { lat: 34.5, lng: 136.3, zoom: 9 },
  滋賀県: { lat: 35.2, lng: 136.1, zoom: 10 },
  京都府: { lat: 35.25, lng: 135.5, zoom: 9 },
  大阪府: { lat: 34.65, lng: 135.5, zoom: 10 },
  兵庫県: { lat: 35.0, lng: 134.85, zoom: 9 },
  奈良県: { lat: 34.4, lng: 135.9, zoom: 9 },
  和歌山県: { lat: 33.95, lng: 135.5, zoom: 9 },
  鳥取県: { lat: 35.4, lng: 133.9, zoom: 10 },
  島根県: { lat: 35.1, lng: 132.6, zoom: 9 },
  岡山県: { lat: 34.85, lng: 133.8, zoom: 10 },
  広島県: { lat: 34.5, lng: 132.75, zoom: 9 },
  山口県: { lat: 34.2, lng: 131.5, zoom: 9 },
  徳島県: { lat: 33.9, lng: 134.3, zoom: 10 },
  香川県: { lat: 34.25, lng: 134.0, zoom: 10 },
  愛媛県: { lat: 33.7, lng: 132.9, zoom: 9 },
  高知県: { lat: 33.5, lng: 133.5, zoom: 9 },
  福岡県: { lat: 33.55, lng: 130.6, zoom: 10 },
  佐賀県: { lat: 33.3, lng: 130.15, zoom: 10 },
  長崎県: { lat: 33.0, lng: 129.7, zoom: 9 },
  熊本県: { lat: 32.7, lng: 130.8, zoom: 9 },
  大分県: { lat: 33.2, lng: 131.4, zoom: 9 },
  宮崎県: { lat: 32.2, lng: 131.3, zoom: 9 },
  鹿児島県: { lat: 31.6, lng: 130.6, zoom: 8 },
  沖縄県: { lat: 26.5, lng: 127.9, zoom: 9 },
};
