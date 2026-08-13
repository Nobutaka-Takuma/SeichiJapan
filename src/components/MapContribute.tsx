"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { addSceneAction, type FormState } from "@/app/actions";
import { MapView, type MapPin } from "./MapView";

type NearbyPlace = { id: number; name: string; prefecture: string; address: string; distance_m: number };
type WorkOption = { id: number; title: string; author: string; medium: string };

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu";

export function MapContribute({
  pins,
  works,
  loggedIn,
  height = 620,
}: {
  pins: MapPin[];
  works: WorkOption[];
  loggedIn: boolean;
  height?: number;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [target, setTarget] = useState<NearbyPlace | "new" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<"scene" | "text">("scene");
  const [state, action, pending] = useActionState<FormState & { placeId?: number }, FormData>(addSceneAction, {});

  // 地点が決まったら、近くの登録済みの場所を引く
  useEffect(() => {
    if (!picked) return;
    setTarget(null);
    fetch(`/api/places/nearby?lat=${picked.lat}&lng=${picked.lng}`)
      .then((r) => r.json())
      .then((d) => setNearby(d.places ?? []))
      .catch(() => setNearby([]));
  }, [picked]);

  useEffect(() => {
    if (state.placeId) router.push(`/places/${state.placeId}`);
  }, [state.placeId, router]);

  const reset = () => {
    setPicking(false);
    setPicked(null);
    setTarget(null);
    setPreview(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="overflow-hidden rounded-lg border border-rule bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-2.5">
          {loggedIn ? (
            <button
              type="button"
              onClick={() => (picking ? reset() : setPicking(true))}
              className={`rounded px-3 py-1.5 text-xs font-bold ${
                picking ? "bg-ink text-paper" : "bg-shu text-paper hover:opacity-90"
              }`}
            >
              {picking ? "書き込みをやめる" : "＋ 地図に書き込む"}
            </button>
          ) : (
            <Link href="/login?next=/map" className="rounded bg-shu px-3 py-1.5 text-xs font-bold text-paper">
              ログインして地図に書き込む
            </Link>
          )}
          <p className="text-xs text-ink-3">
            {picking
              ? "地図の上で、シーンの場所をクリックしてください"
              : "「ここは、あの作品のあのシーンの場所」を地図から直接登録できます"}
          </p>
        </div>
        <MapView
          pins={pins}
          height={height}
          picking={picking}
          picked={picked}
          onPick={(v) => setPicked(v)}
          fit={!picked}
        />
      </div>

      {/* 書き込みパネル */}
      <div className="lg:sticky lg:top-20">
        {!picked ? (
          <div className="rounded-lg border border-dashed border-rule-2 p-6 text-sm leading-relaxed text-ink-3">
            <p className="font-bold text-ink-2">地図からの書き込みについて</p>
            <p className="mt-2">
              作品ページを開かなくても、地図の上で場所をクリックするだけで
              「ここは○○のこのシーン」を登録できます。アニメならその場面の画像、
              小説なら本文の描写を添えてください。
            </p>
            <p className="mt-2">
              同じ場所がすでに登録されていれば、その項目にシーンが積み重なっていきます。
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-4 rounded-lg border border-rule bg-card p-5">
            <input type="hidden" name="lat" value={picked.lat} />
            <input type="hidden" name="lng" value={picked.lng} />

            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-base font-bold">この地点に書き込む</h2>
              <button type="button" onClick={reset} className="text-xs text-ink-3 hover:text-shu">
                取り消す
              </button>
            </div>
            <p className="-mt-2 text-[11px] tabular-nums text-ink-3">
              {picked.lat}, {picked.lng}（ピンをドラッグで微調整）
            </p>

            {/* 場所を決める */}
            <div>
              <span className="text-xs font-bold text-ink-2">場所</span>
              <div className="mt-1.5 space-y-1.5">
                {nearby.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTarget(p)}
                    className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm ${
                      target !== "new" && target?.id === p.id
                        ? "border-shu bg-shu-soft/50"
                        : "border-rule hover:border-rule-2"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-[11px] text-ink-3">
                      {p.distance_m < 1000 ? `${p.distance_m}m` : `${(p.distance_m / 1000).toFixed(1)}km`}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTarget("new")}
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

            {/* 作品とシーン */}
            <label className="block">
              <span className="text-xs font-bold text-ink-2">作品 *</span>
              <select name="work_id" required defaultValue="" className={`${field} mt-1`}>
                <option value="" disabled>
                  作品を選ぶ
                </option>
                {works.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}（{w.author}）
                  </option>
                ))}
              </select>
              <Link href="/works/new" className="mt-1 inline-block text-[11px] text-ink-3 hover:text-shu">
                作品が一覧にない場合は追加 →
              </Link>
            </label>

            <div className="flex gap-1">
              {(
                [
                  ["scene", "場面の記述"],
                  ["text", "本文引用"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                    kind === k ? "bg-ink text-paper" : "border border-rule-2 text-ink-2 hover:border-shu"
                  }`}
                >
                  {label}
                </button>
              ))}
              <input type="hidden" name="kind" value={kind} />
            </div>

            <label className="block">
              <span className="text-xs font-bold text-ink-2">{kind === "text" ? "本文 *" : "シーンの説明 *"}</span>
              <textarea
                name="quote"
                rows={3}
                required
                minLength={5}
                placeholder={
                  kind === "text"
                    ? "彼は駅を出て、坂を下り、海の見える喫茶店に入った。"
                    : "千歌たちが部員募集のビラを配る、駅前のロータリー。"
                }
                className={`${field} mt-1 resize-y leading-relaxed`}
              />
            </label>

            <input name="chapter" placeholder="章・話数（例：第3話 / 上・二）" className={field} />

            {/* 画像 */}
            <div className="space-y-2">
              <label className="block">
                <span className="text-xs font-bold text-ink-2">シーンの画像</span>
                <input
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setPreview(f ? URL.createObjectURL(f) : null);
                  }}
                  className="mt-1 block w-full text-xs text-ink-2 file:mr-3 file:rounded file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink-2"
                />
              </label>
              {preview && (
                // プレビューはローカルのblob URLなので next/image は使わない
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-32 w-full rounded object-cover" />
              )}
              <input name="image_caption" placeholder="画像の説明（任意）" className={field} />
              <input name="image_credit" placeholder="撮影者・出典（任意）" className={field} />
              <p className="text-[11px] leading-relaxed text-ink-3">
                自分で撮影した現地写真を推奨します。作品の映像・挿絵は権利者のものです。
                引用の範囲を超える転載は避けてください。
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-ink-2">補足・根拠（任意）</span>
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
