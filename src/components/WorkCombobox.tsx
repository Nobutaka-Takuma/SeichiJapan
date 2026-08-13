"use client";

import { useEffect, useId, useRef, useState } from "react";

export type WorkOption = { id: number; title: string; author: string; medium: string; place_count: number };

const MEDIUM_LABEL: Record<string, string> = { novel: "小説", anime: "アニメ", manga: "漫画", film: "映画" };

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2 text-sm outline-none focus:border-shu";

/**
 * 作品の予測入力。
 *
 * 作品数が増えることを前提に、プルダウンではなく入力で絞り込む。
 * 一覧に無い作品は、その場で登録できる（別画面へ飛ばすと書きかけが消えるため）。
 */
export function WorkCombobox({
  initial,
  required = true,
}: {
  initial?: WorkOption | null;
  required?: boolean;
}) {
  const listId = useId();
  const [selected, setSelected] = useState<WorkOption | null>(initial ?? null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<WorkOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 入力に追従して候補を引く
  useEffect(() => {
    if (selected || creating) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/works?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (alive) {
          setOptions(data.works ?? []);
          setActive(0);
        }
      } catch {
        if (alive) setOptions([]);
      }
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, selected, creating]);

  // 外側をクリックしたら閉じる
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const exactExists = options.some((o) => o.title === query.trim());
  const canCreate = query.trim().length > 0 && !exactExists;
  const rows = canCreate ? options.length + 1 : options.length;

  const choose = (index: number) => {
    if (canCreate && index === options.length) {
      setCreating(true);
      setOpen(false);
      return;
    }
    const opt = options[index];
    if (opt) {
      setSelected(opt);
      setOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (rows === 0 ? 0 : (a + 1) % rows));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (rows === 0 ? 0 : (a - 1 + rows) % rows));
    } else if (e.key === "Enter") {
      if (rows > 0) {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  /* 選択済み */
  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded border border-shu/40 bg-shu-soft/50 px-3 py-2.5">
        <input type="hidden" name="work_id" value={selected.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{selected.title}</p>
          <p className="truncate text-xs text-ink-3">
            {selected.author}
            {selected.medium && `・${MEDIUM_LABEL[selected.medium] ?? selected.medium}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setQuery("");
            setOpen(true);
          }}
          className="shrink-0 text-xs text-ink-3 hover:text-shu"
        >
          変更
        </button>
      </div>
    );
  }

  /* 新規登録 */
  if (creating) {
    return (
      <div className="space-y-2 rounded border border-shu/40 bg-shu-soft/30 p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-bold text-ink-2">新しい作品として登録します</p>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setOpen(true);
            }}
            className="text-xs text-ink-3 hover:text-shu"
          >
            一覧から選ぶ
          </button>
        </div>
        <input
          name="new_work_title"
          defaultValue={query.trim()}
          required
          placeholder="作品名 *"
          className={field}
        />
        <div className="grid grid-cols-2 gap-2">
          <input name="new_work_author" required placeholder="作者・制作 *" className={field} />
          <select name="new_work_medium" defaultValue="anime" className={field}>
            <option value="anime">アニメ</option>
            <option value="novel">小説</option>
            <option value="manga">漫画</option>
            <option value="film">映画</option>
          </select>
        </div>
      </div>
    );
  }

  /* 検索 */
  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="作品名を入力して検索（例：君の名は）"
        className={field}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1200] mt-1 max-h-64 w-full overflow-auto rounded border border-rule-2 bg-card shadow-[0_8px_24px_rgba(36,33,29,0.14)]"
        >
          {options.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left ${
                  i === active ? "bg-paper-2" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm">{o.title}</span>
                <span className="shrink-0 text-[11px] text-ink-3">
                  {o.author}・{MEDIUM_LABEL[o.medium] ?? o.medium}
                </span>
              </button>
            </li>
          ))}

          {canCreate && (
            <li role="option" aria-selected={active === options.length}>
              <button
                type="button"
                onMouseEnter={() => setActive(options.length)}
                onClick={() => choose(options.length)}
                className={`w-full border-t border-rule px-3 py-2 text-left text-sm font-bold text-shu ${
                  active === options.length ? "bg-paper-2" : ""
                }`}
              >
                ＋「{query.trim()}」を新しい作品として登録
              </button>
            </li>
          )}

          {options.length === 0 && !canCreate && (
            <li className="px-3 py-2 text-xs text-ink-3">作品名を入力してください</li>
          )}
        </ul>
      )}
    </div>
  );
}
