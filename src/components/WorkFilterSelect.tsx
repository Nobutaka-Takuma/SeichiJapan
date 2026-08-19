"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * 地図の作品絞り込み。
 * 作品数が増えてもチップが横に伸び続けないよう、選択式にしている。
 */
export function WorkFilterSelect({
  works,
  value,
  medium,
  keep,
}: {
  works: { slug: string; title: string; author: string }[];
  value?: string;
  medium?: string;
  /** 絞り込みを変えても残したい問い合わせ（見ている都道府県など）。 */
  keep?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <label className="flex items-center gap-2 text-xs text-ink-3">
      作品で絞る
      <select
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const sp = new URLSearchParams();
          for (const [k, v] of Object.entries(keep ?? {})) if (v) sp.set(k, v);
          if (medium && medium !== "all") sp.set("medium", medium);
          if (e.target.value) sp.set("work", e.target.value);
          start(() => router.push(`/map${sp.toString() ? `?${sp}` : ""}`));
        }}
        className="max-w-[16rem] rounded border border-rule-2 bg-card px-2 py-1.5 text-xs text-ink outline-none focus:border-shu disabled:opacity-60"
      >
        <option value="">すべての作品</option>
        {works.map((w) => (
          <option key={w.slug} value={w.slug}>
            {w.author ? `${w.title}（${w.author}）` : w.title}
          </option>
        ))}
      </select>
    </label>
  );
}
