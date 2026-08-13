"use client";

import { useState, useTransition } from "react";
import { toggleLikeAction } from "@/app/actions";

export function LikeButton({
  placeId,
  likes,
  liked,
  loggedIn,
  size = "md",
}: {
  placeId: number;
  likes: number;
  liked: boolean;
  loggedIn: boolean;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState({ likes, liked });
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    if (!loggedIn) {
      setError("ログインするといいねできます");
      return;
    }
    setError(null);
    // 先に見た目を変えて、失敗したら戻す
    const next = { likes: state.likes + (state.liked ? -1 : 1), liked: !state.liked };
    setState(next);
    start(async () => {
      const res = await toggleLikeAction(placeId);
      if (res.error) {
        setState({ likes, liked });
        setError(res.error);
      }
    });
  };

  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3.5 py-2 text-sm";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.liked}
        title={state.liked ? "いいねを取り消す" : "この場所にいいね"}
        className={`flex items-center gap-1.5 rounded-full border font-bold transition disabled:opacity-60 ${pad} ${
          state.liked
            ? "border-shu bg-shu text-paper"
            : "border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
        }`}
      >
        <span aria-hidden>{state.liked ? "♥" : "♡"}</span>
        <span className="tabular-nums">{state.likes}</span>
        <span className="sr-only">いいね</span>
      </button>
      {error && <span className="text-[11px] text-shu">{error}</span>}
    </div>
  );
}
