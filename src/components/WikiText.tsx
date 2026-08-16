import Link from "next/link";

/**
 * 本文中の `[[場所の名前]]` を項目へのリンクにする。
 *
 * 場所の解説にも、記述の注記にも同じ書き方が使えるように切り出してある。
 * まだ無い項目は赤リンク（点線）にして、書けば埋まることが分かるようにする。
 */
export function WikiText({
  text,
  links,
  self,
}: {
  text: string;
  links: Map<string, number>;
  /** この項目自身のID。自分へのリンクは張らない。 */
  self?: number;
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(/\[\[([^\]]{1,60})\]\]/g)) {
    const name = m[1];
    const at = m.index!;
    if (at > last) parts.push(text.slice(last, at));
    const id = links.get(name);

    if (id !== undefined && id === self) {
      parts.push(
        <b key={at} className="font-bold text-ink">
          {name}
        </b>,
      );
    } else if (id !== undefined) {
      parts.push(
        <Link
          key={at}
          href={`/places/${id}`}
          className="text-ai underline decoration-ai/40 underline-offset-2 hover:text-shu"
        >
          {name}
        </Link>,
      );
    } else {
      parts.push(
        <Link
          key={at}
          href={`/places?q=${encodeURIComponent(name)}`}
          className="text-ink-3 underline decoration-dotted underline-offset-2"
          title="この項目はまだありません"
        >
          {name}
        </Link>,
      );
    }
    last = at + m[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
