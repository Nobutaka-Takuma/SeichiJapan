"use client";

import { useActionState } from "react";
import { addWorkAction, type FormState } from "@/app/actions";

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2.5 text-sm outline-none focus:border-shu";

export function NewWorkForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addWorkAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold text-ink-2">作品名 *</span>
          <input name="title" required placeholder="こころ" className={`${field} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-ink-2">作者・制作</span>
          <input name="author" placeholder="夏目漱石 / 監督・制作会社など" className={`${field} mt-1`} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-bold text-ink-2">種別</span>
          <select name="medium" defaultValue="novel" className={`${field} mt-1`}>
            <option value="novel">小説</option>
            <option value="anime">アニメ</option>
            <option value="manga">漫画</option>
            <option value="film">映画／ドラマ</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-ink-2">発表年</span>
          <input name="year" type="number" min={500} max={2200} placeholder="1914" className={`${field} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-ink-2">URL用ID（任意）</span>
          <input name="slug" placeholder="kokoro" className={`${field} mt-1`} />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-bold text-ink-2">どんな作品か</span>
        <textarea
          name="description"
          rows={4}
          placeholder="舞台になっている土地や、場所の描写の特徴を書いておくと、比定を出す人の助けになります。"
          className={`${field} mt-1 resize-y leading-relaxed`}
        />
      </label>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "作成中…" : "作品を作成する"}
      </button>
    </form>
  );
}
