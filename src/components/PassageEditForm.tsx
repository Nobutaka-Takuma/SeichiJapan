"use client";

import Link from "next/link";
import { useActionState } from "react";
import { editPassageAction, type FormState } from "@/app/actions";
import { SceneFields } from "./SceneFields";

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2.5 text-sm outline-none focus:border-shu";

export function PassageEditForm({
  passage,
}: {
  passage: {
    id: number;
    kind: string;
    quote: string;
    chapter: string;
    note: string;
    image_path: string;
    image_caption: string;
    image_credit: string;
    image_kind: string;
    citation_detail: string;
    citation_source: string;
  };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(editPassageAction, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="passage_id" value={passage.id} />

      <SceneFields defaults={passage} />

      <label className="block">
        <span className="text-xs font-bold text-ink-2">編集要約</span>
        <input
          name="summary"
          placeholder="何をどう直したか（例：話数を修正、説明を具体的に）"
          className={`${field} mt-1`}
        />
      </label>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

      <div className="flex items-center gap-3 border-t border-rule pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "保存中…" : "変更を保存する"}
        </button>
        <Link
          href={`/passages/${passage.id}`}
          className="rounded border border-rule-2 px-4 py-2.5 text-sm text-ink-2 hover:border-shu hover:text-shu"
        >
          やめる
        </Link>
      </div>
    </form>
  );
}
