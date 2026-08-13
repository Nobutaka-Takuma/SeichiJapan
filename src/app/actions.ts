"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
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

  const existing = db
    .prepare("SELECT 1 FROM place_likes WHERE place_id = ? AND user_id = ?")
    .get(placeId, user.id);

  if (existing) {
    db.prepare("DELETE FROM place_likes WHERE place_id = ? AND user_id = ?").run(placeId, user.id);
  } else {
    db.prepare("INSERT OR IGNORE INTO place_likes (place_id, user_id) VALUES (?, ?)").run(placeId, user.id);
  }

  revalidatePath(`/places/${placeId}`);
  revalidatePath("/places");
  revalidatePath("/");
  return { ok: "更新しました", liked: !existing };
}

/* ---------- 場所の記事の共同編集 ---------- */

/** 現在の内容を版として記録する。編集のたびに「編集後の状態」を1件積む。 */
function snapshot(placeId: number, editorId: number | null, summary: string) {
  db.prepare(
    `INSERT INTO place_revisions
       (place_id, editor_id, name, lat, lng, prefecture, address, note, body, access, photo_path, summary)
     SELECT id, @editor, name, lat, lng, prefecture, address, note, body, access, photo_path, @summary
       FROM places WHERE id = @place`,
  ).run({ place: placeId, editor: editorId, summary });
}

export async function editPlaceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "編集するにはログインが必要です" };

  const placeId = Number(fd.get("place_id"));
  const current = db.prepare("SELECT id, photo_path FROM places WHERE id = ?").get(placeId) as
    | { id: number; photo_path: string }
    | undefined;
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

    db.prepare(
      `UPDATE places
          SET name = @name, lat = @lat, lng = @lng, prefecture = @prefecture, address = @address,
              note = @note, body = @body, access = @access, photo_path = @photo,
              updated_at = datetime('now'), updated_by = @user
        WHERE id = @id`,
    ).run({
      id: placeId,
      name,
      lat,
      lng,
      prefecture: str(fd, "prefecture"),
      address: str(fd, "address"),
      note: str(fd, "note"),
      body: str(fd, "body"),
      access: str(fd, "access"),
      photo,
      user: user.id,
    });

    snapshot(placeId, user.id, str(fd, "summary"));
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

  const rev = db.prepare("SELECT * FROM place_revisions WHERE id = ?").get(revisionId) as
    | {
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
      }
    | undefined;
  if (!rev) return { error: "指定された版が見つかりません" };

  try {
    db.prepare(
      `UPDATE places
          SET name = @name, lat = @lat, lng = @lng, prefecture = @prefecture, address = @address,
              note = @note, body = @body, access = @access, photo_path = @photo_path,
              updated_at = datetime('now'), updated_by = @user
        WHERE id = @id`,
    ).run({ ...rev, id: rev.place_id, user: user.id });
    snapshot(rev.place_id, user.id, `#${rev.id} の版へ差し戻し`);
  } catch (e) {
    return fail(e);
  }

  revalidatePath(`/places/${rev.place_id}`);
  revalidatePath(`/places/${rev.place_id}/history`);
  return { ok: "差し戻しました" };
}

/* ---------- シーンの共同編集 ---------- */

function snapshotPassage(passageId: number, editorId: number | null, summary: string) {
  db.prepare(
    `INSERT INTO passage_revisions
       (passage_id, editor_id, chapter, kind, quote, note, image_path, image_caption, image_credit, summary)
     SELECT id, @editor, chapter, kind, quote, note, image_path, image_caption, image_credit, @summary
       FROM passages WHERE id = @passage`,
  ).run({ passage: passageId, editor: editorId, summary });
}

export async function editPassageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "編集するにはログインが必要です" };

  const passageId = Number(fd.get("passage_id"));
  const current = db.prepare("SELECT id, image_path, work_id FROM passages WHERE id = ?").get(passageId) as
    | { id: number; image_path: string; work_id: number }
    | undefined;
  if (!current) return { error: "シーンが見つかりません" };

  const quote = str(fd, "quote");
  if (quote.length < 5) return { error: "本文または場面の記述を5文字以上で書いてください" };

  try {
    let image = current.image_path;
    if (str(fd, "remove_image") === "1") image = "";
    const uploaded = await saveImage(fd.get("image"));
    if (uploaded) image = uploaded;

    db.prepare(
      `UPDATE passages
          SET chapter = @chapter, kind = @kind, quote = @quote, note = @note,
              image_path = @image, image_caption = @caption, image_credit = @credit,
              updated_at = datetime('now'), updated_by = @user
        WHERE id = @id`,
    ).run({
      id: passageId,
      chapter: str(fd, "chapter"),
      kind: str(fd, "kind") || "scene",
      quote,
      note: str(fd, "note"),
      image,
      caption: str(fd, "image_caption"),
      credit: str(fd, "image_credit"),
      user: user.id,
    });

    snapshotPassage(passageId, user.id, str(fd, "summary"));
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

  const rev = db.prepare("SELECT * FROM passage_revisions WHERE id = ?").get(revisionId) as
    | {
        id: number;
        passage_id: number;
        chapter: string;
        kind: string;
        quote: string;
        note: string;
        image_path: string;
        image_caption: string;
        image_credit: string;
      }
    | undefined;
  if (!rev) return { error: "指定された版が見つかりません" };

  try {
    db.prepare(
      `UPDATE passages
          SET chapter = @chapter, kind = @kind, quote = @quote, note = @note,
              image_path = @image_path, image_caption = @image_caption, image_credit = @image_credit,
              updated_at = datetime('now'), updated_by = @user
        WHERE id = @id`,
    ).run({ ...rev, id: rev.passage_id, user: user.id });
    snapshotPassage(rev.passage_id, user.id, `#${rev.id} の版へ差し戻し`);
  } catch (e) {
    return fail(e);
  }

  revalidatePath(`/passages/${rev.passage_id}`);
  revalidatePath(`/passages/${rev.passage_id}/history`);
  return { ok: "差し戻しました" };
}

/* ---------- 地図・場所からのシーン投稿 ---------- */

/**
 * フォームで選ばれた作品を返す。一覧になければ、その場で作品を作る。
 * 作品数が増えるほど「先に作品を登録してから出直す」導線は負担になるため。
 */
function resolveWork(fd: FormData, userId: number): { id: number; slug: string } | { error: string } {
  const workId = Number(fd.get("work_id")) || 0;
  if (workId) {
    const work = db.prepare("SELECT id, slug FROM works WHERE id = ?").get(workId) as
      | { id: number; slug: string }
      | undefined;
    return work ?? { error: "選ばれた作品が見つかりません" };
  }

  const title = str(fd, "new_work_title");
  if (!title) return { error: "作品を選ぶか、新しい作品名を入力してください" };
  const author = str(fd, "new_work_author");
  if (!author) return { error: "新しい作品を登録するには、作者・制作も入力してください" };

  const existing = db.prepare("SELECT id, slug FROM works WHERE title = ? AND author = ?").get(title, author) as
    | { id: number; slug: string }
    | undefined;
  if (existing) return existing;

  const slug = makeSlug("", title);
  db.prepare("INSERT INTO works (slug, title, author, medium, created_by) VALUES (?, ?, ?, ?, ?)").run(
    slug,
    title,
    author,
    str(fd, "new_work_medium") || "anime",
    userId,
  );
  const created = db.prepare("SELECT id, slug FROM works WHERE slug = ?").get(slug) as { id: number; slug: string };
  return created;
}

/**
 * 「ここは○○のあのシーンの場所」を一度に登録する。
 * 場所（新規なら作成）・シーン・場所との結びつけをまとめて作る。
 */
export async function addSceneAction(_prev: FormState, fd: FormData): Promise<FormState & { placeId?: number }> {
  const user = await currentUser();
  if (!user) return { error: "投稿するにはログインが必要です" };

  const quote = str(fd, "quote");
  if (quote.length < 5) return { error: "シーンの説明を5文字以上で書いてください" };

  let placeId = Number(fd.get("place_id")) || 0;
  let workSlug = "";

  try {
    const resolved = resolveWork(fd, user.id);
    if ("error" in resolved) return { error: resolved.error };
    const work = resolved;
    workSlug = work.slug;

    if (!placeId) {
      const name = str(fd, "place_name");
      const lat = Number(fd.get("lat"));
      const lng = Number(fd.get("lng"));
      if (!name) return { error: "場所の名前を入力してください" };
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: "地図をクリックして場所を指定してください" };
      }
      placeId = db
        .prepare(
          `INSERT INTO places (name, lat, lng, prefecture, address, note, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
        )
        .run(name, lat, lng, str(fd, "prefecture"), str(fd, "address"), str(fd, "place_note"), user.id, user.id)
        .lastInsertRowid as number;
      snapshot(placeId, user.id, "新規作成");
    }

    const image = await saveImage(fd.get("image"));

    const order = (
      db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM passages WHERE work_id = ?").get(work.id) as {
        n: number;
      }
    ).n;

    const passageId = db
      .prepare(
        `INSERT INTO passages
           (work_id, chapter, kind, quote, note, sort_order, created_by, image_path, image_caption, image_credit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        work.id,
        str(fd, "chapter"),
        str(fd, "kind") || "scene",
        quote,
        str(fd, "note"),
        order,
        user.id,
        image ?? "",
        str(fd, "image_caption"),
        str(fd, "image_credit"),
      ).lastInsertRowid as number;

    snapshotPassage(passageId, user.id, "新規作成");

    const identId = db
      .prepare(
        `INSERT INTO identifications (passage_id, place_id, rationale, evidence, created_by)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(passageId, placeId, str(fd, "rationale"), str(fd, "evidence") || "research", user.id)
      .lastInsertRowid as number;

    db.prepare("INSERT OR IGNORE INTO votes (identification_id, user_id, value) VALUES (?, ?, 1)").run(
      identId,
      user.id,
    );
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
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

  const row = db
    .prepare("SELECT value FROM votes WHERE identification_id = ? AND user_id = ?")
    .get(identificationId, user.id) as { value: number } | undefined;

  if (row?.value === value) {
    // 同じボタンをもう一度押したら取り消し
    db.prepare("DELETE FROM votes WHERE identification_id = ? AND user_id = ?").run(identificationId, user.id);
  } else {
    db.prepare(
      `INSERT INTO votes (identification_id, user_id, value) VALUES (?, ?, ?)
       ON CONFLICT(identification_id, user_id) DO UPDATE SET value = excluded.value`,
    ).run(identificationId, user.id, value);
  }

  const p = db
    .prepare(
      `SELECT p.id, w.slug FROM identifications i
         JOIN passages p ON p.id = i.passage_id
         JOIN works w ON w.id = p.work_id WHERE i.id = ?`,
    )
    .get(identificationId) as { id: number; slug: string } | undefined;
  if (p) {
    revalidatePath(`/passages/${p.id}`);
    revalidatePath(`/works/${p.slug}`);
  }
  revalidatePath("/map");
  return { ok: "投票しました" };
}

/* ---------- 比定案の投稿 ---------- */

export async function addIdentificationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "投稿するにはログインが必要です" };

  const passageId = Number(fd.get("passage_id"));
  if (!Number.isInteger(passageId)) return { error: "記述が指定されていません" };

  try {
    let placeId = Number(fd.get("place_id")) || 0;

    if (!placeId) {
      const name = str(fd, "place_name");
      const lat = Number(fd.get("lat"));
      const lng = Number(fd.get("lng"));
      if (!name) return { error: "場所の名前を入力してください" };
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        return { error: "地図をクリックして場所の位置を指定してください" };
      }
      placeId = db
        .prepare(
          "INSERT INTO places (name, lat, lng, prefecture, address, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(name, lat, lng, str(fd, "prefecture"), str(fd, "address"), str(fd, "place_note"), user.id)
        .lastInsertRowid as number;
      snapshot(placeId, user.id, "新規作成");
    }

    const rationale = str(fd, "rationale");
    if (rationale.length < 10) return { error: "根拠は10文字以上で書いてください（なぜそこだと考えたか）" };

    const dup = db
      .prepare("SELECT id FROM identifications WHERE passage_id = ? AND place_id = ?")
      .get(passageId, placeId) as { id: number } | undefined;
    if (dup) return { error: "その場所はすでに候補として挙がっています。議論はコメント欄でどうぞ" };

    const evidence = str(fd, "evidence") || "guess";
    const identId = db
      .prepare(
        `INSERT INTO identifications (passage_id, place_id, rationale, evidence, source_url, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(passageId, placeId, rationale, evidence, str(fd, "source_url"), user.id).lastInsertRowid as number;

    // 提案者は自説に1票
    db.prepare("INSERT OR IGNORE INTO votes (identification_id, user_id, value) VALUES (?, ?, 1)").run(
      identId,
      user.id,
    );
  } catch (e) {
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
    db.prepare(
      "INSERT INTO comments (passage_id, identification_id, user_id, body) VALUES (?, ?, ?, ?)",
    ).run(passageId, identId, user.id, body);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/passages/${passageId}`);
  return { ok: "投稿しました" };
}

/* ---------- 作品の追加 ---------- */

function makeSlug(input: string, title: string): string {
  const base =
    input.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ||
    title.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ||
    "work";
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM works WHERE slug = ?").get(slug)) slug = `${base}-${n++}`;
  return slug;
}

export async function addWorkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "投稿するにはログインが必要です" };

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
    slug = makeSlug(str(fd, "slug"), title);
    db.prepare(
      "INSERT INTO works (slug, title, author, medium, year, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(slug, title, author, str(fd, "medium") || "novel", year, str(fd, "description"), user.id);
  } catch (e) {
    return fail(e);
  }

  revalidatePath("/works");
  // slug には日本語が入りうる。リダイレクトはヘッダで返るためASCIIに符号化する。
  redirect(`/works/${encodeURIComponent(slug)}`);
}
