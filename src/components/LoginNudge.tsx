"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 「これはログインが要ります」の一行。
 *
 * 書くことのほとんどは名乗らずにできる。ログインが要るのは、
 * いいね・投票・旅の記録のように**その人のもの**として残るものだけ。
 * 断るだけで終わらせず、行って戻ってこられる形にする。
 */
export function LoginNudge({ message }: { message: string }) {
  const path = usePathname();
  const next = encodeURIComponent(path || "/");
  return (
    <span className="text-[11px] leading-relaxed text-ink-3">
      {message}{" "}
      <Link href={`/login?next=${next}`} className="font-bold text-shu hover:underline">
        ログイン
      </Link>
      ・
      <Link href={`/register?next=${next}`} className="font-bold text-shu hover:underline">
        登録
      </Link>
      （30秒）
    </span>
  );
}
