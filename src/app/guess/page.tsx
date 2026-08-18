import Link from "next/link";
import type { Metadata } from "next";
import { GuessGame } from "@/components/GuessGame";

export const metadata: Metadata = {
  title: "この場面はどこ？",
  description:
    "作品の一場面から、その舞台がどこかを地図で当てる遊び。答え合わせから、その場所の項目と行き方へ。",
};

export default function GuessPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="border-b border-rule pb-3">
        <h1 className="font-serif text-xl font-bold tracking-wide sm:text-2xl">この場面はどこ？</h1>
        <p className="mt-1 text-xs leading-relaxed text-ink-3 sm:text-sm">
          手がかりを見て、地図の上で場所を指してください。近いほど高得点です。
          答え合わせのあと、その場所の項目や行き方へ進めます。
        </p>
      </div>

      <GuessGame />

      <div className="border-t border-rule pt-4 text-xs leading-relaxed text-ink-3">
        <p>
          手がかりに使うのは、投稿者が撮った<b className="text-ink-2">現地の写真</b>と、
          投稿者が自分の言葉で書いた<b className="text-ink-2">場面の記述</b>、
          それに保護期間の終わった作品の<b className="text-ink-2">本文</b>です。
          作品から引用した画像は、遊びの題材には使いません（
          <Link href="/rights" className="font-bold text-shu hover:underline">
            引用の扱いについて
          </Link>
          ）。
        </p>
        <p className="mt-2">
          手がかりを増やすには、
          <Link href="/scenes/new" className="font-bold text-shu hover:underline">
            現地の写真を添えてシーンを登録
          </Link>
          してください。写真が増えるほど、この遊びは面白くなります。
        </p>
      </div>
    </div>
  );
}
