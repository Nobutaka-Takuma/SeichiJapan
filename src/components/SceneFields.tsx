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
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

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
              ? "著作権の保護期間が終わっている作品以外は、引用の範囲を超えないよう短く。"
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
          defaultValue={defaults.chapter ?? ""}
          placeholder="第3話 / 上・二 / 終盤"
          className={`${field} mt-1`}
        />
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

        {defaults.image_path && !removeImage && (
          <div className="flex items-center gap-3">
            {/* 利用者が投稿した画像。サイズが不定なので next/image は使わない */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={defaults.image_path} alt="" className="h-20 w-32 rounded object-cover" />
            <button type="button" onClick={() => setRemoveImage(true)} className="text-xs text-ink-3 hover:text-shu">
              この画像を外す
            </button>
          </div>
        )}
        {removeImage && (
          <p className="text-xs text-ink-3">
            画像を外します。
            <button type="button" onClick={() => setRemoveImage(false)} className="ml-2 font-bold text-shu">
              取り消す
            </button>
          </p>
        )}
        <input type="hidden" name="remove_image" value={removeImage ? "1" : "0"} />

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

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="image_caption"
            defaultValue={defaults.image_caption ?? ""}
            placeholder="画像の説明（任意）"
            className={field}
          />
          <input
            name="image_credit"
            defaultValue={defaults.image_credit ?? ""}
            placeholder="撮影者・出典（任意）"
            className={field}
          />
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">
          自分で撮影した現地写真を推奨します。作品の映像・挿絵は権利者のものです。
        </p>
      </div>
    </>
  );
}
