"use client";

import { useActionState, useState } from "react";
import { addPassageAction, type FormState } from "@/app/actions";

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2.5 text-sm outline-none focus:border-shu";

export function NewPassageForm({ workSlug }: { workSlug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addPassageAction, {});
  const [kind, setKind] = useState<"text" | "scene">("text");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="work_slug" value={workSlug} />

      <div>
        <span className="text-xs font-bold text-ink-2">記述の種類</span>
        <div className="mt-1.5 flex gap-1">
          {(
            [
              ["text", "本文引用", "作品の文章をそのまま引用する"],
              ["scene", "場面の記述", "映像作品など、要約で場面を示す"],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              title={hint}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                kind === key ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          {kind === "text"
            ? "著作権の保護期間が終わっている作品以外は、引用の範囲を超えないよう短く。長い引用は避けてください。"
            : "台詞や文章をそのまま写さず、場面を自分の言葉で説明してください。"}
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-bold text-ink-2">{kind === "text" ? "本文 *" : "場面の説明 *"}</span>
        <textarea
          name="quote"
          rows={4}
          required
          minLength={5}
          placeholder={
            kind === "text"
              ? "彼は駅を出て、坂を下り、海の見える喫茶店に入った。"
              : "主人公が転校初日に立ち寄る、坂の途中の踏切。奥に海が見える。"
          }
          className={`${field} mt-1 resize-y font-serif leading-relaxed`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold text-ink-2">章・話数など</span>
          <input name="chapter" placeholder="上 先生と私・二 / 第3話" className={`${field} mt-1`} />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-bold text-ink-2">手がかりのメモ</span>
        <textarea
          name="note"
          rows={3}
          placeholder="本文に固有名詞がない、時代設定、登場人物の移動経路など。比定を考える人がまず読む欄です。"
          className={`${field} mt-1 resize-y leading-relaxed`}
        />
      </label>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "登録中…" : "記述を登録して、候補を募る"}
      </button>
    </form>
  );
}
