"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revertPlaceAction } from "@/app/actions";

export function RevertButton({ revisionId, placeId }: { revisionId: number; placeId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-ink-3 hover:text-shu"
      >
        この版に戻す
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-ink-3">戻しますか？</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await revertPlaceAction(revisionId);
            if (res.error) setError(res.error);
            else router.push(`/places/${placeId}`);
          })
        }
        className="rounded bg-shu px-2 py-1 font-bold text-paper disabled:opacity-50"
      >
        {pending ? "処理中" : "戻す"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-ink-3 hover:text-ink">
        やめる
      </button>
      {error && <span className="text-shu">{error}</span>}
    </span>
  );
}
