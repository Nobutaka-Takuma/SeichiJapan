"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { addIdentificationAction, type FormState } from "@/app/actions";
import { PlacePicker } from "./MapView";

type PlaceHit = { id: number; name: string; prefecture: string; address: string; lat: number; lng: number };

export function AddCandidateForm({ passageId, loggedIn }: { passageId: number; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [selected, setSelected] = useState<PlaceHit | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(addIdentificationAction, {});

  useEffect(() => {
    if (mode !== "existing" || query.trim().length === 0) {
      setHits([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHits(data.places ?? []);
      } catch {
        setHits([]);
      }
    }, 220);
    return () => clearTimeout(id);
  }, [query, mode]);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setSelected(null);
      setCoords(null);
      setQuery("");
    }
  }, [state.ok]);

  if (!loggedIn) {
    return (
      <p className="rounded-md border border-dashed border-rule-2 px-4 py-5 text-center text-sm text-ink-3">
        新しい説を出すには{" "}
        <Link href={`/login?next=/passages/${passageId}`} className="font-bold text-shu hover:underline">
          ログイン
        </Link>{" "}
        してください。
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-rule-2 px-4 py-4 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
      >
        ＋ 別の場所を候補に挙げる
      </button>
    );
  }

  const field = "w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu";

  return (
    <form action={action} className="space-y-5 rounded-md border border-rule-2 bg-paper-2/40 p-5">
      <input type="hidden" name="passage_id" value={passageId} />

      <div>
        <div className="mb-3 flex gap-1">
          {(
            [
              ["existing", "登録済みの場所から選ぶ"],
              ["new", "新しい場所を登録する"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setSelected(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                mode === key ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu hover:text-shu"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "existing" ? (
          <div>
            {selected ? (
              <div className="flex items-center gap-3 rounded border border-shu/40 bg-shu-soft/50 px-3 py-2.5">
                <input type="hidden" name="place_id" value={selected.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{selected.name}</p>
                  <p className="truncate text-xs text-ink-3">
                    {selected.prefecture} {selected.address}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-ink-3 hover:text-shu"
                >
                  変更
                </button>
              </div>
            ) : (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="場所の名前で検索（例：由比ヶ浜、沼津駅）"
                  className={field}
                />
                {hits.length > 0 && (
                  <ul className="mt-2 max-h-56 divide-y divide-rule overflow-auto rounded border border-rule bg-card">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(h)}
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
                  <p className="mt-2 text-xs text-ink-3">
                    見つからない場合は「新しい場所を登録する」から追加できます。
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="place_name" placeholder="場所の名前 *" required className={`${field} sm:col-span-1`} />
              <input name="prefecture" placeholder="都道府県" className={field} />
              <input name="address" placeholder="住所・所在地" className={field} />
            </div>
            <div className="overflow-hidden rounded border border-rule">
              <PlacePicker value={coords} onChange={setCoords} height={300} />
              <p className="border-t border-rule bg-card px-3 py-2 text-xs text-ink-3">
                {coords
                  ? `緯度 ${coords.lat} / 経度 ${coords.lng}（ピンをドラッグして微調整できます）`
                  : "地図をクリックして位置を指定してください"}
              </p>
            </div>
            <input type="hidden" name="lat" value={coords?.lat ?? ""} />
            <input type="hidden" name="lng" value={coords?.lng ?? ""} />
            <input name="place_note" placeholder="場所についての補足（任意）" className={field} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-bold text-ink-2">なぜそこだと考えるか *</span>
          <textarea
            name="rationale"
            rows={4}
            required
            minLength={10}
            placeholder="本文の描写のどこと、現地の何が一致するのか。当時の地図や年表、作者の経歴など、根拠になるものを書いてください。"
            className={`${field} mt-1 resize-y leading-relaxed`}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-ink-2">根拠の種類</span>
            <select name="evidence" className={`${field} mt-1`} defaultValue="guess">
              <option value="guess">推測（読んでの見立て）</option>
              <option value="research">調査にもとづく（資料・現地確認）</option>
              <option value="official">公式・作中に明示</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-ink-2">出典URL（任意）</span>
            <input name="source_url" type="url" placeholder="https://" className={`${field} mt-1`} />
          </label>
        </div>
      </div>

      {state.error && <p className="text-sm text-shu">{state.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-shu px-5 py-2 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "送信中…" : "この説を投稿する"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-rule-2 px-4 py-2 text-sm text-ink-2 hover:border-shu hover:text-shu"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
