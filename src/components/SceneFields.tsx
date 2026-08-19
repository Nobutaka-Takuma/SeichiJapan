"use client";

import { useState } from "react";

export type SceneDefaults = {
  kind?: string;
  quote?: string;
  chapter?: string;
  note?: string;
  image_path?: string;
  image_caption?: string;
  image_credit?: string;
  image_kind?: string;
  citation_detail?: string;
  citation_source?: string;
};

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu";

/** シーンの中身。新規投稿と編集で同じ入力欄を使う。 */
export function SceneFields({
  defaults = {},
  compact = false,
}: {
  defaults?: SceneDefaults;
  compact?: boolean;
}) {
  const [kind, setKind] = useState<"text" | "scene">(defaults.kind === "text" ? "text" : "scene");
  const [imageKind, setImageKind] = useState<"site_photo" | "work_quote">(
    defaults.image_kind === "work_quote" ? "work_quote" : "site_photo",
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  // 章・話数は引用の「どの部分か」を兼ねるので、入力の有無をその場で見る
  const [chapter, setChapter] = useState(defaults.chapter ?? "");
  const chapterHint = chapter.trim().length > 0;

  // いま引用画像が載っているか（載っていれば、差し替え・取り外しの対象になる）
  const quotedImage = Boolean(defaults.image_path) && defaults.image_kind === "work_quote";

  /*
   * 本文引用か、作品からの画像引用。どちらでも出所の明示が要る。
   * すでに引用が載っているあいだも出所の欄を出しておく。
   * 種別を「現地の写真」に切り替えただけで欄が消えると、
   * 出所のない引用が画面に残ってしまうため。
   */
  const quoting = kind === "text" || imageKind === "work_quote" || (quotedImage && !removeImage);

  return (
    <>
      <div>
        <span className="text-xs font-bold text-ink-2">記述の種類</span>
        <div className="mt-1.5 flex gap-1">
          {(
            [
              ["scene", "場面の記述"],
              ["text", "本文引用"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                kind === k ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
        {!compact && (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            {kind === "text"
              ? "本文をそのまま載せる形です。引用の範囲を超えないよう短くし、下の欄に掲載箇所と出典を書いてください。保護期間が終わっていない作品は特に慎重に。"
              : "台詞や文章をそのまま写さず、場面を自分の言葉で説明してください。"}
          </p>
        )}
      </div>

      <label className="block">
        <span className="text-xs font-bold text-ink-2">{kind === "text" ? "本文 *" : "シーンの説明 *"}</span>
        <textarea
          name="quote"
          rows={compact ? 3 : 4}
          required
          minLength={5}
          defaultValue={defaults.quote ?? ""}
          placeholder={
            kind === "text"
              ? "彼は駅を出て、坂を下り、海の見える喫茶店に入った。"
              : "瀧と三葉がすれ違い、そして振り返る石段。"
          }
          className={`${field} mt-1 resize-y leading-relaxed`}
        />
      </label>

      <label className="block">
        <span className="text-xs font-bold text-ink-2">章・話数</span>
        <input
          name="chapter"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          placeholder="第3話 / 上・二 / 終盤"
          className={`${field} mt-1`}
        />
        {quoting && (
          <span className="mt-1 block text-[11px] text-ink-3">
            引用のときは、ここが出所の「どの部分か」になります。
          </span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-bold text-ink-2">補足メモ</span>
        <textarea
          name="note"
          rows={2}
          defaultValue={defaults.note ?? ""}
          placeholder="どのカットか、いつの時点か、見分けの手がかりなど"
          className={`${field} mt-1 resize-y leading-relaxed`}
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs font-bold text-ink-2">シーンの画像</span>

        {/*
          差し替えになるのは引用だけ（1シーンに1点までなので）。
          現地写真は足すだけで、すでに載っている写真は消えない。
        */}
        {quotedImage && !removeImage && (
          <div className="flex items-center gap-3">
            {/* 利用者が投稿した画像。サイズが不定なので next/image は使わない */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={defaults.image_path} alt="" className="h-20 w-32 rounded object-cover" />
            <button type="button" onClick={() => setRemoveImage(true)} className="text-xs text-ink-3 hover:text-shu">
              この引用を外す
            </button>
          </div>
        )}
        {quotedImage && removeImage && (
          <p className="text-xs text-ink-3">
            引用を外します。
            <button type="button" onClick={() => setRemoveImage(false)} className="ml-2 font-bold text-shu">
              取り消す
            </button>
          </p>
        )}
        <input type="hidden" name="remove_image" value={quotedImage && removeImage ? "1" : "0"} />

        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="block w-full text-xs text-ink-2 file:mr-3 file:rounded file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink-2"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="h-32 w-full rounded object-cover" />}

        <div>
          <span className="text-[11px] font-bold text-ink-2">この画像は</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {(
              [
                ["site_photo", "現地の写真"],
                ["work_quote", "作品からの引用"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setImageKind(k)}
                aria-pressed={imageKind === k}
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  imageKind === k
                    ? "bg-ink text-paper"
                    : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input type="hidden" name="image_kind" value={imageKind} />
        </div>

        <input
          name="image_caption"
          defaultValue={defaults.image_caption ?? ""}
          placeholder={imageKind === "work_quote" ? "どの場面か（任意）" : "写真の説明（任意）"}
          className={field}
        />

        {imageKind === "site_photo" ? (
          <>
            <input
              name="image_credit"
              defaultValue={defaults.image_credit ?? ""}
              placeholder="撮影者（任意）"
              className={field}
            />
            <p className="text-[11px] leading-relaxed text-ink-3">
              自分で撮影した写真を使ってください。他人の写真を無断で載せないでください。
              <br />
              写真は<b className="text-ink-2">何枚でも足せます</b>。ここで足しても、すでに載っている写真は消えません。
            </p>
          </>
        ) : (
          <p className="rounded border border-dashed border-rule-2 bg-paper-2/40 p-3 text-[11px] leading-relaxed text-ink-3">
            引用は<b className="text-ink-2">1シーンにつき1点まで</b>、必要な範囲で。
            あなた自身の説明（上の「シーンの説明」）を添えたうえで、その裏づけとして載せてください。
            説明のないまま画像だけを置くことはできません。
            出所は下の「引用の出所」に書いてください。権利者から求めがあれば削除します。
          </p>
        )}
      </div>

      {/*
        本文引用でも画像引用でも、出所の欄はひとつだけ出す。
        同じ name の入力を二重に置くと、送信時に片方しか残らない。
      */}
      {quoting && (
        <div className="space-y-2 rounded border border-dashed border-shu/40 bg-shu-soft/30 p-3">
          <p className="text-[11px] font-bold text-ink">引用の出所</p>
          <p className="text-[11px] leading-relaxed text-ink-2">
            作品名と作者は作品の側にあるので、あとは<b>どの部分か</b>だけ書いてください。
            {chapterHint
              ? "上の「章・話数」に書いてあるので、ここは空のままで構いません。"
              : "上の「章・話数」に書いた場合も、ここは空のままで構いません。"}
          </p>
          <input
            name="citation_detail"
            defaultValue={defaults.citation_detail ?? ""}
            placeholder="掲載箇所（例：第3話、上・二、第2巻 p.45）"
            className={field}
          />
          <input
            name="citation_source"
            defaultValue={defaults.citation_source ?? ""}
            placeholder="出典（任意：新潮文庫、◯◯社、△△製作委員会）"
            className={field}
          />
          <p className="text-[11px] leading-relaxed text-ink-3">
            掲載時は「引用」と分かる枠で囲い、分かっている範囲の出所を添えて表示します。
          </p>
        </div>
      )}
    </>
  );
}
