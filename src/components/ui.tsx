import Link from "next/link";
import { CONSENSUS_LABEL, confidenceColor, formatPercent, type ConsensusLevel } from "@/lib/confidence";
import { MEDIUM_LABEL, type Medium } from "@/lib/queries";

export function ConfidenceBar({ share, showLabel = true }: { share: number; showLabel?: boolean }) {
  const color = confidenceColor(share);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${share * 100}%`, background: color }} />
      </div>
      {showLabel && (
        <span className="w-11 shrink-0 text-right text-xs font-bold tabular-nums" style={{ color }}>
          {formatPercent(share)}
        </span>
      )}
    </div>
  );
}

const CONSENSUS_STYLE: Record<ConsensusLevel, string> = {
  settled: "bg-shu-soft text-shu",
  leading: "bg-[#f7eeda] text-[#976415]",
  contested: "bg-[#e6efe7] text-[#4a6f51]",
  open: "bg-paper-2 text-ink-3",
};

export function ConsensusBadge({ level }: { level: ConsensusLevel }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CONSENSUS_STYLE[level]}`}>
      {CONSENSUS_LABEL[level]}
    </span>
  );
}

const MEDIUM_STYLE: Record<Medium, string> = {
  novel: "border-ai/30 text-ai",
  anime: "border-shu/30 text-shu",
  manga: "border-koke/40 text-koke",
  film: "border-odo/40 text-[#976415]",
};

export function MediumBadge({ medium }: { medium: Medium }) {
  return (
    <span className={`rounded border px-1.5 py-px text-[11px] font-semibold ${MEDIUM_STYLE[medium]}`}>
      {MEDIUM_LABEL[medium]}
    </span>
  );
}

export function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-ink-3">{label}</div>
      <div className="font-serif text-2xl leading-tight text-ink">
        {typeof value === "number" ? value.toLocaleString("ja-JP") : value}
        {unit && <span className="ml-0.5 text-xs text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-rule bg-card shadow-[0_1px_2px_rgba(36,33,29,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, more }: { children: React.ReactNode; more?: { href: string; label: string } }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b border-rule pb-2">
      <h2 className="font-serif text-lg font-bold tracking-wide">{children}</h2>
      {more && (
        <Link href={more.href} className="text-xs text-ink-3 hover:text-shu">
          {more.label} →
        </Link>
      )}
    </div>
  );
}

/** 本文引用と場面記述で見え方を変える。 */
export function PassageQuote({
  kind,
  quote,
  className = "",
}: {
  kind: string;
  quote: string;
  className?: string;
}) {
  if (kind === "text") {
    return (
      <blockquote className={`border-l-2 border-shu/50 pl-3 font-serif leading-relaxed text-ink ${className}`}>
        「{quote}」
      </blockquote>
    );
  }
  return <p className={`leading-relaxed text-ink-2 ${className}`}>{quote}</p>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-rule-2 px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}
