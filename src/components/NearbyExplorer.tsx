"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AreaSearch } from "./AreaSearch";
import { MapView, type MapPin } from "./MapView";

type NearPlace = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  prefecture: string;
  address: string;
  note: string;
  photo_path: string;
  distance_m: number;
  likes: number;
  work_count: number;
  scene_count: number;
  works: string | null;
  visited: boolean;
};

const RADII = [
  { m: 2_000, label: "2km" },
  { m: 10_000, label: "10km" },
  { m: 30_000, label: "30km" },
  { m: 100_000, label: "100km" },
];

export const distanceLabel = (m: number) =>
  m < 1000 ? `${m}m` : m < 10_000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m / 1000)}km`;

/** 徒歩の目安。分速80m。 */
const walkMinutes = (m: number) => Math.max(1, Math.round(m / 80));

/**
 * 現在地から近い聖地。
 * 巡礼の最中に開く画面なので、位置を取ったら即座に一覧が出ることを優先する。
 */
export function NearbyExplorer({ initial }: { initial?: { lat: number; lng: number; label?: string } }) {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [label, setLabel] = useState<string>(initial?.label ?? "指定した地点");
  const [radius, setRadius] = useState(10_000);
  const [places, setPlaces] = useState<NearPlace[]>([]);
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "ready" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("この端末では現在地を取得できません。地名で探してください。");
      setStatus("denied");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) });
        setLabel("現在地");
      },
      (e) => {
        setStatus("denied");
        setError(
          e.code === e.PERMISSION_DENIED
            ? "位置情報の利用が許可されていません。地名を入れて探せます。"
            : "現在地を取得できませんでした。地名を入れて探せます。",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  // 端末によっては許可済みかどうかを先に確認できる。許可済みなら黙って取りにいく。
  useEffect(() => {
    if (initial) return; // 地点が指定されているときは現在地を取りにいかない
    if (!("permissions" in navigator)) return;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") locate();
      })
      .catch(() => {});
  }, [locate, initial]);

  useEffect(() => {
    if (!center) return;
    let alive = true;
    setStatus("loading");
    fetch(`/api/near?lat=${center.lat}&lng=${center.lng}&radius=${radius}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setPlaces(d.places ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (alive) {
          setError("読み込みに失敗しました");
          setStatus("ready");
        }
      });
    return () => {
      alive = false;
    };
  }, [center, radius]);

  const pins: MapPin[] = places.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    title: p.name,
    subtitle: p.works ?? p.prefecture,
    confidence: 1,
    primary: true,
    likes: p.likes,
    image: p.photo_path || undefined,
    href: `/places/${p.id}`,
  }));

  return (
    <div className="space-y-4">
      {/* 起点をきめる */}
      <div className="space-y-3 rounded-lg border border-rule bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={locate}
            className="min-h-[44px] rounded bg-shu px-4 text-sm font-bold text-paper hover:opacity-90"
          >
            {status === "locating" ? "現在地を取得中…" : "◎ 現在地から探す"}
          </button>
          {center && (
            <span className="text-xs text-ink-3">
              {label}（{center.lat}, {center.lng}）
            </span>
          )}
        </div>

        <AreaSearch
          placeholder="または地名から（例：飛騨市、秋葉原）"
          onSelect={(h) => {
            setCenter({ lat: h.lat, lng: h.lng });
            setLabel(h.label);
            setError(null);
          }}
        />

        {error && <p className="text-xs text-shu">{error}</p>}

        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-ink-3">範囲</span>
          {RADII.map((r) => (
            <button
              key={r.m}
              type="button"
              onClick={() => setRadius(r.m)}
              aria-pressed={radius === r.m}
              className={`min-h-[36px] rounded-full px-3 text-xs font-bold ${
                radius === r.m ? "bg-ink text-paper" : "border border-rule-2 text-ink-2"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!center && (
        <div className="rounded-lg border border-dashed border-rule-2 px-4 py-10 text-center text-sm leading-relaxed text-ink-3">
          <p className="font-bold text-ink-2">いま近くにある聖地を探します</p>
          <p className="mt-2">
            現在地を許可するか、地名を入れてください。
            <br />
            近い順に並べ、徒歩の目安も出します。
          </p>
        </div>
      )}

      {center && (
        <>
          <div className="overflow-hidden rounded-lg border border-rule">
            <MapView pins={pins} height={280} />
          </div>

          {status === "loading" && <p className="py-6 text-center text-sm text-ink-3">探しています…</p>}

          {status === "ready" && places.length === 0 && (
            <div className="rounded-lg border border-dashed border-rule-2 px-4 py-8 text-center text-sm text-ink-3">
              <p>この範囲には、まだ登録された聖地がありません。</p>
              <Link href="/scenes/new" className="mt-2 inline-block font-bold text-shu">
                最初の1件を登録する →
              </Link>
            </div>
          )}

          <ol className="space-y-2">
            {places.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/places/${p.id}`}
                  className="flex items-stretch gap-3 rounded-lg border border-rule bg-card active:bg-paper-2"
                >
                  {p.photo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_path} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-l-lg object-cover" />
                  ) : (
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-l-lg bg-paper-2 font-serif text-2xl text-rule-2">
                      {p.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 py-2.5 pr-3">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                      <span className="shrink-0 text-xs font-bold text-shu">{distanceLabel(p.distance_m)}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">
                      徒歩{walkMinutes(p.distance_m)}分ほど・{p.prefecture}
                    </span>
                    {p.works && <span className="mt-1 block truncate text-xs text-ink-2">{p.works}</span>}
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
                      {p.visited && <span className="rounded bg-koke/15 px-1.5 font-bold text-koke">訪問済み</span>}
                      {p.likes > 0 && <span className="text-shu">♥{p.likes}</span>}
                      <span>シーン{p.scene_count}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
