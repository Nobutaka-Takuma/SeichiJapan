"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { addSceneAction, type FormState } from "@/app/actions";
import { AreaSearch } from "./AreaSearch";
import { PlacePicker, type MapFocus } from "./MapView";
import { SceneFields } from "./SceneFields";
import { WorkCombobox, type WorkOption } from "./WorkCombobox";

type PlaceHit = { id: number; name: string; prefecture: string; address: string };

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu";

/**
 * シーンの登録フォーム。
 * 場所ページからは場所を固定して、作品ページからは作品を固定して開く。
 */
export function SceneForm({
  fixedPlace,
  fixedWork,
}: {
  fixedPlace?: { id: number; name: string; prefecture: string } | null;
  fixedWork?: WorkOption | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState & { placeId?: number }, FormData>(addSceneAction, {});

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [place, setPlace] = useState<PlaceHit | null>(
    fixedPlace ? { ...fixedPlace, address: "" } : null,
  );
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  useEffect(() => {
    if (fixedPlace || place || mode !== "existing" || !query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHits(data.places ?? []);
      } catch {
        setHits([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, mode, place, fixedPlace]);

  useEffect(() => {
    if (state.placeId) router.push(`/places/${state.placeId}`);
  }, [state.placeId, router]);

  const placeReady = !!place || (mode === "new" && !!coords);

  return (
    <form action={action} className="space-y-6">
      {/* 作品 */}
      <section className="space-y-2">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">作品</h2>
        {fixedWork ? (
          <div className="rounded border border-rule bg-paper-2/40 px-3 py-2.5">
            <input type="hidden" name="work_id" value={fixedWork.id} />
            <p className="text-sm font-bold">{fixedWork.title}</p>
            <p className="text-xs text-ink-3">{fixedWork.author}</p>
          </div>
        ) : (
          <WorkCombobox />
        )}
      </section>

      {/* 場所 */}
      <section className="space-y-2">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">場所</h2>

        {fixedPlace ? (
          <div className="rounded border border-rule bg-paper-2/40 px-3 py-2.5">
            <input type="hidden" name="place_id" value={fixedPlace.id} />
            <p className="text-sm font-bold">{fixedPlace.name}</p>
            <p className="text-xs text-ink-3">{fixedPlace.prefecture}</p>
          </div>
        ) : place ? (
          <div className="flex items-center gap-3 rounded border border-shu/40 bg-shu-soft/50 px-3 py-2.5">
            <input type="hidden" name="place_id" value={place.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{place.name}</p>
              <p className="truncate text-xs text-ink-3">
                {place.prefecture} {place.address}
              </p>
            </div>
            <button type="button" onClick={() => setPlace(null)} className="text-xs text-ink-3 hover:text-shu">
              変更
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1">
              {(
                [
                  ["existing", "登録済みの場所から選ぶ"],
                  ["new", "新しい場所を登録する"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  aria-pressed={mode === k}
                  className={`rounded-full px-3.5 py-2.5 text-xs font-bold sm:px-3 sm:py-1.5 ${
                    mode === k ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "existing" ? (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="場所の名前で検索（例：須賀神社、沼津駅）"
                  className={field}
                />
                {hits.length > 0 && (
                  <ul className="max-h-56 divide-y divide-rule overflow-auto rounded border border-rule bg-card">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => setPlace(h)}
                          className="w-full px-3 py-2 text-left hover:bg-paper-2"
                        >
                          <span className="block text-sm">{h.name}</span>
                          <span className="block text-xs text-ink-3">
                            {h.prefecture} {h.address}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {query.trim() && hits.length === 0 && (
                  <p className="text-xs text-ink-3">
                    見つからない場合は「新しい場所を登録する」から追加できます。
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <input name="place_name" required placeholder="場所の名前 *" className={field} />
                <div className="grid grid-cols-2 gap-2">
                  <input name="prefecture" placeholder="都道府県" className={field} />
                  <input name="address" placeholder="住所" className={field} />
                </div>
                <div className="overflow-hidden rounded border border-rule">
                  <div className="border-b border-rule p-2">
                    <AreaSearch
                      placeholder="市区町村・地名で地図を移動（例：新宿区）"
                      onSelect={(h) =>
                        setFocus({ lat: h.lat, lng: h.lng, zoom: h.zoom, bounds: h.bounds, nonce: Date.now() })
                      }
                    />
                  </div>
                  <PlacePicker value={coords} onChange={setCoords} height={260} focus={focus} />
                  <p className="border-t border-rule bg-card px-3 py-2 text-xs tabular-nums text-ink-3">
                    {coords ? `${coords.lat}, ${coords.lng}` : "地図をクリックして位置を指定してください"}
                  </p>
                </div>
                <input type="hidden" name="lat" value={coords?.lat ?? ""} />
                <input type="hidden" name="lng" value={coords?.lng ?? ""} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* シーン */}
      <section className="space-y-4">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">シーン</h2>
        <SceneFields />
        <label className="block">
          <span className="text-xs font-bold text-ink-2">根拠・補足（任意）</span>
          <textarea
            name="rationale"
            rows={2}
            placeholder="背景の建物の形が一致、公式の聖地マップに記載あり、など"
            className={`${field} mt-1 resize-y`}
          />
        </label>
      </section>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

      <div className="flex items-center gap-3 border-t border-rule pt-4">
        <button
          type="submit"
          disabled={pending || !placeReady}
          className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "登録中…" : "このシーンを登録する"}
        </button>
        {fixedPlace && (
          <Link
            href={`/places/${fixedPlace.id}`}
            className="rounded border border-rule-2 px-4 py-2.5 text-sm text-ink-2 hover:border-shu hover:text-shu"
          >
            やめる
          </Link>
        )}
        {!placeReady && <span className="text-xs text-ink-3">場所を決めると登録できます</span>}
      </div>
    </form>
  );
}
