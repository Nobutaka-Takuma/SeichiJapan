"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { addSceneAction, type FormState } from "@/app/actions";
import { AreaSearch } from "./AreaSearch";
import { MapView, type MapFocus, type MapPin } from "./MapView";
import { SceneFields } from "./SceneFields";
import { WorkCombobox } from "./WorkCombobox";

type NearbyPlace = { id: number; name: string; prefecture: string; address: string; distance_m: number };

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu";

const distance = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

export function MapContribute({
  pins,
  loggedIn,
  height = 620,
}: {
  pins: MapPin[];
  loggedIn: boolean;
  height?: number;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [target, setTarget] = useState<NearbyPlace | "new" | null>(null);
  const [state, action, pending] = useActionState<FormState & { placeId?: number }, FormData>(addSceneAction, {});
  const panelRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  // 地点が決まったら、近くの登録済みの場所を引く
  useEffect(() => {
    if (!picked) return;
    setTarget(null);
    fetch(`/api/places/nearby?lat=${picked.lat}&lng=${picked.lng}`)
      .then((r) => r.json())
      .then((d) => {
        const list: NearbyPlace[] = d.places ?? [];
        setNearby(list);
        // すぐ隣に既存の場所があるなら、それを最初から選んでおく
        if (list[0] && list[0].distance_m < 80) setTarget(list[0]);
        else if (list.length === 0) setTarget("new");
      })
      .catch(() => setNearby([]));
    // 縦並びになる画面では、フォームが画面外に出てしまうので送る
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [picked]);

  useEffect(() => {
    if (state.placeId) router.push(`/places/${state.placeId}`);
  }, [state.placeId, router]);

  const reset = () => {
    setPicking(false);
    setPicked(null);
    setTarget(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="overflow-hidden rounded-lg border border-rule bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-2.5">
          <AreaSearch
            className="w-full sm:w-80"
            onSelect={(h) =>
              setFocus({ lat: h.lat, lng: h.lng, zoom: h.zoom, bounds: h.bounds, nonce: Date.now() })
            }
          />
          {loggedIn ? (
            <button
              type="button"
              onClick={() => (picking ? reset() : setPicking(true))}
              className={`shrink-0 rounded px-3 py-2 text-xs font-bold ${
                picking ? "bg-ink text-paper" : "bg-shu text-paper hover:opacity-90"
              }`}
            >
              {picking ? "書き込みをやめる" : "＋ 地図に書き込む"}
            </button>
          ) : (
            <Link href="/login?next=/map" className="shrink-0 rounded bg-shu px-3 py-2 text-xs font-bold text-paper">
              ログインして地図に書き込む
            </Link>
          )}
          <p className="text-xs text-ink-3">
            {picking ? "地図の上で、シーンの場所をクリックしてください" : "地名を入れると、その周辺まで一息で移動します"}
          </p>
        </div>
        <MapView
          pins={pins}
          height={height}
          picking={picking}
          picked={picked}
          onPick={(v) => setPicked(v)}
          fit={!picked && !focus}
          focus={focus}
        />
      </div>

      {/* 書き込みパネル */}
      <div ref={panelRef} className="scroll-mt-20 lg:sticky lg:top-20">
        {!picked ? (
          <div className="rounded-lg border border-dashed border-rule-2 p-6 text-sm leading-relaxed text-ink-3">
            <p className="font-bold text-ink-2">地図からの書き込みについて</p>
            <p className="mt-2">
              作品ページを開かなくても、地図の上で場所をクリックするだけで
              「ここは○○のこのシーン」を登録できます。
            </p>
            <p className="mt-2">
              同じ場所がすでに登録されていれば、その項目にシーンが積み重なっていきます。
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-5 rounded-lg border border-rule bg-card p-5">
            <input type="hidden" name="lat" value={picked.lat} />
            <input type="hidden" name="lng" value={picked.lng} />

            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-base font-bold">この地点に書き込む</h2>
              <button type="button" onClick={reset} className="text-xs text-ink-3 hover:text-shu">
                取り消す
              </button>
            </div>
            <p className="-mt-3 text-[11px] tabular-nums text-ink-3">
              {picked.lat}, {picked.lng}（ピンをドラッグで微調整）
            </p>

            {/* 場所 */}
            <div>
              <span className="text-xs font-bold text-ink-2">場所</span>
              <div className="mt-1.5 space-y-1.5">
                {nearby.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTarget(p)}
                    aria-pressed={target !== "new" && target?.id === p.id}
                    className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm ${
                      target !== "new" && target?.id === p.id
                        ? "border-shu bg-shu-soft/50"
                        : "border-rule hover:border-rule-2"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-[11px] text-ink-3">{distance(p.distance_m)}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTarget("new")}
                  aria-pressed={target === "new"}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    target === "new" ? "border-shu bg-shu-soft/50" : "border-dashed border-rule-2 hover:border-shu"
                  }`}
                >
                  ＋ 新しい場所としてここに登録する
                </button>
              </div>
            </div>

            {target === "new" && (
              <div className="space-y-2 rounded border border-rule bg-paper-2/40 p-3">
                <input name="place_name" required placeholder="場所の名前 *" className={field} />
                <div className="grid grid-cols-2 gap-2">
                  <input name="prefecture" placeholder="都道府県" className={field} />
                  <input name="address" placeholder="住所" className={field} />
                </div>
                <input name="place_note" placeholder="どんな場所か（一行）" className={field} />
              </div>
            )}
            {target && target !== "new" && <input type="hidden" name="place_id" value={target.id} />}

            {/* 作品 */}
            <div>
              <span className="text-xs font-bold text-ink-2">作品 *</span>
              <div className="mt-1.5">
                <WorkCombobox />
              </div>
            </div>

            {/* シーン */}
            <SceneFields compact />

            <label className="block">
              <span className="text-xs font-bold text-ink-2">根拠・補足（任意）</span>
              <textarea
                name="rationale"
                rows={2}
                placeholder="背景の建物の形が一致、公式の聖地マップに記載あり、など"
                className={`${field} mt-1 resize-y`}
              />
            </label>

            {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

            <button
              type="submit"
              disabled={pending || !target}
              className="w-full rounded bg-shu px-4 py-2.5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "登録中…" : target ? "この場所に登録する" : "場所を選んでください"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
