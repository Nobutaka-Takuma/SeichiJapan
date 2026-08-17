"use client";

import { useState, useTransition } from "react";
import { voteAction } from "@/app/actions";
import { LoginNudge } from "./LoginNudge";

export function VoteButtons({
  identificationId,
  up,
  down,
  myVote,
  loggedIn,
}: {
  identificationId: number;
  up: number;
  down: number;
  myVote: number;
  loggedIn: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);

  const cast = (value: 1 | -1) => {
    if (!loggedIn) {
      setNudge(true);
      return;
    }
    setError(null);
    start(async () => {
      const res = await voteAction(identificationId, value);
      if (res.error) setError(res.error);
    });
  };

  const base =
    "flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-bold transition disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => cast(1)}
          disabled={pending}
          aria-pressed={myVote === 1}
          title={loggedIn ? "この説を支持する" : "投票は1人1票なのでログインが要ります"}
          className={`${base} ${
            myVote === 1 ? "border-shu bg-shu text-paper" : "border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
          }`}
        >
          <span aria-hidden>▲</span>
          <span className="tabular-nums">{up}</span>
          <span className="sr-only">支持</span>
        </button>
        <button
          type="button"
          onClick={() => cast(-1)}
          disabled={pending}
          aria-pressed={myVote === -1}
          title={loggedIn ? "この説には賛成できない" : "投票は1人1票なのでログインが要ります"}
          className={`${base} ${
            myVote === -1 ? "border-ink bg-ink text-paper" : "border-rule-2 text-ink-3 hover:border-ink hover:text-ink"
          }`}
        >
          <span aria-hidden>▼</span>
          <span className="tabular-nums">{down}</span>
          <span className="sr-only">不支持</span>
        </button>
      </div>
      {nudge && <LoginNudge message="投票は1人1票です。" />}
      {error && <p className="text-[11px] text-shu">{error}</p>}
    </div>
  );
}
