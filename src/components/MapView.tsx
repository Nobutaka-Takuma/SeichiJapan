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
  const size = pin.primary ? (pin.confidence >= 0.55 ? 38 : 34) : 26;
  const color = confidenceColor(pin.confidence);
  return L.divIcon({
    className: "",
    html: `<div class="seichi-pin${pin.primary ? "" : " seichi-pin--sub"}" style="width:${size}px;height:${size}px;background:${color}">${
      pin.primary ? pct : ""
    }</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function popupHtml(pin: MapPin): string {
  const pct = Math.round(pin.confidence * 100);
  return `
    <div style="min-width:200px;max-width:260px">
      ${pin.subtitle ? `<div style="font-size:11px;color:#8a8377;letter-spacing:.04em">${esc(pin.subtitle)}</div>` : ""}
      <div style="font-size:15px;font-weight:700;margin:2px 0 6px">${esc(pin.title)}</div>
      ${pin.quote ? `<div style="font-size:12px;color:#55504a;line-height:1.7">${esc(pin.quote)}</div>` : ""}
      <div style="margin-top:8px;display:flex;align-items:center;gap:6px">
        <div style="flex:1;height:5px;background:#eee7d9;border-radius:99px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${confidenceColor(pin.confidence)}"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${confidenceColor(pin.confidence)}">確度 ${pct}%</span>
      </div>
      ${
        pin.href
          ? `<a href="${esc(pin.href)}" style="display:inline-block;margin-top:8px;font-size:12px;color:#b4472e;font-weight:600">この記述の議論を見る →</a>`
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
}: {
  pins: MapPin[];
  height?: number | string;
  className?: string;
  fit?: boolean;
  center?: [number, number];
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
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
      L.marker([pin.lat, pin.lng], { icon: pinIcon(L, pin), zIndexOffset: pin.primary ? 500 : 0 })
        .bindPopup(popupHtml(pin))
        .addTo(layer);
      latlngs.push([pin.lat, pin.lng]);
    }
    if (fit && latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: latlngs.length === 1 ? 15 : 13 });
    }
  }, [leaflet, pins, fit]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: typeof height === "number" ? `${height}px` : height, width: "100%" }}
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
