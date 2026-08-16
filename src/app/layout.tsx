import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: {
    default: "聖地日本 — みんなで作る、小説とアニメの地図帳",
    template: "%s | 聖地日本",
  },
  description:
    "小説やアニメに登場する場所を地図に集め、誰でも書き足せる事典にしています。近くの聖地を探し、巡礼のコースを組み、訪ねた記録を残せます。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf7f1",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-[2000] border-b border-rule bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="flex shrink-0 items-baseline gap-2">
              <span className="font-serif text-lg font-bold tracking-widest">聖地日本</span>
              <span className="hidden text-[10px] tracking-wider text-ink-3 lg:inline">
                小説とアニメの地図帳
              </span>
            </Link>

            {/* 広い画面のナビ。狭い画面は下部ナビが担う */}
            <nav className="hidden items-center gap-4 text-sm text-ink-2 sm:flex">
              <Link href="/near" className="hover:text-shu">
                近くの聖地
              </Link>
              <Link href="/map" className="hover:text-shu">
                地図
              </Link>
              <Link href="/places" className="hover:text-shu">
                聖地
              </Link>
              <Link href="/routes" className="hover:text-shu">
                コース
              </Link>
              <Link href="/works" className="hover:text-shu">
                作品
              </Link>
              <Link href="/random" className="hover:text-shu" title="どこかの項目へ">
                おまかせ
              </Link>
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
              {user ? (
                <>
                  <Link
                    href="/scenes/new"
                    className="rounded bg-shu px-3 py-2 text-xs font-bold text-paper hover:opacity-90"
                  >
                    ＋ 書き込む
                  </Link>
                  <Link href={`/users/${user.handle}`} className="hidden text-ink-2 hover:text-shu sm:inline">
                    {user.display_name}
                  </Link>
                  <form action={logoutAction} className="hidden sm:block">
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
                    className="rounded bg-shu px-3 py-2 text-xs font-bold text-paper hover:opacity-90"
                  >
                    参加
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 下部ナビの分だけ余白を空ける */}
        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:py-8 sm:pb-8">{children}</main>

        <footer className="mt-10 border-t border-rule bg-paper-2/60 pb-20 sm:mt-16 sm:pb-0">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-3 sm:flex-row sm:justify-between">
            <div>
              <p className="font-serif text-sm text-ink-2">聖地日本</p>
              <p className="mt-1 max-w-md leading-relaxed">
                本文と現実の対応づけは利用者による解釈です。訪問の際は、そこで暮らす人の生活を第一に。
              </p>
            </div>
            <nav className="flex flex-wrap gap-4">
              <Link href="/about" className="hover:text-shu">
                このサイトについて
              </Link>
              <Link href="/areas" className="hover:text-shu">
                地域から探す
              </Link>
              <Link href="/works" className="hover:text-shu">
                作品一覧
              </Link>
            </nav>
          </div>
        </footer>

        <BottomNav />
      </body>
    </html>
  );
}
