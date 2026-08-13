"use client";

import { useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import { confidenceColor } from "@/lib/confidence";

export type MapPin = {
  id: number;
  lat: number;
  lng: number;
  title: string; // 場所名
  subtitle?: string; // 作品名など
  quote?: string;
  confidence: number;
  primary: boolean;
  href?: string;
  /** 異説が出ているときだけ確度を前に出す */
  disputed?: boolean;
  likes?: number;
  image?: string;
};

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR =
  '地図データ &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const JAPAN_CENTER: [number, number] = [36.2, 138.2];

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function pinIcon(L: typeof LType, pin: MapPin) {
  const pct = Math.round(pin.confidence * 100);
  const likes = pin.likes ?? 0;
  // 大半のピンは定説なので数字を出さない。人気に応じて少しだけ大きくする。
  const size = pin.primary ? 28 + Math.min(12, Math.round(likes / 4)) : 24;
  const color = pin.disputed ? confidenceColor(pin.confidence) : "#b4472e";
  const label = pin.disputed && pin.primary ? `${pct}` : likes >= 5 ? `♥${likes}` : "";
  const cls = `seichi-pin${pin.primary ? "" : " seichi-pin--sub"}${pin.disputed ? " seichi-pin--disputed" : ""}`;
  return L.divIcon({
    className: "",
    html: `<div class="${cls}" style="width:${size}px;height:${size}px;background:${color}">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function popupHtml(pin: MapPin): string {
  const pct = Math.round(pin.confidence * 100);
  return `
    <div style="min-width:210px;max-width:270px">
      ${
        pin.image
          ? `<img src="${esc(pin.image)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:3px;margin-bottom:8px">`
          : ""
      }
      ${pin.subtitle ? `<div style="font-size:11px;color:#8a8377;letter-spacing:.04em">${esc(pin.subtitle)}</div>` : ""}
      <div style="font-size:15px;font-weight:700;margin:2px 0 6px">${esc(pin.title)}</div>
      ${pin.quote ? `<div style="font-size:12px;color:#55504a;line-height:1.7">${esc(pin.quote)}</div>` : ""}
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:11px">
        ${
          pin.disputed
            ? `<span style="font-weight:700;color:${confidenceColor(pin.confidence)}">異説あり・確度 ${pct}%</span>`
            : `<span style="color:#6b8f71;font-weight:700">定説</span>`
        }
        ${pin.likes ? `<span style="color:#b4472e">♥ ${pin.likes}</span>` : ""}
      </div>
      ${
        pin.href
          ? `<a href="${esc(pin.href)}" style="display:inline-block;margin-top:8px;font-size:12px;color:#b4472e;font-weight:600">この場所を見る →</a>`
          : ""
      }
    </div>`;
}

export function MapView({
  pins,
  height = 460,
  className = "",
  fit = true,
  center,
  zoom = 5,
  picking = false,
  picked = null,
  onPick,
}: {
  pins: MapPin[];
  height?: number | string;
  className?: string;
  fit?: boolean;
  center?: [number, number];
  zoom?: number;
  /** 地図をクリックして座標を選ぶモード */
  picking?: boolean;
  picked?: { lat: number; lng: number } | null;
  onPick?: (v: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const pickRef = useRef<LType.Marker | null>(null);
  const fittedRef = useRef<string>("");
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;
  const [leaflet, setLeaflet] = useState<typeof LType | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (!cancelled) setLeaflet(mod.default ?? (mod as unknown as typeof LType));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const L = leaflet;
    if (!L || !ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center: center ?? JAPAN_CENTER,
      zoom,
      scrollWheelZoom: false,
      zoomControl: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // ホイールは Ctrl/⌘ 併用のときだけズーム（ページスクロールを奪わない）
    map.on("wheel", (e) => {
      const oe = (e as unknown as { originalEvent: WheelEvent }).originalEvent;
      if (oe.ctrlKey || oe.metaKey) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
    });
    map.on("click", (e: LType.LeafletMouseEvent) => {
      if (!pickingRef.current) return;
      onPickRef.current?.({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [leaflet, center, zoom]);

  useEffect(() => {
    const L = leaflet;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();
    const latlngs: LType.LatLngExpression[] = [];
    // 確度の低いものを先に描き、高いものを前面に置く
    for (const pin of [...pins].sort((a, b) => Number(a.primary) - Number(b.primary))) {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: pinIcon(L, pin),
        zIndexOffset: pin.primary ? 500 : 0,
      });
      if (picking) {
        // 書き込み中は、既存のピンを押したら「その場所」を選んだことにする。
        // 同じ場所に別のシーンを足す操作がいちばん多いため。
        marker.on("click", () => onPickRef.current?.({ lat: pin.lat, lng: pin.lng }));
      } else {
        marker.bindPopup(popupHtml(pin));
      }
      marker.addTo(layer);
      latlngs.push([pin.lat, pin.lng]);
    }

    // 同じピンの並びに対して二度は寄せ直さない。
    // 書き込みモードの切り替えで表示位置が飛ぶのを防ぐ。
    const signature = pins.map((p) => p.id).join(",");
    if (fit && latlngs.length > 0 && fittedRef.current !== signature) {
      map.fitBounds(L.latLngBounds(latlngs), {
        padding: [44, 44],
        maxZoom: latlngs.length === 1 ? 15 : 13,
      });
      fittedRef.current = signature;
    }
  }, [leaflet, pins, fit, picking]);

  // 選択中の地点を示すピン
  useEffect(() => {
    const L = leaflet;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!picked) {
      pickRef.current?.remove();
      pickRef.current = null;
      return;
    }
    const icon = L.divIcon({
      className: "",
      html: `<div class="seichi-pin seichi-pin--pick" style="width:34px;height:34px;background:#3f5f7a">ここ</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    if (pickRef.current) {
      pickRef.current.setLatLng([picked.lat, picked.lng]);
      pickRef.current.setIcon(icon);
    } else {
      pickRef.current = L.marker([picked.lat, picked.lng], { icon, zIndexOffset: 1000, draggable: true }).addTo(map);
      pickRef.current.on("dragend", () => {
        const p = pickRef.current!.getLatLng();
        onPickRef.current?.({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      });
    }
  }, [leaflet, picked]);

  return (
    <div
      ref={ref}
      className={`${className} ${picking ? "seichi-map--picking" : ""}`}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: "100%",
        cursor: picking ? "crosshair" : undefined,
      }}
      role="application"
      aria-label="作品に登場する場所の地図"
    />
  );
}

/** 新しい場所を登録するときの座標ピッカー。 */
export function PlacePicker({
  value,
  onChange,
  height = 320,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [leaflet, setLeaflet] = useState<typeof LType | null>(null);

  useEffect(() => {
    import("leaflet").then((mod) => setLeaflet(mod.default ?? (mod as unknown as typeof LType)));
  }, []);

  useEffect(() => {
    const L = leaflet;
    if (!L || !ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: value ? [value.lat, value.lng] : JAPAN_CENTER, zoom: value ? 14 : 5 });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `<div class="seichi-pin" style="width:30px;height:30px;background:#b4472e">＋</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const place = (lat: number, lng: number) => {
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      });
      onChangeRef.current({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
    };

    if (value) place(value.lat, value.lng);
    map.on("click", (e: LType.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // 初期化は一度だけ。value の追従は place() 側で行う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet]);

  return <div ref={ref} style={{ height: `${height}px`, width: "100%" }} aria-label="場所を選ぶ地図" />;
}
