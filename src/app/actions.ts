"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, login, logout, register } from "@/lib/auth";

export type FormState = { error?: string; ok?: string };

function fail(e: unknown): FormState {
  return { error: e instanceof Error ? e.message : "エラーが発生しました" };
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

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

/* ---------- 記述の追加 ---------- */

export async function addPassageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "投稿するにはログインが必要です" };

  const slug = str(fd, "work_slug");
  const work = db.prepare("SELECT id FROM works WHERE slug = ?").get(slug) as { id: number } | undefined;
  if (!work) return { error: "作品が見つかりません" };

  const quote = str(fd, "quote");
  if (quote.length < 5) return { error: "本文または場面の記述を入力してください" };

  let passageId: number;
  try {
    const order = (
      db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM passages WHERE work_id = ?").get(work.id) as {
        n: number;
      }
    ).n;
    passageId = db
      .prepare(
        `INSERT INTO passages (work_id, chapter, kind, quote, note, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(work.id, str(fd, "chapter"), str(fd, "kind") || "scene", quote, str(fd, "note"), order, user.id)
      .lastInsertRowid as number;
  } catch (e) {
    return fail(e);
  }

  revalidatePath(`/works/${slug}`);
  redirect(`/passages/${passageId}`);
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
