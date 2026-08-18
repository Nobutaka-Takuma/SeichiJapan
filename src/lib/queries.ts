import { count, one, query } from "./db";
import { ensureDatabaseReady } from "./data";
import { confidenceShares, consensusLevel, evidenceWeight, type ConsensusLevel } from "./confidence";

/** どの入口から来ても、最初にスキーマとデータの用意を済ませておく。 */
const ready = () => ensureDatabaseReady();

export type Medium = "novel" | "anime" | "manga" | "film";

export const MEDIUM_LABEL: Record<Medium, string> = {
  novel: "小説",
  anime: "アニメ",
  manga: "漫画",
  film: "映画",
};

export const EVIDENCE_LABEL: Record<string, string> = {
  guess: "推測",
  research: "調査にもとづく",
  official: "公式・作中に明示",
};

export type Work = {
  id: number;
  slug: string;
  title: string;
  author: string;
  medium: Medium;
  year: number | null;
  description: string;
};

export type WorkSummary = Work & {
  place_count: number;
  passage_count: number;
  contributor_count: number;
};

export type Place = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  prefecture: string;
  address: string;
  note: string; // リード文
  body: string; // 記事本文（共同編集）
  access: string;
  photo_path: string;
  updated_at: string | null;
  updated_by: number | null;
};

const PLACE_COLUMNS = `id, name, lat, lng, prefecture, address, note, body, access, photo_path, updated_at, updated_by`;

export type Candidate = {
  id: number;
  place_id: number;
  place_name: string;
  lat: number;
  lng: number;
  prefecture: string;
  rationale: string;
  evidence: string;
  source_url: string;
  up: number;
  down: number;
  proposer: string;
  proposer_handle: string;
  created_at: string;
  confidence: number;
  my_vote: number;
};

export type PassageWithCandidates = {
  id: number;
  work_id: number;
  chapter: string;
  kind: "text" | "scene";
  quote: string;
  note: string;
  image_path: string;
  image_caption: string;
  image_credit: string;
  created_at: string;
  updated_at: string | null;
  editor_handle: string | null;
  editor_name: string | null;
  revision_count: number;
  author_handle: string;
  author_name: string;
  candidates: Candidate[];
  comment_count: number;
  votes: number;
  consensus: ConsensusLevel;
};

type PassageRow = Omit<PassageWithCandidates, "candidates" | "consensus" | "votes">;

const PASSAGE_COLUMNS = `p.id, p.work_id, p.chapter, p.kind, p.quote, p.note, p.created_at,
       p.image_path, p.image_caption, p.image_credit, p.updated_at,
       (SELECT handle FROM users WHERE id = p.updated_by) AS editor_handle,
       (SELECT display_name FROM users WHERE id = p.updated_by) AS editor_name,
       (SELECT COUNT(*)::int FROM passage_revisions r WHERE r.passage_id = p.id) AS revision_count,
       COALESCE(u.handle, '') AS author_handle,
       COALESCE(u.display_name, '退会したユーザー') AS author_name,
       (SELECT COUNT(*)::int FROM comments c WHERE c.passage_id = p.id) AS comment_count`;

/** 候補に確度を付けて返す。viewerId を渡すとその人の投票状態も含む。 */
async function candidatesFor(passageIds: number[], viewerId?: number): Promise<Map<number, Candidate[]>> {
  const byPassage = new Map<number, Candidate[]>();
  if (passageIds.length === 0) return byPassage;

  const rows = await query<Candidate & { passage_id: number }>(
    `SELECT i.id, i.passage_id, i.place_id, i.rationale, i.evidence, i.source_url, i.created_at,
            pl.name AS place_name, pl.lat, pl.lng, pl.prefecture,
            COALESCE(u.display_name, '不明') AS proposer, COALESCE(u.handle, '') AS proposer_handle,
            COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0)::int AS up,
            COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0)::int AS down,
            COALESCE(MAX(CASE WHEN v.user_id = $1 THEN v.value END), 0)::int AS my_vote
       FROM identifications i
       JOIN places pl ON pl.id = i.place_id
       LEFT JOIN users u ON u.id = i.created_by
       LEFT JOIN votes v ON v.identification_id = i.id
      WHERE i.passage_id = ANY($2::int[])
      GROUP BY i.id, pl.name, pl.lat, pl.lng, pl.prefecture, u.display_name, u.handle
      ORDER BY (COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0)
              - COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0)) DESC, i.created_at ASC`,
    [viewerId ?? -1, passageIds],
  );

  for (const r of rows) {
    const list = byPassage.get(r.passage_id) ?? [];
    list.push({ ...r, confidence: 0 });
    byPassage.set(r.passage_id, list);
  }
  for (const list of byPassage.values()) {
    const shares = confidenceShares(list.map((c) => ({ up: c.up, down: c.down })));
    list.forEach((c, i) => (c.confidence = shares[i]));
    list.sort((a, b) => b.confidence - a.confidence);
  }
  return byPassage;
}

async function attachCandidates(rows: PassageRow[], viewerId?: number): Promise<PassageWithCandidates[]> {
  const map = await candidatesFor(
    rows.map((r) => r.id),
    viewerId,
  );
  return rows.map((r) => {
    const candidates = map.get(r.id) ?? [];
    const votes = evidenceWeight(candidates.map((c) => ({ up: c.up, down: c.down })));
    return {
      ...r,
      candidates,
      votes,
      consensus: consensusLevel(
        candidates.map((c) => c.confidence),
        votes,
      ),
    };
  });
}

const WORK_COUNTS = `
  (SELECT COUNT(DISTINCT i.place_id)::int FROM identifications i
     JOIN passages p ON p.id = i.passage_id WHERE p.work_id = w.id) AS place_count,
  (SELECT COUNT(*)::int FROM passages p WHERE p.work_id = w.id) AS passage_count,
  (SELECT COUNT(DISTINCT uid)::int FROM (
      SELECT p.created_by AS uid FROM passages p WHERE p.work_id = w.id
      UNION
      SELECT i.created_by FROM identifications i JOIN passages p ON p.id = i.passage_id WHERE p.work_id = w.id
      UNION
      SELECT v.user_id FROM votes v
        JOIN identifications i ON i.id = v.identification_id
        JOIN passages p ON p.id = i.passage_id WHERE p.work_id = w.id
      UNION
      SELECT c.user_id FROM comments c JOIN passages p ON p.id = c.passage_id WHERE p.work_id = w.id
  ) t WHERE uid IS NOT NULL) AS contributor_count`;

export async function listWorks(q?: string, medium?: string): Promise<WorkSummary[]> {
  await ready();
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(w.title ILIKE $${params.length} OR w.author ILIKE $${params.length})`);
  }
  if (medium && medium !== "all") {
    params.push(medium);
    where.push(`w.medium = $${params.length}`);
  }
  return query<WorkSummary>(
    `SELECT w.id, w.slug, w.title, w.author, w.medium, w.year, w.description, ${WORK_COUNTS}
       FROM works w
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY place_count DESC, w.title ASC`,
    params,
  );
}

export async function getWork(slug: string): Promise<WorkSummary | undefined> {
  await ready();
  return one<WorkSummary>(
    `SELECT w.id, w.slug, w.title, w.author, w.medium, w.year, w.description, ${WORK_COUNTS}
       FROM works w WHERE w.slug = $1`,
    [slug],
  );
}

export type WorkOption = { id: number; title: string; author: string; medium: Medium; place_count: number };

/** 作品の予測入力用。作品数が増えても効くよう、件数を絞って返す。 */
export async function searchWorks(q: string, limit = 8): Promise<WorkOption[]> {
  await ready();
  const term = q.trim();
  if (!term) {
    return query<WorkOption>(
      `SELECT w.id, w.title, w.author, w.medium,
              (SELECT COUNT(*)::int FROM passages p WHERE p.work_id = w.id) AS place_count
         FROM works w ORDER BY place_count DESC, w.title ASC LIMIT $1`,
      [limit],
    );
  }
  return query<WorkOption>(
    `SELECT w.id, w.title, w.author, w.medium,
            (SELECT COUNT(*)::int FROM passages p WHERE p.work_id = w.id) AS place_count
       FROM works w
      WHERE w.title ILIKE $1 OR w.author ILIKE $1
      ORDER BY CASE WHEN w.title = $2 THEN 0 WHEN w.title ILIKE $3 THEN 1 ELSE 2 END,
               place_count DESC, w.title ASC
      LIMIT $4`,
    [`%${term}%`, term, `${term}%`, limit],
  );
}

export async function getWorkPassages(workId: number, viewerId?: number): Promise<PassageWithCandidates[]> {
  await ready();
  const rows = await query<PassageRow>(
    `SELECT ${PASSAGE_COLUMNS}
       FROM passages p LEFT JOIN users u ON u.id = p.created_by
      WHERE p.work_id = $1
      ORDER BY p.sort_order ASC, p.id ASC`,
    [workId],
  );
  return attachCandidates(rows, viewerId);
}

export async function getPassage(
  id: number,
  viewerId?: number,
): Promise<(PassageWithCandidates & { work: Work }) | undefined> {
  await ready();
  const row = await one<PassageRow>(
    `SELECT ${PASSAGE_COLUMNS}
       FROM passages p LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = $1`,
    [id],
  );
  if (!row) return undefined;
  const work = await one<Work>(
    "SELECT id, slug, title, author, medium, year, description FROM works WHERE id = $1",
    [row.work_id],
  );
  const [withCandidates] = await attachCandidates([row], viewerId);
  return { ...withCandidates, work: work! };
}

export type CommentRow = {
  id: number;
  body: string;
  created_at: string;
  handle: string;
  display_name: string;
  identification_id: number | null;
  place_name: string | null;
};

export async function getComments(passageId: number): Promise<CommentRow[]> {
  await ready();
  return query<CommentRow>(
    `SELECT c.id, c.body, c.created_at, c.identification_id, u.handle, u.display_name, pl.name AS place_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN identifications i ON i.id = c.identification_id
       LEFT JOIN places pl ON pl.id = i.place_id
      WHERE c.passage_id = $1
      ORDER BY c.created_at ASC, c.id ASC`,
    [passageId],
  );
}

export type PlaceDetail = Place & {
  likes: number;
  liked_by_me: boolean;
  editor_handle: string | null;
  editor_name: string | null;
  revision_count: number;
  contributor_count: number;
};

export async function getPlace(id: number, viewerId?: number): Promise<PlaceDetail | undefined> {
  await ready();
  return one<PlaceDetail>(
    `SELECT ${PLACE_COLUMNS.split(", ")
      .map((c) => `pl.${c}`)
      .join(", ")},
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = pl.id) AS likes,
            EXISTS (SELECT 1 FROM place_likes l WHERE l.place_id = pl.id AND l.user_id = $2) AS liked_by_me,
            (SELECT handle FROM users WHERE id = pl.updated_by) AS editor_handle,
            (SELECT display_name FROM users WHERE id = pl.updated_by) AS editor_name,
            (SELECT COUNT(*)::int FROM place_revisions r WHERE r.place_id = pl.id) AS revision_count,
            (SELECT COUNT(DISTINCT r.editor_id)::int FROM place_revisions r WHERE r.place_id = pl.id) AS contributor_count
       FROM places pl WHERE pl.id = $1`,
    [id, viewerId ?? -1],
  );
}

export type Revision = {
  id: number;
  place_id: number;
  editor_id: number | null;
  editor_handle: string | null;
  editor_name: string;
  name: string;
  lat: number;
  lng: number;
  prefecture: string;
  address: string;
  note: string;
  body: string;
  access: string;
  photo_path: string;
  summary: string;
  created_at: string;
};

export async function getRevisions(placeId: number): Promise<Revision[]> {
  await ready();
  return query<Revision>(
    `SELECT r.*, u.handle AS editor_handle, COALESCE(u.display_name, '不明') AS editor_name
       FROM place_revisions r LEFT JOIN users u ON u.id = r.editor_id
      WHERE r.place_id = $1 ORDER BY r.id DESC`,
    [placeId],
  );
}

export type PassageRevision = {
  id: number;
  passage_id: number;
  editor_id: number | null;
  editor_handle: string | null;
  editor_name: string;
  chapter: string;
  kind: string;
  quote: string;
  note: string;
  image_path: string;
  image_caption: string;
  image_credit: string;
  summary: string;
  created_at: string;
};

export async function getPassageRevisions(passageId: number): Promise<PassageRevision[]> {
  await ready();
  return query<PassageRevision>(
    `SELECT r.*, u.handle AS editor_handle, COALESCE(u.display_name, '不明') AS editor_name
       FROM passage_revisions r LEFT JOIN users u ON u.id = r.editor_id
      WHERE r.passage_id = $1 ORDER BY r.id DESC`,
    [passageId],
  );
}

/** 地図上のある点の近くにある登録済みの場所。 */
export async function nearbyPlaces(
  lat: number,
  lng: number,
  limit = 6,
): Promise<(Place & { distance_m: number })[]> {
  await ready();
  // 緯度1度≒111km、経度は緯度に応じて縮む。粗い近似で十分。
  const latScale = 111_000;
  const lngScale = 111_000 * Math.cos((lat * Math.PI) / 180);
  return query<Place & { distance_m: number }>(
    `SELECT ${PLACE_COLUMNS},
            round(sqrt(power((lat - $1) * $3, 2) + power((lng - $2) * $4, 2)))::int AS distance_m
       FROM places
      WHERE lat BETWEEN $1 - 0.09 AND $1 + 0.09
        AND lng BETWEEN $2 - 0.12 AND $2 + 0.12
      ORDER BY distance_m ASC
      LIMIT $5`,
    [lat, lng, latScale, lngScale, limit],
  );
}

export type Appearance = {
  passage_id: number;
  quote: string;
  kind: string;
  chapter: string;
  note: string;
  image_path: string;
  image_caption: string;
  image_credit: string;
  work_slug: string;
  work_title: string;
  work_author: string;
  medium: Medium;
  confidence: number;
  disputed: boolean;
};

/** ある場所が「どの作品のどのシーンに出てくるか」の逆引き。 */
export async function getAppearances(placeId: number): Promise<Appearance[]> {
  await ready();
  const rows = await query<Omit<Appearance, "confidence" | "disputed">>(
    `SELECT i.passage_id, p.quote, p.kind, p.chapter, p.note,
            p.image_path, p.image_caption, p.image_credit,
            w.slug AS work_slug, w.title AS work_title, w.author AS work_author, w.medium
       FROM identifications i
       JOIN passages p ON p.id = i.passage_id
       JOIN works w ON w.id = p.work_id
      WHERE i.place_id = $1
      ORDER BY i.created_at ASC, i.id ASC`,
    [placeId],
  );

  const cands = await candidatesFor(rows.map((r) => r.passage_id));
  return rows
    .map((r) => {
      const list = cands.get(r.passage_id) ?? [];
      return {
        ...r,
        confidence: list.find((c) => c.place_id === placeId)?.confidence ?? 0,
        disputed: list.length > 1,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export async function searchPlaces(q: string, limit = 20): Promise<Place[]> {
  await ready();
  return query<Place>(
    `SELECT ${PLACE_COLUMNS} FROM places
      WHERE name ILIKE $1 OR prefecture ILIKE $1 OR address ILIKE $1
      ORDER BY name LIMIT $2`,
    [`%${q}%`, limit],
  );
}

export type PlaceCard = Place & { work_count: number; scene_count: number; likes: number };

export async function listPlaces(
  limit = 500,
  sort: "likes" | "works" | "name" = "likes",
  q = "",
): Promise<PlaceCard[]> {
  await ready();
  const order =
    sort === "likes"
      ? "likes DESC, work_count DESC, pl.name ASC"
      : sort === "works"
        ? "work_count DESC, likes DESC, pl.name ASC"
        : "pl.name ASC";
  const term = q.trim();
  return query<PlaceCard>(
    `SELECT ${PLACE_COLUMNS.split(", ")
      .map((c) => `pl.${c}`)
      .join(", ")},
            (SELECT COUNT(DISTINCT p.work_id)::int FROM identifications i
               JOIN passages p ON p.id = i.passage_id WHERE i.place_id = pl.id) AS work_count,
            (SELECT COUNT(*)::int FROM identifications i WHERE i.place_id = pl.id) AS scene_count,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = pl.id) AS likes
       FROM places pl
      ${term ? "WHERE pl.name ILIKE $2 OR pl.prefecture ILIKE $2 OR pl.address ILIKE $2 OR pl.note ILIKE $2" : ""}
      ORDER BY ${order}
      LIMIT $1`,
    term ? [limit, `%${term}%`] : [limit],
  );
}

/** その利用者がいいねした場所のIDの集合。 */
export async function likedPlaceIds(userId?: number): Promise<Set<number>> {
  if (!userId) return new Set();
  await ready();
  const rows = await query<{ place_id: number }>("SELECT place_id FROM place_likes WHERE user_id = $1", [
    userId,
  ]);
  return new Set(rows.map((r) => r.place_id));
}

export type Pin = {
  identification_id: number;
  passage_id: number;
  place_id: number;
  place_name: string;
  lat: number;
  lng: number;
  prefecture: string;
  quote: string;
  kind: string;
  chapter: string;
  image_path: string;
  likes: number;
  work_slug: string;
  work_title: string;
  medium: Medium;
  confidence: number;
  rank: number;
  disputed: boolean;
};

/** 地図に落とすピン。各記述の候補すべてを返し、rank=0 が最有力。 */
export async function getPins(
  opts: { workId?: number; medium?: string; prefecture?: string } = {},
): Promise<Pin[]> {
  await ready();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.workId) {
    params.push(opts.workId);
    where.push(`p.work_id = $${params.length}`);
  }
  if (opts.medium && opts.medium !== "all") {
    params.push(opts.medium);
    where.push(`w.medium = $${params.length}`);
  }
  if (opts.prefecture) {
    params.push(opts.prefecture);
    where.push(PREF_MATCH.replace("$PREF$", `$${params.length}`));
  }

  const rows = await query<Omit<Pin, "confidence" | "rank" | "disputed">>(
    `SELECT i.id AS identification_id, i.passage_id, i.place_id, pl.name AS place_name,
            pl.lat, pl.lng, pl.prefecture, p.quote, p.kind, p.chapter, p.image_path,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = pl.id) AS likes,
            w.slug AS work_slug, w.title AS work_title, w.medium
       FROM identifications i
       JOIN places pl ON pl.id = i.place_id
       JOIN passages p ON p.id = i.passage_id
       JOIN works w ON w.id = p.work_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params,
  );

  const cands = await candidatesFor([...new Set(rows.map((r) => r.passage_id))]);
  return rows
    .map((r) => {
      const list = cands.get(r.passage_id) ?? [];
      const idx = list.findIndex((c) => c.id === r.identification_id);
      return {
        ...r,
        confidence: idx >= 0 ? list[idx].confidence : 0,
        rank: idx < 0 ? 99 : idx,
        disputed: list.length > 1,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

export type SiteStats = {
  works: number;
  places: number;
  passages: number;
  users: number;
  votes: number;
  likes: number;
  edits: number;
  photos: number;
};

/**
 * 都道府県の欄をばらすSQL片。
 *
 * 「群馬県／新潟県」のように県をまたぐ場所がある（清水トンネルなど）。
 * どちらの県から見ても出てくるように、数えるときも絞るときもここでばらす。
 */
const PREF_SPLIT = `regexp_split_to_table(pl.prefecture, '[／/・]')`;

/** ある都道府県に属するか（県またぎも拾う）。 */
export const PREF_MATCH = `EXISTS (
  SELECT 1 FROM ${PREF_SPLIT} AS t WHERE trim(t) = $PREF$
)`;

export type PrefectureCount = { prefecture: string; places: number; works: number; likes: number };

/**
 * 都道府県ごとの数。地方 → 都道府県と絞っていく画面の見出しに使う。
 *
 * 0件の県も呼び出し側で並べたいので、ここでは「ある県」だけを返し、
 * 足りない分は表（regions.ts）から補ってもらう。
 */
export async function countsByPrefecture(): Promise<PrefectureCount[]> {
  await ready();
  return query<PrefectureCount>(
    `SELECT trim(pr) AS prefecture,
            COUNT(DISTINCT pl.id)::int AS places,
            COUNT(DISTINCT p.work_id)::int AS works,
            (SELECT COUNT(*)::int FROM place_likes l WHERE l.place_id = ANY(array_agg(DISTINCT pl.id))) AS likes
       FROM places pl
       CROSS JOIN LATERAL ${PREF_SPLIT} AS pr
       LEFT JOIN identifications i ON i.place_id = pl.id
       LEFT JOIN passages p ON p.id = i.passage_id
      WHERE trim(pr) <> ''
      GROUP BY trim(pr)`,
  );
}

export async function siteStats(): Promise<SiteStats> {
  await ready();
  const [works, places, passages, users, votes, likes, edits, photos] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM works"),
    count("SELECT COUNT(*) AS n FROM places"),
    count("SELECT COUNT(*) AS n FROM passages"),
    count("SELECT COUNT(*) AS n FROM users"),
    count("SELECT COUNT(*) AS n FROM votes"),
    count("SELECT COUNT(*) AS n FROM place_likes"),
    count("SELECT COUNT(*) AS n FROM place_revisions"),
    count("SELECT COUNT(*) AS n FROM passages WHERE image_path <> ''"),
  ]);
  return { works, places, passages, users, votes, likes, edits, photos };
}

export type ActivityItem = {
  kind: "scene" | "comment" | "edit";
  created_at: string;
  href: string;
  title: string;
  context: string;
  actor: string;
  actor_handle: string;
};

export async function recentActivity(limit = 12): Promise<ActivityItem[]> {
  await ready();

  const [scenes, comments, edits] = await Promise.all([
    query<{
      created_at: string;
      passage_id: number;
      quote: string;
      place_id: number;
      place_name: string;
      work_title: string;
      actor: string;
      actor_handle: string;
    }>(
      `SELECT i.created_at, p.id AS passage_id, p.quote, pl.id AS place_id, pl.name AS place_name,
              w.title AS work_title,
              COALESCE(u.display_name, '不明') AS actor, COALESCE(u.handle, '') AS actor_handle
         FROM identifications i
         JOIN passages p ON p.id = i.passage_id
         JOIN works w ON w.id = p.work_id
         JOIN places pl ON pl.id = i.place_id
         LEFT JOIN users u ON u.id = i.created_by
        ORDER BY i.created_at DESC, i.id DESC LIMIT $1`,
      [limit],
    ),
    query<{
      created_at: string;
      passage_id: number;
      body: string;
      work_title: string;
      actor: string;
      actor_handle: string;
    }>(
      `SELECT c.created_at, p.id AS passage_id, substr(c.body, 1, 70) AS body, w.title AS work_title,
              u.display_name AS actor, u.handle AS actor_handle
         FROM comments c
         JOIN passages p ON p.id = c.passage_id
         JOIN works w ON w.id = p.work_id
         JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at DESC, c.id DESC LIMIT $1`,
      [limit],
    ),
    query<{
      created_at: string;
      place_id: number;
      summary: string;
      place_name: string;
      actor: string;
      actor_handle: string;
    }>(
      `SELECT r.created_at, r.place_id, r.summary, pl.name AS place_name,
              COALESCE(u.display_name, '不明') AS actor, COALESCE(u.handle, '') AS actor_handle
         FROM place_revisions r
         JOIN places pl ON pl.id = r.place_id
         LEFT JOIN users u ON u.id = r.editor_id
        ORDER BY r.created_at DESC, r.id DESC LIMIT $1`,
      [limit],
    ),
  ]);

  const items: ActivityItem[] = [
    ...scenes.map((s) => ({
      kind: "scene" as const,
      created_at: s.created_at,
      href: `/places/${s.place_id}`,
      title: `${s.place_name} に『${s.work_title}』のシーンを追加`,
      context: s.quote,
      actor: s.actor,
      actor_handle: s.actor_handle,
    })),
    ...comments.map((c) => ({
      kind: "comment" as const,
      created_at: c.created_at,
      href: `/passages/${c.passage_id}`,
      title: c.body,
      context: c.work_title,
      actor: c.actor,
      actor_handle: c.actor_handle,
    })),
    ...edits.map((e) => ({
      kind: "edit" as const,
      created_at: e.created_at,
      href: `/places/${e.place_id}`,
      title: `${e.place_name} の記事を編集`,
      context: e.summary || "編集要約なし",
      actor: e.actor,
      actor_handle: e.actor_handle,
    })),
  ];

  return items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

/** 議論が割れている記述（確度が拮抗しているもの）を拾う。 */
export async function contestedPassages(
  limit = 6,
): Promise<(PassageWithCandidates & { work_title: string; work_slug: string })[]> {
  await ready();
  const rows = await query<PassageRow & { work_title: string; work_slug: string }>(
    `SELECT ${PASSAGE_COLUMNS}, w.title AS work_title, w.slug AS work_slug
       FROM passages p
       JOIN works w ON w.id = p.work_id
       LEFT JOIN users u ON u.id = p.created_by
      WHERE (SELECT COUNT(*) FROM identifications i WHERE i.passage_id = p.id) > 1`,
  );

  const attached = await attachCandidates(rows);
  return attached
    .map((p, i) => ({ ...p, work_title: rows[i].work_title, work_slug: rows[i].work_slug }))
    .sort((a, b) => (a.candidates[0]?.confidence ?? 1) - (b.candidates[0]?.confidence ?? 1))
    .slice(0, limit);
}

export type UserProfile = {
  id: number;
  handle: string;
  display_name: string;
  bio: string;
  created_at: string;
  is_anon: boolean;
};

export async function getUserByHandle(handle: string): Promise<UserProfile | undefined> {
  await ready();
  return one<UserProfile>(
    `SELECT id, handle, display_name, bio, created_at, COALESCE(is_anon, false) AS is_anon
       FROM users WHERE handle = $1`,
    [handle],
  );
}

export async function getUserContributions(userId: number) {
  await ready();
  const [idents, comments, edits, votes, likes] = await Promise.all([
    query<{
      id: number;
      created_at: string;
      rationale: string;
      place_name: string;
      passage_id: number;
      quote: string;
      work_title: string;
      work_slug: string;
    }>(
      `SELECT i.id, i.created_at, i.rationale, pl.name AS place_name, p.id AS passage_id, p.quote,
              w.title AS work_title, w.slug AS work_slug
         FROM identifications i
         JOIN places pl ON pl.id = i.place_id
         JOIN passages p ON p.id = i.passage_id
         JOIN works w ON w.id = p.work_id
        WHERE i.created_by = $1 ORDER BY i.created_at DESC LIMIT 50`,
      [userId],
    ),
    query<{ id: number; body: string; created_at: string; passage_id: number; quote: string; work_title: string }>(
      `SELECT c.id, c.body, c.created_at, p.id AS passage_id, p.quote, w.title AS work_title
         FROM comments c
         JOIN passages p ON p.id = c.passage_id
         JOIN works w ON w.id = p.work_id
        WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 50`,
      [userId],
    ),
    query<{ id: number; created_at: string; summary: string; place_id: number; place_name: string }>(
      `SELECT r.id, r.created_at, r.summary, r.place_id, pl.name AS place_name
         FROM place_revisions r JOIN places pl ON pl.id = r.place_id
        WHERE r.editor_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [userId],
    ),
    count("SELECT COUNT(*) AS n FROM votes WHERE user_id = $1", [userId]),
    count("SELECT COUNT(*) AS n FROM place_likes WHERE user_id = $1", [userId]),
  ]);

  return { idents, comments, edits, votes, likes };
}
