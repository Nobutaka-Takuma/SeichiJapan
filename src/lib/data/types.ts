/** 初期データを記述するための型。データパックはこの形で書く。 */

export type SeedIdent = {
  place: string;
  rationale: string;
  evidence?: "guess" | "research" | "official";
  source_url?: string;
  by: string;
  up: number;
  down?: number;
};

export type SeedPassage = {
  chapter?: string;
  kind?: "text" | "scene";
  quote: string;
  note?: string;
  by: string;
  idents: SeedIdent[];
  comments?: { by: string; body: string; on?: string }[];
};

export type SeedWork = {
  slug: string;
  title: string;
  author: string;
  medium: "novel" | "anime" | "manga" | "film";
  year: number;
  description: string;
  passages: SeedPassage[];
};

export type SeedPlace = {
  lat: number;
  lng: number;
  pref: string;
  address?: string;
  note?: string;
  body?: string;
  access?: string;
  likes?: number;
};

export type SeedContributor = { handle: string; name: string; bio: string };

/** 既存の記事に、あとから節を書き足す指示。 */
export type SeedEdit = {
  place: string;
  by: string;
  summary: string;
  append: string;
  access?: string;
};

/** 巡礼コース。地点は場所の名前で並べる。 */
export type SeedRoute = {
  slug: string;
  title: string;
  description?: string;
  area?: string;
  work?: string;
  by: string;
  stops: string[];
};

/**
 * まとめて投入するデータのひと固まり。
 *
 * 一度適用したパックは data_packs に記録され、二度は流れない。
 * あとから作品を足すときは、新しいパックを1つ増やすだけでよい
 * （既存のDBを作り直す必要はない）。
 */
export type DataPack = {
  id: string;
  description: string;
  contributors?: SeedContributor[];
  places?: Record<string, SeedPlace>;
  works?: SeedWork[];
  edits?: SeedEdit[];
  routes?: SeedRoute[];
};
