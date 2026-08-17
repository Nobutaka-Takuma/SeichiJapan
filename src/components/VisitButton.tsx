"use client";

import { useState, useTransition } from "react";
import { toggleVisitAction } from "@/app/actions";
import { LoginNudge } from "./LoginNudge";

/**
 * 「行った」の記録。
 * 巡礼はその場で押すものなので、押しやすさ（44px以上）を優先する。
 */
export function VisitButton({
  placeId,
  visited,
  total,
  loggedIn,
  size = "md",
}: {
  placeId: number;
  visited: boolean;
  total: number;
  loggedIn: boolean;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState({ visited, total });
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);

  const toggle = () => {
    if (!loggedIn) {
      setNudge(true);
      return;
    }
    setError(null);
    const next = { visited: !state.visited, total: state.total + (state.visited ? -1 : 1) };
    setState(next);
    start(async () => {
      const res = await toggleVisitAction(placeId);
      if (res.error) {
        setState({ visited, total });
        setError(res.error);
      }
    });
  };

  const pad = size === "sm" ? "px-2.5 min-h-[36px] text-xs" : "px-4 min-h-[44px] text-sm";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.visited}
        className={`flex items-center gap-1.5 rounded-full border font-bold transition disabled:opacity-60 ${pad} ${
          state.visited ? "border-koke bg-koke text-paper" : "border-rule-2 text-ink-2 hover:border-koke hover:text-koke"
        }`}
      >
        <span aria-hidden>{state.visited ? "✓" : "○"}</span>
        {state.visited ? "訪問済み" : "行った"}
        {state.total > 0 && <span className="tabular-nums opacity-80">{state.total}</span>}
      </button>
      {nudge && <LoginNudge message="旅の記録はあなたのものです。" />}
      {error && <span className="text-[11px] text-shu">{error}</span>}
    </div>
  );
}
