"use client";

import Link from "next/link";
import { useState } from "react";
import { REGIONS, type Region } from "@/lib/regions";

export type PrefCount = { places: number; works: number };

/**
 * 地方 → 都道府県 の順に選ばせる。
 *
 * 日本全体を一枚の地図で見せても、点が小さく散らばるだけで
 * 「どこに何があるか」は読み取れない。先に地方、次に県と絞ってから
 * 地図を出すほうが、目的の場所に早く着く。
 *
 * 地方を開くところまでは画面内で完結させ、県を押したときだけ地図へ移る。
 * 一手ごとにページが変わると、選び直すのが億劫になるため。
 */
export function RegionPicker({
  counts,
  defaultRegion,
  hrefBase = "/map?pref=",
}: {
  /** 都道府県ごとの数。0件の県も並べたいので、無い県は 0 として扱う。 */
  counts: Record<string, PrefCount>;
  defaultRegion?: string;
  /**
   * 県を選んだときの行き先の前半。県名を符号化して後ろに付ける。
   *
   * ここを関数にはできない。サーバ側の描画から渡せるのは、
   * そのまま送れる値だけで、関数は境界を越えられないため。
   */
  hrefBase?: string;
}) {
  const hrefFor = (prefecture: string) => `${hrefBase}${encodeURIComponent(prefecture)}`;
  const [openKey, setOpenKey] = useState<string | null>(defaultRegion ?? null);
  const open = REGIONS.find((r) => r.key === openKey) ?? null;

  const total = (r: Region) =>
    r.prefectures.reduce(
      (acc, p) => {
        const c = counts[p];
        return { places: acc.places + (c?.places ?? 0), works: acc.works + (c?.works ?? 0) };
      },
      { places: 0, works: 0 },
    );

  if (open) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpenKey(null)}
            className="flex min-h-[40px] items-center rounded border border-rule-2 px-3 text-xs font-bold text-ink-2 hover:border-shu hover:text-shu"
          >
            ← 地方
          </button>
          <p className="font-serif text-lg font-bold tracking-wide">{open.name}</p>
          <p className="text-xs text-ink-3">見たい都道府県をえらんでください</p>
        </div>

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {open.prefectures.map((pref) => {
            const c = counts[pref];
            const empty = !c || c.places === 0;
            return (
              <li key={pref}>
                <Link
                  href={hrefFor(pref)}
                  className={`flex min-h-[64px] flex-col justify-center rounded-lg border px-3 py-2 transition ${
                    empty
                      ? "border-dashed border-rule text-ink-3 hover:border-shu/50"
                      : "border-rule bg-card hover:border-shu/50 active:bg-paper-2"
                  }`}
                >
                  <span className={`font-bold ${empty ? "" : "text-ink"}`}>{pref}</span>
                  <span className="mt-0.5 text-[11px] text-ink-3">
                    {empty ? (
                      "まだありません"
                    ) : (
                      <>
                        場所 <b className="font-bold text-ink-2">{c.places}</b>・作品 {c.works}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-3">まず、見たい地方をえらんでください</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {REGIONS.map((r) => {
          const t = total(r);
          const empty = t.places === 0;
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => setOpenKey(r.key)}
                className={`flex min-h-[72px] w-full flex-col justify-center rounded-lg border px-3 py-2 text-left transition ${
                  empty
                    ? "border-dashed border-rule text-ink-3 hover:border-shu/50"
                    : "border-rule bg-card hover:border-shu/50 active:bg-paper-2"
                }`}
              >
                <span className={`font-serif text-base font-bold ${empty ? "" : "text-ink"}`}>
                  {r.name}
                </span>
                <span className="mt-0.5 text-[11px] text-ink-3">
                  {empty ? (
                    "まだありません"
                  ) : (
                    <>
                      場所 <b className="font-bold text-ink-2">{t.places}</b>・作品 {t.works}
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
