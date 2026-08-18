"use client";

import { useEffect, useId, useRef, useState } from "react";

export type GeoHit = {
  kind: "place" | "area" | "prefecture" | "external";
  label: string;
  sub: string;
  lat: number;
  lng: number;
  zoom: number;
  bounds?: [[number, number], [number, number]];
  count?: number;
  prefecture?: string;
};

const KIND_LABEL: Record<GeoHit["kind"], string> = {
  area: "市区町村",
  prefecture: "都道府県",
  place: "場所",
  external: "地名",
};

const KIND_STYLE: Record<GeoHit["kind"], string> = {
  area: "bg-shu-soft text-shu",
  prefecture: "bg-[#e6efe7] text-[#4a6f51]",
  place: "bg-paper-2 text-ink-3",
  external: "bg-paper-2 text-ink-3",
};

/**
 * 地名で地図の表示範囲を移す入力欄。
 * 「渋谷区」「沼津市」のような地名を入れると、その周辺まで一息で飛ぶ。
 */
export function AreaSearch({
  onSelect,
  placeholder = "市区町村・地名で移動（例：新宿区、沼津市、秋葉原）",
  className = "",
}: {
  onSelect: (hit: GeoHit) => void;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setHits([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        if (alive) {
          setHits(data.hits ?? []);
          setActive(0);
        }
      } catch {
        if (alive) setHits([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (i: number) => {
    const hit = hits[i];
    if (!hit) return;
    onSelect(hit);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (hits.length ? (a + 1) % hits.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (hits.length ? (a - 1 + hits.length) % hits.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
          ⌕
        </span>
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="地名で地図を移動"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full rounded border border-rule-2 bg-card py-2 pl-8 pr-3 text-sm outline-none focus:border-shu"
        />
      </div>

      {open && query.trim() && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1200] mt-1 max-h-72 w-full overflow-auto rounded border border-rule-2 bg-card shadow-[0_8px_24px_rgba(36,33,29,0.16)]"
        >
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.label}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i === active ? "bg-paper-2" : ""}`}
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${KIND_STYLE[h.kind]}`}>
                  {KIND_LABEL[h.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{h.label}</span>
                  <span className="block truncate text-[11px] text-ink-3">{h.sub}</span>
                </span>
              </button>
            </li>
          ))}
          {hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-3">
              {loading ? "探しています…" : "見つかりませんでした。市区町村名や場所の名前で試してください。"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
