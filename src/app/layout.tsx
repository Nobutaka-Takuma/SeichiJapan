import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: {
    default: "聖地日本 — みんなで作る、小説とアニメの地図帳",
    template: "%s | 聖地日本",
  },
  description:
    "小説やアニメに登場する場所が、現実のどこなのか。本文の一節と実在の地点の対応づけを、みんなで持ち寄って地図にするサービスです。",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-[2000] border-b border-rule bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-lg font-bold tracking-widest">聖地日本</span>
              <span className="hidden text-[10px] tracking-wider text-ink-3 sm:inline">
                小説とアニメの地図帳
              </span>
            </Link>

            <nav className="flex items-center gap-4 text-sm text-ink-2">
              <Link href="/works" className="hover:text-shu">
                作品
              </Link>
              <Link href="/map" className="hover:text-shu">
                地図
              </Link>
              <Link href="/places" className="hover:text-shu">
                場所
              </Link>
              <Link href="/about" className="hidden hover:text-shu sm:inline">
                このサイトについて
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <Link href={`/users/${user.handle}`} className="text-ink-2 hover:text-shu">
                    {user.display_name}
                  </Link>
                  <form action={logoutAction}>
                    <button type="submit" className="text-xs text-ink-3 hover:text-shu">
                      ログアウト
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-ink-2 hover:text-shu">
                    ログイン
                  </Link>
                  <Link
                    href="/register"
                    className="rounded bg-shu px-3 py-1.5 text-xs font-bold text-paper hover:opacity-90"
                  >
                    参加する
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mt-16 border-t border-rule bg-paper-2/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-3 sm:flex-row sm:justify-between">
            <div>
              <p className="font-serif text-sm text-ink-2">聖地日本</p>
              <p className="mt-1 max-w-md leading-relaxed">
                本文と現実の対応づけは利用者による解釈です。確度は投票にもとづく目安であり、正しさを保証するものではありません。
              </p>
            </div>
            <nav className="flex gap-4">
              <Link href="/about" className="hover:text-shu">
                このサイトについて
              </Link>
              <Link href="/works" className="hover:text-shu">
                作品一覧
              </Link>
              <Link href="/map" className="hover:text-shu">
                全国地図
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
