"use client";

import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/app/actions";

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2.5 text-sm outline-none focus:border-shu";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    mode === "login" ? loginAction : registerAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />

      <label className="block">
        <span className="text-xs font-bold text-ink-2">ユーザーID</span>
        <input
          name="handle"
          required
          autoComplete="username"
          pattern="[A-Za-z0-9_]{3,20}"
          placeholder="hanzawa_naoki"
          className={`${field} mt-1`}
        />
        <span className="mt-1 block text-[11px] text-ink-3">半角英数字とアンダースコア、3〜20文字</span>
      </label>

      {mode === "register" && (
        <label className="block">
          <span className="text-xs font-bold text-ink-2">
            表示名 <span className="font-normal text-ink-3">（任意・あとで変えられます）</span>
          </span>
          <input name="display_name" placeholder="古地図倶楽部" className={`${field} mt-1`} />
          <span className="mt-1 block text-[11px] text-ink-3">空のままならユーザーIDを表示名にします</span>
        </label>
      )}

      <label className="block">
        <span className="text-xs font-bold text-ink-2">パスワード</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={`${field} mt-1`}
        />
        {mode === "register" && <span className="mt-1 block text-[11px] text-ink-3">8文字以上</span>}
      </label>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-shu px-4 py-2.5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "処理中…" : mode === "login" ? "ログイン" : "登録して参加する"}
      </button>
    </form>
  );
}
