"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, query, tx, type Executor } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/data";
import { contributor, contributorId, currentUser, login, logout, register, requireAdmin } from "@/lib/auth";
import { addPhoto, getPhoto, refreshPassageCover, refreshPlaceCover } from "@/lib/photos";
import { UploadError, deleteImage, saveImage } from "@/lib/uploads";
import { asImageKind, checkQuotation } from "@/lib/quote";
import {
  distanceM,
  makeRounds,
  openRounds,
  scoreFor,
  sealRounds,
  type Clue,
} from "@/lib/guess";

/** 出題の控えを入れておく Cookie。答えが入るので httpOnly。 */
const GUESS_COOKIE = "seichi_guess";

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
  if (!user) return { error: "いいねはアカウントに紐づきます。ログインしてください" };

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
  const placeId = Number(fd.get("place_id"));
  const current = await one<{ id: number }>("SELECT id FROM places WHERE id = $1", [placeId]);
  if (!current) return { error: "場所が見つかりません" };

  const name = str(fd, "name");
  if (!name) return { error: "名前を入力してください" };

  const lat = Number(fd.get("lat"));
  const lng = Number(fd.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "緯度・経度が正しくありません" };
  }

  try {
    // 書き手を決めるのは、入力が通ってから。
    // ここで初めて匿名の行ができる（空振りで行だけ増えるのを避ける）
    const user = await contributor();

    // 写真はここでは触らない。項目のページから何枚でも足せる（photos 表）。
    await tx(async (x) => {
      await x.query(
        `UPDATE places
            SET name = $1, lat = $2, lng = $3, prefecture = $4, address = $5,
                note = $6, body = $7, access = $8,
                updated_at = now(), updated_by = $9
          WHERE id = $10`,
        [
          name,
          lat,
          lng,
          str(fd, "prefecture"),
          str(fd, "address"),
          str(fd, "note"),
          str(fd, "body"),
          str(fd, "access"),
          user.id,
          placeId,
        ],
      );
      await snapshotPlace(x, placeId, user.id, str(fd, "summary"));
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath(`/places/${placeId}`);
  revalidatePath("/places");
  revalidatePath("/map");
  redirect(`/places/${placeId}`);
}

/**
 * 過去の版の内容で上書きする。差し戻したこと自体も履歴に残る。
 *
 * 写真は差し戻しの対象にしない。写真は誰かが載せたもので、
 * 消せるのは載せた本人（と管理者）だけ。文章を戻したついでに
 * 他人の写真が消えたり戻ったりしては筋が通らない。
 */
export async function revertPlaceAction(revisionId: number): Promise<FormState> {
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
  }>("SELECT * FROM place_revisions WHERE id = $1", [revisionId]);
  if (!rev) return { error: "指定された版が見つかりません" };

  try {
    const user = await contributor();
    await tx(async (x) => {
      await x.query(
        `UPDATE places
            SET name = $1, lat = $2, lng = $3, prefecture = $4, address = $5,
                note = $6, body = $7, access = $8,
                updated_at = now(), updated_by = $9
          WHERE id = $10`,
        [
          rev.name,
          rev.lat,
          rev.lng,
          rev.prefecture,
          rev.address,
          rev.note,
          rev.body,
          rev.access,
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
  const passageId = Number(fd.get("passage_id"));
  const current = await one<{ id: number }>("SELECT id FROM passages WHERE id = $1", [passageId]);
  if (!current) return { error: "シーンが見つかりません" };

  const quote = str(fd, "quote");
  if (quote.length < 5) return { error: "本文または場面の記述を5文字以上で書いてください" };

  const imageKind = asImageKind(str(fd, "image_kind"));
  const removeQuote = str(fd, "remove_image") === "1";

  /*
   * すでに引用画像が載っているなら、種別の選び直しにかかわらず出所が要る。
   * 「現地の写真」に切り替えただけで出所が消せてしまうと、
   * 出所のない引用が画面に残ってしまうため。
   */
  const hadQuote = await one("SELECT 1 FROM photos WHERE passage_id = $1 AND kind = 'work_quote'", [passageId]);
  const quoteRemains = Boolean(hadQuote) && !removeQuote;

  const problem = checkQuotation({
    kind: str(fd, "kind") || "scene",
    imageKind: imageKind === "work_quote" || quoteRemains ? "work_quote" : "site_photo",
    citationDetail: str(fd, "citation_detail"),
    citationSource: str(fd, "citation_source"),
    chapter: str(fd, "chapter"),
    // 引用に添える「主」の記述。場面の説明と補足メモを合わせて見る
    commentary: `${str(fd, "note")}${str(fd, "kind") === "text" ? "" : quote}`,
  });
  if (problem) return { error: problem };

  try {
    const user = await contributor();
    const uploaded = await saveImage(fd.get("image"));
    const stale: string[] = [];

    await tx(async (x) => {
      /*
       * 引用は1場面に1点まで（必要な範囲にとどめるため）。
       * だから引用だけは「差し替え」で、古いほうは消す。
       * 現地写真は逆に、足すだけ。誰かの写真を押しのけることはしない。
       */
      if (removeQuote || (uploaded && imageKind === "work_quote")) {
        const old = await x.query<{ path: string }>(
          "SELECT path FROM photos WHERE passage_id = $1 AND kind = 'work_quote'",
          [passageId],
        );
        await x.query("DELETE FROM photos WHERE passage_id = $1 AND kind = 'work_quote'", [passageId]);
        stale.push(...old.map((o) => o.path));
      } else if (quoteRemains) {
        /*
         * 差し替えないときは、いま出ている引用の出所だけ書き換える。
         * 説明の欄は、種別が「引用」のときだけこの引用のものとして扱う
         * （「現地の写真」を選んでいるなら、その欄は今から足す写真のもの）。
         */
        await x.query(
          `UPDATE photos
              SET citation_detail = $1, citation_source = $2,
                  caption = COALESCE($3, caption), credit = COALESCE($4, credit)
            WHERE passage_id = $5 AND kind = 'work_quote'`,
          [
            str(fd, "citation_detail"),
            str(fd, "citation_source"),
            imageKind === "work_quote" ? str(fd, "image_caption").slice(0, 200) : null,
            imageKind === "work_quote" ? str(fd, "image_credit").slice(0, 80) : null,
            passageId,
          ],
        );
      }

      if (uploaded) {
        await addPhoto(x, { passageId }, {
          path: uploaded,
          caption: str(fd, "image_caption"),
          credit: str(fd, "image_credit"),
          kind: imageKind,
          citationDetail: str(fd, "citation_detail"),
          citationSource: str(fd, "citation_source"),
          userId: user.id,
        });
      }

      await x.query(
        `UPDATE passages
            SET chapter = $1, kind = $2, quote = $3, note = $4,
                citation_detail = $5, citation_source = $6,
                updated_at = now(), updated_by = $7
          WHERE id = $8`,
        [
          str(fd, "chapter"),
          str(fd, "kind") || "scene",
          quote,
          str(fd, "note"),
          str(fd, "citation_detail"),
          str(fd, "citation_source"),
          user.id,
          passageId,
        ],
      );
      // 代表の1枚（一覧・地図の吹き出しが見ている控え）を引き直す
      await refreshPassageCover(x, passageId);
      await snapshotPassage(x, passageId, user.id, str(fd, "summary"));
    });

    for (const path of stale) await deleteImage(path);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    return fail(e);
  }

  revalidatePath(`/passages/${passageId}`);
  revalidatePath("/map");
  redirect(`/passages/${passageId}`);
}

/** 差し戻しは文章だけ。写真は載せた本人のものなので触らない（場所と同じ扱い）。 */
export async function revertPassageAction(revisionId: number): Promise<FormState> {
  const rev = await one<{
    id: number;
    passage_id: number;
    chapter: string;
    kind: string;
    quote: string;
    note: string;
  }>("SELECT * FROM passage_revisions WHERE id = $1", [revisionId]);
  if (!rev) return { error: "指定された版が見つかりません" };

  try {
    const user = await contributor();
    await tx(async (x) => {
      await x.query(
        `UPDATE passages
            SET chapter = $1, kind = $2, quote = $3, note = $4,
                updated_at = now(), updated_by = $5
          WHERE id = $6`,
        [rev.chapter, rev.kind, rev.quote, rev.note, user.id, rev.passage_id],
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
  // 作者・制作は任意。ドラマや共同制作のように「誰の作品か」を一言で書けないものがあるため
  const author = str(fd, "new_work_author");

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
  await ensureDatabaseReady();

  const quote = str(fd, "quote");
  if (quote.length < 5) return { error: "シーンの説明を5文字以上で書いてください" };

  // 引用として足りないものがあれば、画像を保存する前に断る
  const citationProblem = checkQuotation({
    kind: str(fd, "kind") || "scene",
    imageKind: asImageKind(str(fd, "image_kind")),
    citationDetail: str(fd, "citation_detail"),
    citationSource: str(fd, "citation_source"),
    chapter: str(fd, "chapter"),
    commentary: `${str(fd, "note")}${str(fd, "kind") === "text" ? "" : quote}`,
  });
  if (citationProblem) return { error: citationProblem };

  const user = await contributor();
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
           (work_id, chapter, kind, quote, note, sort_order, created_by,
            citation_detail, citation_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          resolved.id,
          str(fd, "chapter"),
          str(fd, "kind") || "scene",
          quote,
          str(fd, "note"),
          order,
          user.id,
          str(fd, "citation_detail"),
          str(fd, "citation_source"),
        ],
      );
      const passageId = passage[0].id;

      // 画像は photos に入れて、代表の1枚を引き直す。あとから何枚でも足せる。
      if (image) {
        await addPhoto(x, { passageId }, {
          path: image,
          caption: str(fd, "image_caption"),
          credit: str(fd, "image_credit"),
          kind: asImageKind(str(fd, "image_kind")),
          citationDetail: str(fd, "citation_detail"),
          citationSource: str(fd, "citation_source"),
          userId: user.id,
        });
        await refreshPassageCover(x, passageId);
      }
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

/* ---------- 写真（何枚でも足せる） ---------- */

/**
 * 写真を1枚足す。**誰かの写真を消す必要はない。**
 *
 * 撮ってきた写真を載せるのに、先に他人の写真を消さなければならないのでは
 * 手が止まる。足すだけで済むようにしてある。
 * ここから入るのは現地写真だけ（引用はシーンの編集から、1点まで）。
 */
export async function addPhotoAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const placeId = Number(fd.get("place_id")) || 0;
  const passageId = Number(fd.get("passage_id")) || 0;
  if (!placeId && !passageId) return { error: "どこの写真か分かりませんでした" };

  const target = placeId ? { placeId } : { passageId };
  const exists = placeId
    ? await one("SELECT 1 FROM places WHERE id = $1", [placeId])
    : await one("SELECT 1 FROM passages WHERE id = $1", [passageId]);
  if (!exists) return { error: "写真を足す先が見つかりません" };

  const takenOn = str(fd, "taken_on");
  if (takenOn && !/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) return { error: "撮影日は年月日で入力してください" };

  let saved: string | null = null;
  try {
    saved = await saveImage(fd.get("photo"));
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    return fail(e);
  }
  if (!saved) return { error: "写真を選んでください" };
  const path = saved;

  try {
    // 書き手が決まるのは、入力が通ってから
    const user = await contributor();
    await tx(async (x) => {
      await addPhoto(x, target, {
        path,
        caption: str(fd, "caption"),
        takenOn: takenOn || null,
        userId: user.id,
      });
      if (placeId) await refreshPlaceCover(x, placeId);
      else await refreshPassageCover(x, passageId);
    });
  } catch (e) {
    // 行が入らなかったのに実体だけ残ると、誰にも辿れないごみになる
    await deleteImage(path);
    return fail(e);
  }

  if (placeId) {
    revalidatePath(`/places/${placeId}`);
    revalidatePath("/places");
    revalidatePath("/");
  } else {
    revalidatePath(`/passages/${passageId}`);
  }
  revalidatePath("/map");
  return { ok: "写真を載せました" };
}

/**
 * 写真を1枚外す。
 *
 * 消せるのは**自分が載せた写真**だけ。他人の写真を消せるのは管理者に限り、
 * その場合は理由を書いてもらい、記録に残す（削除と同じ扱い）。
 */
export async function removePhotoAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const photo = await getPhoto(Number(fd.get("id")));
    if (!photo) return { error: "その写真はすでにありません" };

    const user = await currentUser();
    const me = await contributorId();
    const mine = me !== null && photo.created_by === me;
    if (!mine && !user?.is_admin) {
      return { error: "自分が載せた写真だけ外せます。問題のある写真は管理者に知らせてください" };
    }

    await tx(async (x) => {
      // 他人の写真を消すとき（管理者）は、理由とともに控えを残す
      if (!mine) {
        await record(x, user!.id, "photo", photo.id, photo.caption || photo.path, deleteReason(fd), photo);
      }
      await x.query("DELETE FROM photos WHERE id = $1", [photo.id]);
      if (photo.place_id) await refreshPlaceCover(x, photo.place_id);
      if (photo.passage_id) await refreshPassageCover(x, photo.passage_id);
    });
    await deleteImage(photo.path);

    if (photo.place_id) {
      revalidatePath(`/places/${photo.place_id}`);
      revalidatePath("/places");
      revalidatePath("/");
    }
    if (photo.passage_id) revalidatePath(`/passages/${photo.passage_id}`);
    revalidatePath("/map");
  } catch (e) {
    return fail(e);
  }
  return { ok: "外しました" };
}

/* ---------- 投票 ---------- */

export async function voteAction(identificationId: number, value: 1 | -1): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: "投票は1人1票なので、ログインしてください" };

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
  const passageId = Number(fd.get("passage_id"));
  if (!Number.isInteger(passageId)) return { error: "記述が指定されていません" };

  const rationale = str(fd, "rationale");
  if (rationale.length < 10) return { error: "根拠は10文字以上で書いてください（なぜそこだと考えたか）" };

  const user = await contributor();
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
  const passageId = Number(fd.get("passage_id"));
  const body = str(fd, "body");
  if (!body) return { error: "本文を入力してください" };
  if (body.length > 4000) return { error: "コメントが長すぎます" };

  const user = await contributor();
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
  await ensureDatabaseReady();

  const title = str(fd, "title");
  const author = str(fd, "author");
  if (!title) return { error: "作品名を入力してください" };

  const yearRaw = str(fd, "year");
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isInteger(year) || year < 500 || year > 2200)) {
    return { error: "発表年が正しくありません" };
  }

  const user = await contributor();
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

/* ---------- 訪問記録（チェックイン） ---------- */

export async function toggleVisitAction(
  placeId: number,
  visitedOn?: string,
): Promise<FormState & { visited?: boolean }> {
  const user = await currentUser();
  if (!user) return { error: "旅の記録はあなたのものです。ログインすると残せます" };

  const existing = await one("SELECT 1 FROM visits WHERE place_id = $1 AND user_id = $2", [placeId, user.id]);

  if (existing) {
    await query("DELETE FROM visits WHERE place_id = $1 AND user_id = $2", [placeId, user.id]);
  } else {
    const day = visitedOn && /^\d{4}-\d{2}-\d{2}$/.test(visitedOn) ? visitedOn : null;
    await query(
      `INSERT INTO visits (place_id, user_id, visited_on) VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE))
       ON CONFLICT DO NOTHING`,
      [placeId, user.id, day],
    );
  }

  revalidatePath(`/places/${placeId}`);
  revalidatePath("/near");
  revalidatePath("/routes");
  return { ok: "記録しました", visited: !existing };
}

/* ---------- 巡礼コース ---------- */

export async function saveRouteAction(_prev: FormState, fd: FormData): Promise<FormState & { slug?: string }> {
  await ensureDatabaseReady();

  const title = str(fd, "title");
  if (!title) return { error: "コース名を入力してください" };

  const stopIds = String(fd.get("stops") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (stopIds.length < 2) return { error: "地点を2つ以上えらんでください" };

  const user = await contributor();
  const editingSlug = str(fd, "slug");
  let slug = editingSlug;

  try {
    slug = await tx(async (x) => {
      let routeId: number;

      if (editingSlug) {
        const existing = await x.query<{ id: number; created_by: number | null }>(
          "SELECT id, created_by FROM routes WHERE slug = $1",
          [editingSlug],
        );
        if (!existing[0]) throw new Error("コースが見つかりません");
        routeId = existing[0].id;
        await x.query(
          `UPDATE routes SET title = $1, description = $2, area = $3, work_id = $4, updated_at = now()
            WHERE id = $5`,
          [title, str(fd, "description"), str(fd, "area"), Number(fd.get("work_id")) || null, routeId],
        );
        await x.query("DELETE FROM route_stops WHERE route_id = $1", [routeId]);
      } else {
        const base = makeSlugBase(str(fd, "slug_hint"), title);
        const s = await (async () => {
          let candidate = base;
          let n = 2;
          while ((await x.query("SELECT 1 FROM routes WHERE slug = $1", [candidate])).length > 0) {
            candidate = `${base}-${n++}`;
          }
          return candidate;
        })();
        const rows = await x.query<{ id: number; slug: string }>(
          `INSERT INTO routes (slug, title, description, area, work_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, slug`,
          [s, title, str(fd, "description"), str(fd, "area"), Number(fd.get("work_id")) || null, user.id],
        );
        routeId = rows[0].id;
      }

      for (const [i, placeId] of stopIds.entries()) {
        await x.query("INSERT INTO route_stops (route_id, position, place_id) VALUES ($1, $2, $3)", [
          routeId,
          i,
          placeId,
        ]);
      }

      const row = await x.query<{ slug: string }>("SELECT slug FROM routes WHERE id = $1", [routeId]);
      return row[0].slug;
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath("/routes");
  revalidatePath(`/routes/${encodeURIComponent(slug)}`);
  return { ok: "保存しました", slug };
}

/* ---------- 管理者による削除 ---------- */

/**
 * 削除は実体を消す。表示から隠すだけにすると、絞り込みを書き忘れた
 * 問い合わせが1本でもあれば漏れてしまい、権利者からの申し立てに応えられない。
 *
 * そのかわり、消したものは `deletions` に丸ごと控える。
 * 取り消しはできないが、誰が・何を・なぜ消したかは必ず残る。
 */

/** 削除しようとしている当人が管理者か、実際に消す直前に必ず確かめる。 */
async function record(
  x: Executor,
  adminId: number,
  kind: string,
  targetId: number,
  label: string,
  reason: string,
  snapshot: unknown,
) {
  await x.query(
    `INSERT INTO deletions (kind, target_id, label, reason, snapshot, admin_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [kind, targetId, label.slice(0, 200), reason, JSON.stringify(snapshot ?? null), adminId],
  );
}

/** 削除に添える理由。何を消したのか後から分かるように、必ず書いてもらう。 */
function deleteReason(fd: FormData): string {
  const reason = str(fd, "reason");
  if (reason.length < 4) throw new Error("削除の理由を書いてください（4文字以上）");
  return reason.slice(0, 500);
}

export async function deletePlaceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const reason = deleteReason(fd);
    const id = Number(fd.get("id"));

    const images = await tx(async (x) => {
      const rows = await x.query<Record<string, unknown> & { name: string; photo_path: string }>(
        "SELECT * FROM places WHERE id = $1",
        [id],
      );
      const place = rows[0];
      if (!place) throw new Error("その場所はすでにありません");

      // 一緒に消えるものも控えておく（この場所に結びついた説・版・いいね・訪問）
      const idents = await x.query("SELECT * FROM identifications WHERE place_id = $1", [id]);
      const revisions = await x.query("SELECT * FROM place_revisions WHERE place_id = $1", [id]);
      const photos = await x.query<{ path: string }>("SELECT * FROM photos WHERE place_id = $1", [id]);

      await record(x, admin.id, "place", id, place.name, reason, { place, idents, revisions, photos });
      // 外部キーの ON DELETE CASCADE が、説・版・写真・いいね・訪問・コースの停留点を連れていく
      await x.query("DELETE FROM places WHERE id = $1", [id]);
      return [place.photo_path, ...photos.map((p) => p.path)].filter(Boolean) as string[];
    });

    for (const path of images) await deleteImage(path);
  } catch (e) {
    return fail(e);
  }

  revalidatePath("/places");
  revalidatePath("/map");
  revalidatePath("/areas");
  redirect("/places");
}

export async function deletePassageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  let back = "/works";
  try {
    const admin = await requireAdmin();
    const reason = deleteReason(fd);
    const id = Number(fd.get("id"));

    const images = await tx(async (x) => {
      const rows = await x.query<Record<string, unknown> & { quote: string; image_path: string }>(
        "SELECT * FROM passages WHERE id = $1",
        [id],
      );
      const passage = rows[0];
      if (!passage) throw new Error("その記述はすでにありません");

      const work = await x.query<{ slug: string; title: string }>(
        "SELECT slug, title FROM works WHERE id = $1",
        [passage.work_id],
      );
      back = work[0] ? `/works/${encodeURIComponent(work[0].slug)}` : "/works";

      const idents = await x.query("SELECT * FROM identifications WHERE passage_id = $1", [id]);
      const comments = await x.query("SELECT * FROM comments WHERE passage_id = $1", [id]);
      const revisions = await x.query("SELECT * FROM passage_revisions WHERE passage_id = $1", [id]);
      const photos = await x.query<{ path: string }>("SELECT * FROM photos WHERE passage_id = $1", [id]);

      const label = `『${work[0]?.title ?? "?"}』${passage.quote.slice(0, 40)}`;
      await record(x, admin.id, "passage", id, label, reason, { passage, idents, comments, revisions, photos });
      await x.query("DELETE FROM passages WHERE id = $1", [id]);
      return [passage.image_path, ...photos.map((p) => p.path)].filter(Boolean) as string[];
    });

    for (const path of images) await deleteImage(path);
  } catch (e) {
    return fail(e);
  }

  revalidatePath("/works");
  revalidatePath("/map");
  redirect(back);
}

export async function deleteIdentificationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  let back = "/works";
  try {
    const admin = await requireAdmin();
    const reason = deleteReason(fd);
    const id = Number(fd.get("id"));

    await tx(async (x) => {
      const rows = await x.query<Record<string, unknown> & { passage_id: number }>(
        "SELECT * FROM identifications WHERE id = $1",
        [id],
      );
      const ident = rows[0];
      if (!ident) throw new Error("その説はすでにありません");
      back = `/passages/${ident.passage_id}`;

      const place = await x.query<{ name: string }>("SELECT name FROM places WHERE id = $1", [ident.place_id]);
      const votes = await x.query("SELECT * FROM votes WHERE identification_id = $1", [id]);

      await record(x, admin.id, "identification", id, `${place[0]?.name ?? "?"} 説`, reason, { ident, votes });
      await x.query("DELETE FROM identifications WHERE id = $1", [id]);
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath(back);
  redirect(back);
}

export async function deleteCommentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  let back = "/works";
  try {
    const admin = await requireAdmin();
    const reason = deleteReason(fd);
    const id = Number(fd.get("id"));

    await tx(async (x) => {
      const rows = await x.query<Record<string, unknown> & { body: string; passage_id: number }>(
        "SELECT * FROM comments WHERE id = $1",
        [id],
      );
      const comment = rows[0];
      if (!comment) throw new Error("そのコメントはすでにありません");
      back = `/passages/${comment.passage_id}`;

      await record(x, admin.id, "comment", id, comment.body.slice(0, 60), reason, comment);
      await x.query("DELETE FROM comments WHERE id = $1", [id]);
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath(back);
  return { ok: "削除しました" };
}

export async function deleteRouteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const reason = deleteReason(fd);
    const id = Number(fd.get("id"));

    await tx(async (x) => {
      const rows = await x.query<Record<string, unknown> & { title: string }>(
        "SELECT * FROM routes WHERE id = $1",
        [id],
      );
      const route = rows[0];
      if (!route) throw new Error("そのコースはすでにありません");
      const stops = await x.query("SELECT * FROM route_stops WHERE route_id = $1 ORDER BY position", [id]);

      await record(x, admin.id, "route", id, route.title, reason, { route, stops });
      await x.query("DELETE FROM routes WHERE id = $1", [id]);
    });
  } catch (e) {
    return fail(e);
  }

  revalidatePath("/routes");
  redirect("/routes");
}

/**
 * 作品ごと消す。記述もすべて連れていくので、いちばん重い操作になる。
 * 取り違えを防ぐため、作品名をそのまま入力してもらう。
 */
export async function deleteWorkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const reason = deleteReason(fd);
    const id = Number(fd.get("id"));
    const typed = str(fd, "confirm_title");

    const images = await tx(async (x) => {
      const rows = await x.query<Record<string, unknown> & { title: string }>(
        "SELECT * FROM works WHERE id = $1",
        [id],
      );
      const work = rows[0];
      if (!work) throw new Error("その作品はすでにありません");
      if (typed !== work.title) throw new Error("確認のため、作品名をそのとおりに入力してください");

      const passages = await x.query<{ image_path: string }>("SELECT * FROM passages WHERE work_id = $1", [id]);
      const photos = await x.query<{ path: string }>(
        "SELECT * FROM photos WHERE passage_id IN (SELECT id FROM passages WHERE work_id = $1)",
        [id],
      );
      await record(x, admin.id, "work", id, work.title, reason, { work, passages, photos });
      await x.query("DELETE FROM works WHERE id = $1", [id]);
      return [...passages.map((p) => p.image_path), ...photos.map((p) => p.path)].filter(Boolean);
    });

    for (const path of images) await deleteImage(path);
  } catch (e) {
    return fail(e);
  }

  revalidatePath("/works");
  revalidatePath("/map");
  redirect("/works");
}

/* ---------- 「この場面はどこ？」 ---------- */

/**
 * 出題する。答えは署名した Cookie に隠し、画面には手がかりだけを返す。
 * 答えを一緒に送ると、画面の中身を覗くだけで分かってしまうため。
 */
export async function startGuessAction(): Promise<{ clues: Clue[]; error?: string }> {
  const rounds = await makeRounds();
  if (rounds.length === 0) {
    return { clues: [], error: "出題できる場所がまだありません。シーンを登録してみてください" };
  }
  (await cookies()).set(GUESS_COOKIE, sealRounds(rounds), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return { clues: rounds.map((r) => r.clue) };
}

export type GuessResult = {
  error?: string;
  distance_m?: number;
  score?: number;
  answer?: {
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
};

/** 採点する。距離の計算も答えの取り出しも、すべてサーバ側で行う。 */
export async function submitGuessAction(index: number, lat: number, lng: number): Promise<GuessResult> {
  const answers = openRounds((await cookies()).get(GUESS_COOKIE)?.value);
  if (!answers) return { error: "出題が見つかりません。もう一度はじめてください" };

  const answer = answers[index];
  if (!answer) return { error: "その問題はありません" };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: "地図の上で場所を指してください" };

  const d = distanceM(answer.lat, answer.lng, lat, lng);
  return { distance_m: d, score: scoreFor(d), answer };
}
