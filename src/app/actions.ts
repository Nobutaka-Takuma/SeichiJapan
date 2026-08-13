"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, query, tx, type Executor } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/data";
import { currentUser, login, logout, register } from "@/lib/auth";
import { UploadError, saveImage } from "@/lib/uploads";

export type FormState = { error?: string; ok?: string };

function fail(e: unknown): FormState {
  return { error: e instanceof Error ? e.message : "エラーが発生しました" };
}

/**
 * フォームの値を取り出す。
 * textarea の改行はブラウザが CRLF で送ってくる（HTML仕様）ので LF に正規化する。
 * これをしないと、改行だけが違う同じ本文が差分で「全行が変更」に見えてしまう。
 */
const str = (fd: FormData, key: string) =>
  String(fd.get(key) ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

/**
 * ログイン後の戻り先。外部サイトへの誘導を防ぐため相対パスだけを許し、
 * 日本語を含むパスはヘッダに載せられるよう符号化する。
 */
function safeNext(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return encodeURI(value);
}

/* ---------- 認証 ---------- */

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await register(str(fd, "handle").toLowerCase(), str(fd, "display_name"), String(fd.get("password") ?? ""));
  } catch (e) {
    return fail(e);
  }
  redirect(safeNext(str(fd, "next")));
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await login(str(fd, "handle").toLowerCase(), String(fd.get("password") ?? ""));
  } catch (e) {
    return fail(e);
  }
  redirect(safeNext(str(fd, "next")));
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

/* ---------- 場所への「いいね」 ---------- */

export async function toggleLikeAction(placeId: number): Promise<FormState & { liked?: boolean }> {
  const user = await currentUser();
  if (!user) return { error: "いいねするにはログインが必要です" };

  const existing = await one("SELECT 1 FROM place_likes WHERE place_id = $1 AND user_id = $2", [
    placeId,
    user.id,
  ]);

  if (existing) {
    await query("DELETE FROM place_likes WHERE place_id = $1 AND user_id = $2", [placeId, user.id]);
  } else {
    await query("INSERT INTO place_likes (place_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      placeId,
      user.id,
    ]);
  }

  revalidatePath(`/places/${placeId}`);
  revalidatePath("/places");
  revalidatePath("/");
  return { ok: "更新しました", liked: !existing };
}

/* ---------- 版の記録 ---------- */

/** 現在の内容を版として記録する。編集のたびに「編集後の状態」を1件積む。 */
const snapshotPlace = (x: Executor, placeId: number, editorId: number | null, summary: string) =>
  x.query(
    `INSERT INTO place_revisions
       (place_id, editor_id, name, lat, lng, prefecture, address, note, body, access, photo_path, summary)
     SELECT id, $1, name, lat, lng, prefecture, address, note, body, access, photo_path, $2
       FROM places WHERE id = $3`,
    [editorId, summary, placeId],
  );

const snapshotPassage = (x: Executor, passageId: number, editorId: number | null, summary: string) =>
  x.query(
    `INSERT INTO passage_revisions
       (passage_id, editor_id, chapter, kind, quote, note, image_path, image_caption, image_credit, summary)
     SELECT id, $1, chapter, kind, quote, note, image_path, image_caption, image_credit, $2
       FROM passages WHERE id = $3`,
    [editorId, summary, passageId],
  );

/* ---------- 場所の記事の共同編集 ---------- */

export async function editPlaceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "編集するにはログインが必要です" };

  const placeId = Number(fd.get("place_id"));
  const current = await one<{ id: number; photo_path: string }>(
    "SELECT id, photo_path FROM places WHERE id = $1",
    [placeId],
  );
  if (!current) return { error: "場所が見つかりません" };

  const name = str(fd, "name");
  if (!name) return { error: "名前を入力してください" };

  const lat = Number(fd.get("lat"));
  const lng = Number(fd.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "緯度・経度が正しくありません" };
  }

  try {
    let photo = current.photo_path;
    if (str(fd, "remove_photo") === "1") photo = "";
    const uploaded = await saveImage(fd.get("photo"));
    if (uploaded) photo = uploaded;

    await tx(async (x) => {
      await x.query(
        `UPDATE places
            SET name = $1, lat = $2, lng = $3, prefecture = $4, address = $5,
                note = $6, body = $7, access = $8, photo_path = $9,
                updated_at = now(), updated_by = $10
          WHERE id = $11`,
        [
          name,
          lat,
          lng,
          str(fd, "prefecture"),
          str(fd, "address"),
          str(fd, "note"),
          str(fd, "body"),
          str(fd, "access"),
          photo,
          user.id,
          placeId,
        ],
      );
      await snapshotPlace(x, placeId, user.id, str(fd, "summary"));
    });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    return fail(e);
  }

  revalidatePath(`/places/${placeId}`);
  revalidatePath("/places");
  revalidatePath("/map");
  redirect(`/places/${placeId}`);
}

/** 過去の版の内容で上書きする。差し戻したこと自体も履歴に残る。 */
export async function revertPlaceAction(revisionId: number): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "差し戻すにはログインが必要です" };

  const rev = await one<{
    id: number;
    place_id: number;
    name: string;
    lat: number;
    lng: number;
    prefecture: string;
    address: string;
    note: string;
    body: string;
    access: string;
    photo_path: string;
  }>("SELECT * FROM place_revisions WHERE id = $1", [revisionId]);
  if (!rev) return { error: "指定された版が見つかりません" };

  try {
    await tx(async (x) => {
      await x.query(
        `UPDATE places
            SET name = $1, lat = $2, lng = $3, prefecture = $4, address = $5,
                note = $6, body = $7, access = $8, photo_path = $9,
                updated_at = now(), updated_by = $10
          WHERE id = $11`,
        [
          rev.name,
          rev.lat,
          rev.lng,
          rev.prefecture,
          rev.address,
          rev.note,
          rev.body,
          rev.access,
          rev.photo_path,
          user.id,
          rev.place_id,
        ],
      );
      await snapshotPlace(x, rev.place_id, user.id, `#${rev.id} の版へ差し戻し`);
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath(`/places/${rev.place_id}`);
  revalidatePath(`/places/${rev.place_id}/history`);
  return { ok: "差し戻しました" };
}

/* ---------- シーンの共同編集 ---------- */

export async function editPassageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "編集するにはログインが必要です" };

  const passageId = Number(fd.get("passage_id"));
  const current = await one<{ id: number; image_path: string }>(
    "SELECT id, image_path FROM passages WHERE id = $1",
    [passageId],
  );
  if (!current) return { error: "シーンが見つかりません" };

  const quote = str(fd, "quote");
  if (quote.length < 5) return { error: "本文または場面の記述を5文字以上で書いてください" };

  try {
    let image = current.image_path;
    if (str(fd, "remove_image") === "1") image = "";
    const uploaded = await saveImage(fd.get("image"));
    if (uploaded) image = uploaded;

    await tx(async (x) => {
      await x.query(
        `UPDATE passages
            SET chapter = $1, kind = $2, quote = $3, note = $4,
                image_path = $5, image_caption = $6, image_credit = $7,
                updated_at = now(), updated_by = $8
          WHERE id = $9`,
        [
          str(fd, "chapter"),
          str(fd, "kind") || "scene",
          quote,
          str(fd, "note"),
          image,
          str(fd, "image_caption"),
          str(fd, "image_credit"),
          user.id,
          passageId,
        ],
      );
      await snapshotPassage(x, passageId, user.id, str(fd, "summary"));
    });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    return fail(e);
  }

  revalidatePath(`/passages/${passageId}`);
  revalidatePath("/map");
  redirect(`/passages/${passageId}`);
}

export async function revertPassageAction(revisionId: number): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "差し戻すにはログインが必要です" };

  const rev = await one<{
    id: number;
    passage_id: number;
    chapter: string;
    kind: string;
    quote: string;
    note: string;
    image_path: string;
    image_caption: string;
    image_credit: string;
  }>("SELECT * FROM passage_revisions WHERE id = $1", [revisionId]);
  if (!rev) return { error: "指定された版が見つかりません" };

  try {
    await tx(async (x) => {
      await x.query(
        `UPDATE passages
            SET chapter = $1, kind = $2, quote = $3, note = $4,
                image_path = $5, image_caption = $6, image_credit = $7,
                updated_at = now(), updated_by = $8
          WHERE id = $9`,
        [
          rev.chapter,
          rev.kind,
          rev.quote,
          rev.note,
          rev.image_path,
          rev.image_caption,
          rev.image_credit,
          user.id,
          rev.passage_id,
        ],
      );
      await snapshotPassage(x, rev.passage_id, user.id, `#${rev.id} の版へ差し戻し`);
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath(`/passages/${rev.passage_id}`);
  revalidatePath(`/passages/${rev.passage_id}/history`);
  return { ok: "差し戻しました" };
}

/* ---------- 地図・場所からのシーン投稿 ---------- */

function makeSlugBase(input: string, title: string): string {
  return (
    input.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ||
    title.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ||
    "work"
  );
}

async function uniqueSlug(x: Executor, base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while ((await x.query("SELECT 1 FROM works WHERE slug = $1", [slug])).length > 0) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/**
 * フォームで選ばれた作品を返す。一覧になければ、その場で作品を作る。
 * 作品数が増えるほど「先に作品を登録してから出直す」導線は負担になるため。
 */
async function resolveWork(
  x: Executor,
  fd: FormData,
  userId: number,
): Promise<{ id: number; slug: string } | { error: string }> {
  const workId = Number(fd.get("work_id")) || 0;
  if (workId) {
    const rows = await x.query<{ id: number; slug: string }>("SELECT id, slug FROM works WHERE id = $1", [
      workId,
    ]);
    return rows[0] ?? { error: "選ばれた作品が見つかりません" };
  }

  const title = str(fd, "new_work_title");
  if (!title) return { error: "作品を選ぶか、新しい作品名を入力してください" };
  const author = str(fd, "new_work_author");
  if (!author) return { error: "新しい作品を登録するには、作者・制作も入力してください" };

  const existing = await x.query<{ id: number; slug: string }>(
    "SELECT id, slug FROM works WHERE title = $1 AND author = $2",
    [title, author],
  );
  if (existing[0]) return existing[0];

  const slug = await uniqueSlug(x, makeSlugBase("", title));
  const rows = await x.query<{ id: number; slug: string }>(
    "INSERT INTO works (slug, title, author, medium, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, slug",
    [slug, title, author, str(fd, "new_work_medium") || "anime", userId],
  );
  return rows[0];
}

/**
 * 「ここは○○のあのシーンの場所」を一度に登録する。
 * 場所（新規なら作成）・シーン・場所との結びつけをまとめて作る。
 */
export async function addSceneAction(_prev: FormState, fd: FormData): Promise<FormState & { placeId?: number }> {
  const user = await currentUser();
  if (!user) return { error: "投稿するにはログインが必要です" };
  await ensureDatabaseReady();

  const quote = str(fd, "quote");
  if (quote.length < 5) return { error: "シーンの説明を5文字以上で書いてください" };

  let image: string | null = null;
  try {
    image = await saveImage(fd.get("image"));
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    return fail(e);
  }

  let placeId = Number(fd.get("place_id")) || 0;
  let workSlug = "";
  let problem: string | null = null;

  try {
    await tx(async (x) => {
      const resolved = await resolveWork(x, fd, user.id);
      if ("error" in resolved) {
        problem = resolved.error;
        throw new Error(resolved.error);
      }
      workSlug = resolved.slug;

      if (!placeId) {
        const name = str(fd, "place_name");
        const lat = Number(fd.get("lat"));
        const lng = Number(fd.get("lng"));
        if (!name) {
          problem = "場所の名前を入力してください";
          throw new Error(problem);
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          problem = "地図をクリックして場所を指定してください";
          throw new Error(problem);
        }
        const rows = await x.query<{ id: number }>(
          `INSERT INTO places (name, lat, lng, prefecture, address, note, created_by, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $7) RETURNING id`,
          [name, lat, lng, str(fd, "prefecture"), str(fd, "address"), str(fd, "place_note"), user.id],
        );
        placeId = rows[0].id;
        await snapshotPlace(x, placeId, user.id, "新規作成");
      }

      const order = Number(
        (
          await x.query<{ n: number }>(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM passages WHERE work_id = $1",
            [resolved.id],
          )
        )[0].n,
      );

      const passage = await x.query<{ id: number }>(
        `INSERT INTO passages
           (work_id, chapter, kind, quote, note, sort_order, created_by, image_path, image_caption, image_credit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          resolved.id,
          str(fd, "chapter"),
          str(fd, "kind") || "scene",
          quote,
          str(fd, "note"),
          order,
          user.id,
          image ?? "",
          str(fd, "image_caption"),
          str(fd, "image_credit"),
        ],
      );
      const passageId = passage[0].id;
      await snapshotPassage(x, passageId, user.id, "新規作成");

      const ident = await x.query<{ id: number }>(
        `INSERT INTO identifications (passage_id, place_id, rationale, evidence, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [passageId, placeId, str(fd, "rationale"), str(fd, "evidence") || "research", user.id],
      );
      await x.query(
        "INSERT INTO votes (identification_id, user_id, value) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
        [ident[0].id, user.id],
      );
    });
  } catch (e) {
    if (problem) return { error: problem };
    return fail(e);
  }

  revalidatePath(`/places/${placeId}`);
  revalidatePath(`/works/${workSlug}`);
  revalidatePath("/map");
  revalidatePath("/");
  return { ok: "登録しました", placeId };
}

/* ---------- 投票 ---------- */

export async function voteAction(identificationId: number, value: 1 | -1): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "投票するにはログインが必要です" };

  const row = await one<{ value: number }>(
    "SELECT value FROM votes WHERE identification_id = $1 AND user_id = $2",
    [identificationId, user.id],
  );

  if (row?.value === value) {
    // 同じボタンをもう一度押したら取り消し
    await query("DELETE FROM votes WHERE identification_id = $1 AND user_id = $2", [
      identificationId,
      user.id,
    ]);
  } else {
    await query(
      `INSERT INTO votes (identification_id, user_id, value) VALUES ($1, $2, $3)
       ON CONFLICT (identification_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
      [identificationId, user.id, value],
    );
  }

  const p = await one<{ id: number; slug: string }>(
    `SELECT p.id, w.slug FROM identifications i
       JOIN passages p ON p.id = i.passage_id
       JOIN works w ON w.id = p.work_id WHERE i.id = $1`,
    [identificationId],
  );
  if (p) {
    revalidatePath(`/passages/${p.id}`);
    revalidatePath(`/works/${p.slug}`);
  }
  revalidatePath("/map");
  return { ok: "投票しました" };
}

/* ---------- 比定案の投稿（異説） ---------- */

export async function addIdentificationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "投稿するにはログインが必要です" };

  const passageId = Number(fd.get("passage_id"));
  if (!Number.isInteger(passageId)) return { error: "記述が指定されていません" };

  const rationale = str(fd, "rationale");
  if (rationale.length < 10) return { error: "根拠は10文字以上で書いてください（なぜそこだと考えたか）" };

  let placeId = Number(fd.get("place_id")) || 0;
  let problem: string | null = null;

  try {
    await tx(async (x) => {
      if (!placeId) {
        const name = str(fd, "place_name");
        const lat = Number(fd.get("lat"));
        const lng = Number(fd.get("lng"));
        if (!name) {
          problem = "場所の名前を入力してください";
          throw new Error(problem);
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          problem = "地図をクリックして場所の位置を指定してください";
          throw new Error(problem);
        }
        const rows = await x.query<{ id: number }>(
          `INSERT INTO places (name, lat, lng, prefecture, address, note, created_by, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $7) RETURNING id`,
          [name, lat, lng, str(fd, "prefecture"), str(fd, "address"), str(fd, "place_note"), user.id],
        );
        placeId = rows[0].id;
        await snapshotPlace(x, placeId, user.id, "新規作成");
      }

      const dup = await x.query("SELECT 1 FROM identifications WHERE passage_id = $1 AND place_id = $2", [
        passageId,
        placeId,
      ]);
      if (dup.length > 0) {
        problem = "その場所はすでに候補として挙がっています。議論はコメント欄でどうぞ";
        throw new Error(problem);
      }

      const ident = await x.query<{ id: number }>(
        `INSERT INTO identifications (passage_id, place_id, rationale, evidence, source_url, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [passageId, placeId, rationale, str(fd, "evidence") || "guess", str(fd, "source_url"), user.id],
      );
      await x.query(
        "INSERT INTO votes (identification_id, user_id, value) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
        [ident[0].id, user.id],
      );
    });
  } catch (e) {
    if (problem) return { error: problem };
    return fail(e);
  }

  revalidatePath(`/passages/${passageId}`);
  revalidatePath("/map");
  return { ok: "候補を追加しました" };
}

/* ---------- コメント ---------- */

export async function addCommentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "コメントするにはログインが必要です" };

  const passageId = Number(fd.get("passage_id"));
  const body = str(fd, "body");
  if (!body) return { error: "本文を入力してください" };
  if (body.length > 4000) return { error: "コメントが長すぎます" };

  const identId = Number(fd.get("identification_id")) || null;
  try {
    await query(
      "INSERT INTO comments (passage_id, identification_id, user_id, body) VALUES ($1, $2, $3, $4)",
      [passageId, identId, user.id, body],
    );
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/passages/${passageId}`);
  return { ok: "投稿しました" };
}

/* ---------- 作品の追加 ---------- */

export async function addWorkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "投稿するにはログインが必要です" };
  await ensureDatabaseReady();

  const title = str(fd, "title");
  const author = str(fd, "author");
  if (!title) return { error: "作品名を入力してください" };
  if (!author) return { error: "作者・制作を入力してください" };

  const yearRaw = str(fd, "year");
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isInteger(year) || year < 500 || year > 2200)) {
    return { error: "発表年が正しくありません" };
  }

  let slug: string;
  try {
    slug = await tx(async (x) => {
      const s = await uniqueSlug(x, makeSlugBase(str(fd, "slug"), title));
      await x.query(
        "INSERT INTO works (slug, title, author, medium, year, description, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [s, title, author, str(fd, "medium") || "novel", year, str(fd, "description"), user.id],
      );
      return s;
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath("/works");
  // slug には日本語が入りうる。リダイレクトはヘッダで返るためASCIIに符号化する。
  redirect(`/works/${encodeURIComponent(slug)}`);
}
