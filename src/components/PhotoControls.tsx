"use client";

import { useActionState, useEffect, useState } from "react";
import { addPhotoAction, removePhotoAction, type FormState } from "@/app/actions";

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu";

/**
 * 写真を1枚足す。
 *
 * **誰かの写真を消さなくても足せる**ことが、この画面のいちばん大事なところ。
 * だから「差し替える」ではなく「足す」と書き、いま何枚あっても同じ形で出す。
 */
export function AddPhotoForm({
  placeId,
  passageId,
  compact = false,
}: {
  placeId?: number;
  passageId?: number;
  compact?: boolean;
}) {
  const [state, submit, pending] = useActionState<FormState, FormData>(addPhotoAction, {});
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // 送信後に file 入力を空に戻すため、フォームごと作り直す
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setPreview(null);
      setSeed((s) => s + 1);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex min-h-[44px] items-center justify-center rounded-lg border border-dashed border-rule-2 px-4 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu ${
            compact ? "" : "w-full"
          }`}
        >
          ＋ 写真を追加
        </button>
        {state.ok && <p className="text-xs font-bold text-shu">{state.ok}</p>}
        {!compact && (
          <p className="text-[11px] text-ink-3">
            すでにある写真はそのまま残ります。何枚でも足せます。
          </p>
        )}
      </div>
    );
  }

  return (
    <form key={seed} action={submit} className="space-y-2 rounded-lg border border-rule bg-card p-4">
      {placeId ? <input type="hidden" name="place_id" value={placeId} /> : null}
      {passageId ? <input type="hidden" name="passage_id" value={passageId} /> : null}

      <p className="text-xs font-bold text-ink">写真を追加する</p>
      <input
        type="file"
        name="photo"
        required
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
        className="block w-full text-xs text-ink-2 file:mr-3 file:rounded file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink-2"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="" className="h-40 w-full rounded object-cover" />}

      <input name="caption" maxLength={200} placeholder="ひとこと説明（任意）" className={field} />
      <label className="block">
        <span className="text-[11px] text-ink-3">撮影日（任意）</span>
        <input type="date" name="taken_on" className={`${field} mt-1`} />
      </label>

      <p className="text-[11px] leading-relaxed text-ink-3">
        自分で撮った写真を載せてください。作品の映像・挿絵をそのまま載せることはできません
        （引用として載せる場合は、シーンの編集から出所を添えて1点まで）。
      </p>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-xs text-shu">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-shu px-4 py-2.5 text-xs font-bold text-paper disabled:opacity-60"
        >
          {pending ? "送信中…" : "この写真を載せる"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-rule-2 px-4 py-2.5 text-xs font-bold text-ink-2"
        >
          やめる
        </button>
      </div>
    </form>
  );
}

/**
 * 自分が載せた写真を外す。
 *
 * 他人の写真は外せない（管理者だけが、理由を添えて外せる）。
 * 一度押しただけでは消えないようにしてある。
 */
export function RemoveOwnPhoto({ id }: { id: number }) {
  const [state, submit, pending] = useActionState<FormState, FormData>(removePhotoAction, {});
  const [sure, setSure] = useState(false);

  if (!sure) {
    return (
      <button type="button" onClick={() => setSure(true)} className="text-[11px] text-ink-3 hover:text-shu">
        自分の写真を外す
      </button>
    );
  }

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-[11px] font-bold text-shu disabled:opacity-60">
        {pending ? "外しています…" : "本当に外す"}
      </button>
      <button type="button" onClick={() => setSure(false)} className="text-[11px] text-ink-3">
        やめる
      </button>
      {state.error && <span className="text-[11px] text-shu">{state.error}</span>}
    </form>
  );
}
