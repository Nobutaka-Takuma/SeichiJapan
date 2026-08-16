"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { saveRouteAction, type FormState } from "@/app/actions";
import { MapView, type MapPin } from "./MapView";

type Stop = { id: number; name: string; prefecture: string; lat: number; lng: number };

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2.5 text-sm outline-none focus:border-shu";

const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

function legLength(a: Stop, b: Stop) {
  const dy = (b.lat - a.lat) * 111_000;
  const dx = (b.lng - a.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.round(Math.hypot(dx, dy));
}

/**
 * 巡礼コースの作成・編集。
 * 回る順に地点を並べる。順番そのものが情報なので、上下の入れ替えを主にする。
 */
export function RouteEditor({
  initial,
}: {
  initial?: { slug: string; title: string; description: string; area: string; stops: Stop[] };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState & { slug?: string }, FormData>(saveRouteAction, {});
  const [stops, setStops] = useState<Stop[]>(initial?.stops ?? []);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Stop[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
        const d = await res.json();
        setHits(d.places ?? []);
      } catch {
        setHits([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (state.slug) router.push(`/routes/${encodeURIComponent(state.slug)}`);
  }, [state.slug, router]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    setStops(next);
  };

  const total = stops.reduce((sum, s, i) => (i === 0 ? 0 : sum + legLength(stops[i - 1], s)), 0);

  const pins: MapPin[] = stops.map((s, i) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    title: `${i + 1}. ${s.name}`,
    subtitle: s.prefecture,
    confidence: 1,
    primary: true,
  }));

  return (
    <form action={action} className="space-y-6">
      {initial?.slug && <input type="hidden" name="slug" value={initial.slug} />}
      <input type="hidden" name="stops" value={stops.map((s) => s.id).join(",")} />

      <section className="space-y-3">
        <label className="block">
          <span className="text-xs font-bold text-ink-2">コース名 *</span>
          <input
            name="title"
            required
            defaultValue={initial?.title}
            placeholder="例：四ツ谷から須賀神社へ、瀧の通学路をたどる"
            className={`${field} mt-1`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-ink-2">地域</span>
            <input name="area" defaultValue={initial?.area} placeholder="新宿区・四谷" className={`${field} mt-1`} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-bold text-ink-2">説明</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={initial?.description}
            placeholder="所要時間の目安、歩く順の理由、立ち寄るとよい場所、注意すること。"
            className={`${field} mt-1 resize-y leading-relaxed`}
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">
          回る順に地点を並べる
          {stops.length > 1 && <span className="ml-2 text-xs font-normal text-ink-3">全{km(total)}</span>}
        </h2>

        {stops.length > 0 && (
          <div className="overflow-hidden rounded border border-rule">
            <MapView pins={pins} height={240} />
          </div>
        )}

        <ol className="space-y-2">
          {stops.map((s, i) => (
            <li key={`${s.id}-${i}`} className="flex items-center gap-2 rounded border border-rule bg-card p-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-shu text-xs font-bold text-paper">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{s.name}</span>
                <span className="block text-[11px] text-ink-3">
                  {s.prefecture}
                  {i > 0 && `・前から ${km(legLength(stops[i - 1], s))}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="ひとつ上へ"
                className="min-h-[36px] min-w-[36px] rounded border border-rule-2 text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === stops.length - 1}
                aria-label="ひとつ下へ"
                className="min-h-[36px] min-w-[36px] rounded border border-rule-2 text-xs disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setStops(stops.filter((_, k) => k !== i))}
                aria-label="外す"
                className="min-h-[36px] min-w-[36px] rounded border border-rule-2 text-xs text-ink-3"
              >
                ×
              </button>
            </li>
          ))}
        </ol>

        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="場所を検索して追加（例：須賀神社）"
            className={field}
          />
          {hits.length > 0 && (
            <ul className="mt-2 max-h-56 divide-y divide-rule overflow-auto rounded border border-rule bg-card">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setStops([...stops, h]);
                      setQuery("");
                      setHits([]);
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-paper-2"
                  >
                    <span className="block text-sm">{h.name}</span>
                    <span className="block text-xs text-ink-3">{h.prefecture}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

      <div className="flex items-center gap-3 border-t border-rule pt-4">
        <button
          type="submit"
          disabled={pending || stops.length < 2}
          className="min-h-[44px] rounded bg-shu px-5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "保存中…" : "コースを保存する"}
        </button>
        <Link href="/routes" className="min-h-[44px] rounded border border-rule-2 px-4 py-2.5 text-sm text-ink-2">
          やめる
        </Link>
        {stops.length < 2 && <span className="text-xs text-ink-3">地点を2つ以上えらぶと保存できます</span>}
      </div>
    </form>
  );
}
