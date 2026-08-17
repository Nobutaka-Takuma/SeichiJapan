"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * 管理者だけに出す削除ボタン。
 *
 * 一度押しただけでは消えない。理由を書いてから、もう一度押す。
 * 削除は取り消せないので、その旨をその場に書いておく。
 */
export function DeleteButton({
  action,
  id,
  what,
  label = "削除",
  /** 取り違え防止に名前の入力を求める場合、その名前 */
  confirmTitle,
  size = "sm",
}: {
  action: Action;
  id: number;
  /** 「◯◯を削除します」の◯◯ */
  what: string;
  label?: string;
  confirmTitle?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState<FormState, FormData>(action, {});

  const pad = size === "sm" ? "px-2.5 py-2 text-xs" : "px-3.5 py-2.5 text-sm";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded border border-rule-2 font-bold text-ink-3 hover:border-shu hover:text-shu ${pad}`}
      >
        {label}
      </button>
    );
  }

  return (
    <form action={submit} className="w-full space-y-2 rounded-lg border border-shu/40 bg-shu-soft/40 p-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs font-bold text-ink">
        {what}を削除します。<span className="font-normal text-ink-2">元には戻せません。</span>
      </p>
      <label className="block">
        <span className="sr-only">削除の理由</span>
        <input
          name="reason"
          required
          minLength={4}
          maxLength={500}
          placeholder="理由（例：宣伝目的の投稿／権利者からの申し立て）"
          className="w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu"
        />
      </label>
      {confirmTitle && (
        <label className="block">
          <span className="block text-[11px] text-ink-2">
            確認のため「{confirmTitle}」と入力してください
          </span>
          <input
            name="confirm_title"
            required
            className="mt-1 w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu"
          />
        </label>
      )}
      {state.error && <p className="text-xs font-bold text-shu">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-shu px-3 py-2 text-xs font-bold text-paper disabled:opacity-60"
        >
          {pending ? "削除中…" : "削除する"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-rule-2 px-3 py-2 text-xs font-bold text-ink-2"
        >
          やめる
        </button>
      </div>
      <p className="text-[11px] text-ink-3">
        削除したことは記録に残ります（誰が・何を・なぜ）。
      </p>
    </form>
  );
}
