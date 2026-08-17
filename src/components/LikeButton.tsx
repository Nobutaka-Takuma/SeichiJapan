"use client";

import { useState, useTransition } from "react";
import { toggleLikeAction } from "@/app/actions";
import { LoginNudge } from "./LoginNudge";

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
  const [nudge, setNudge] = useState(false);

  const toggle = () => {
    if (!loggedIn) {
      setNudge(true);
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

  // 携帯では指で押せる大きさを確保し、画面が広いときだけ詰める
  const pad = size === "sm" ? "px-3 py-2 text-xs sm:px-2 sm:py-1" : "px-3.5 py-2.5 text-sm sm:py-2";

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
      {nudge && <LoginNudge message="いいねはアカウントに紐づきます。" />}
      {error && <span className="text-[11px] text-shu">{error}</span>}
    </div>
  );
}
