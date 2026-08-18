"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * スマホ用の下部ナビ。
 * 巡礼中は片手で、親指の届く範囲だけで動かせる必要がある。
 */
const ITEMS = [
  { href: "/near", label: "近く", icon: "◎" },
  { href: "/map", label: "地図", icon: "▲" },
  { href: "/places", label: "聖地", icon: "■" },
  { href: "/routes", label: "コース", icon: "⇢" },
  { href: "/guess", label: "クイズ", icon: "？" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主要な画面"
      className="fixed inset-x-0 bottom-0 z-[1500] border-t border-rule bg-paper/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
                  active ? "text-shu" : "text-ink-3"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {it.icon}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
