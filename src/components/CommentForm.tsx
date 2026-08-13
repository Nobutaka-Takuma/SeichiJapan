"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { addCommentAction, type FormState } from "@/app/actions";

export function CommentForm({
  passageId,
  candidates,
  loggedIn,
}: {
  passageId: number;
  candidates: { id: number; place_name: string }[];
  loggedIn: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCommentAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!loggedIn) {
    return (
      <p className="rounded-md border border-dashed border-rule-2 px-4 py-5 text-center text-sm text-ink-3">
        議論に加わるには{" "}
        <Link href={`/login?next=/passages/${passageId}`} className="font-bold text-shu hover:underline">
          ログイン
        </Link>{" "}
        してください。
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="passage_id" value={passageId} />
      <textarea
        name="body"
        rows={4}
        required
        placeholder="根拠になりそうな資料、現地で確かめたこと、他の説への疑問など。「なぜそう考えるか」を書くと議論が進みます。"
        className="w-full resize-y rounded border border-rule-2 bg-card px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-shu"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-ink-3">
          対象の説（任意）
          <select
            name="identification_id"
            className="ml-2 rounded border border-rule-2 bg-card px-2 py-1.5 text-xs text-ink outline-none focus:border-shu"
          >
            <option value="">この記述ぜんぶ</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.place_name}説
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded bg-shu px-4 py-2 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "投稿中…" : "投稿する"}
        </button>
      </div>
      {state.error && <p className="text-sm text-shu">{state.error}</p>}
    </form>
  );
}
