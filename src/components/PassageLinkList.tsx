import Link from "next/link";
import type { PassageLink } from "@/lib/wander";

/**
 * 「次にここへ行けます」を並べる一覧。
 *
 * 記述のカードは、どの画面でも同じ形で出す。
 * 引用の一部・作品名・その場所・出ている理由の4つだけ。
 */
export function PassageLinkList({ items, dense = false }: { items: PassageLink[]; dense?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className={`grid gap-2 ${dense ? "" : "sm:grid-cols-2"}`}>
      {items.map((it) => (
        <li key={it.passage_id}>
          <Link
            href={`/passages/${it.passage_id}`}
            className="flex h-full gap-3 rounded-lg border border-rule bg-card p-3 transition hover:border-shu/40 active:bg-paper-2"
          >
            {it.image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.image_path}
                alt=""
                className="h-14 w-20 shrink-0 rounded object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid h-14 w-20 shrink-0 place-items-center rounded bg-paper-2 font-serif text-lg text-rule-2"
              >
                {it.work_title.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-ink-3">
                <span className="font-bold text-ink-2">『{it.work_title}』</span>
                {it.chapter && <span>{it.chapter}</span>}
                <span className="ml-auto shrink-0 rounded bg-paper-2 px-1.5 py-px">{it.reason}</span>
              </span>
              <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink">
                {it.kind === "text" ? `「${it.quote}」` : it.quote}
              </span>
              {it.place_name && (
                <span className="mt-1 block truncate text-[11px] text-ink-3">
                  {it.place_name}
                  {it.prefecture && `・${it.prefecture}`}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
