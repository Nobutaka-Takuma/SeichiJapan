import { citationLine } from "@/lib/quote";

/**
 * シーンに添えられた画像。
 *
 * 現地写真と、作品からの引用とで**見た目をはっきり変える**。
 * 引用のほうは枠で囲い、「引用」の札を貼り、出所を必ず下に置く。
 * どこからどこまでが他人の著作物かが見て分かることが、
 * 引用として成り立つための最初の条件だから。
 *
 * 引用画像は大きく出さない（必要な範囲にとどめる）。
 * 拡大表示のリンクも付けない。
 */
export function QuotedImage({
  src,
  kind,
  caption,
  credit,
  workTitle,
  author,
  detail,
  source,
  className = "",
}: {
  src: string;
  kind: string;
  caption?: string;
  credit?: string;
  workTitle: string;
  author: string;
  detail?: string;
  source?: string;
  className?: string;
}) {
  if (kind !== "work_quote") {
    return (
      <figure className={className}>
        {/* 利用者が投稿した画像。サイズが不定なので next/image は使わない */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || "現地の写真"}
          className="w-full rounded-lg border border-rule object-cover"
          style={{ maxHeight: 420 }}
        />
        {(caption || credit) && (
          <figcaption className="mt-1.5 text-xs text-ink-3">
            {caption}
            {credit && <span className="ml-2">（撮影：{credit}）</span>}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure className={`max-w-md ${className}`}>
      <div className="rounded-lg border-2 border-dashed border-rule-2 bg-paper-2/40 p-3">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-bold text-ink-3">
          <span className="rounded bg-ink px-1.5 py-0.5 text-paper">引用</span>
          ここから下は作品からの引用です
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`『${workTitle}』からの引用${caption ? `：${caption}` : ""}`}
          className="w-full rounded object-contain"
          style={{ maxHeight: 300 }}
        />
        <figcaption className="mt-2 border-t border-rule pt-2 text-[11px] leading-relaxed text-ink-2">
          {caption && <span className="block text-ink-3">{caption}</span>}
          <span className="block font-bold">
            出典：{citationLine({ workTitle, author, detail: detail ?? "", source: source ?? "" })}
          </span>
        </figcaption>
      </div>
    </figure>
  );
}
