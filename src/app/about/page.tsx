import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "このサイトについて",
  description: "本文と現実の場所の対応づけを、根拠つきで共同編集する。確度の考え方と、参加のしかた。",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="border-b border-rule pb-6">
        <h1 className="font-serif text-3xl font-bold tracking-wide">このサイトについて</h1>
        <p className="mt-3 leading-loose text-ink-2">
          聖地日本は、小説やアニメに出てくる場所が現実のどこなのかを、みんなで持ち寄って地図にするサービスです。
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">共同編集するのは「知識」ではなく「解釈」</h2>
        <p className="leading-loose text-ink-2">
          百科事典が共同編集するのは知識です。ここで共同編集するのは、
          <strong className="font-bold text-ink">物語と現実世界の対応関係</strong>——つまり解釈です。
        </p>
        <Card className="space-y-4 p-6">
          <p className="font-serif leading-relaxed">
            「彼は駅を出て、坂を下り、海の見える喫茶店に入った。」
          </p>
          <ul className="space-y-2.5 border-l-2 border-rule pl-4 text-sm leading-relaxed text-ink-2">
            <li>
              <b className="text-ink">Aさん</b>：これは○○駅だと思う
            </li>
            <li>
              <b className="text-ink">Bさん</b>：いや、作者の当時の生活圏から考えると△△駅では？
            </li>
            <li>
              <b className="text-ink">Cさん</b>：当時の地図を見ると、この道順なら○○駅の可能性が高い
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-ink-2">
            この議論が積み上がっていくこと自体に価値があります。結論だけでなく、
            なぜそう考えたのかが残るようにしています。文学研究と百科事典の中間のような場所です。
          </p>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">確度の決まりかた</h2>
        <p className="leading-loose text-ink-2">
          ひとつの記述に複数の説が並んだとき、それぞれの説の支持（賛成票−反対票）の比率から確度を出しています。
        </p>
        <Card className="p-6">
          <p className="font-mono text-sm text-ink-2">
            重み = max(0, 賛成 − 反対) + 0.5
            <br />
            確度 = その説の重み ÷ すべての説の重みの合計
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            末尾の <b>+0.5</b> は、票が少ないうちに確度が振り切れないようにするための補正です。
            また、説がひとつしかない場合は、票が集まるまで確度が頭打ちになります。
            <b className="text-ink">「まだ誰も検証していない」ことと「検証されて支持された」ことを、区別するため</b>です。
          </p>
        </Card>
        <p className="leading-loose text-ink-2">
          確度は多数決の結果であって、正しさの証明ではありません。少数説が正しいことも当然あります。
          だから対立する説も地図から消さず、点線のピンとして残しています。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">参加のしかた</h2>
        <ol className="space-y-4">
          {[
            ["記述を登録する", "場所が特定できそうな一節を切り出します。特定できていない記述こそ歓迎です。"],
            ["候補を出す", "地図上の一点と、そう考えた根拠をセットで投稿します。根拠のない候補は投稿できません。"],
            ["投票する", "納得できる説に賛成、無理があると思う説に反対。同じボタンをもう一度押すと取り消せます。"],
            ["議論する", "反対票だけ入れて去るより、なぜそう思うかを一行書き残すほうが、地図はずっと良くなります。"],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="font-serif text-lg text-shu">{["一", "二", "三", "四"][i]}</span>
              <div>
                <h3 className="font-bold">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">引用について</h2>
        <p className="leading-loose text-ink-2">
          記述には「本文引用」と「場面の記述」の2種類があります。著作権の保護期間が終わっていない作品では、
          本文をそのまま写すのではなく、場面を自分の言葉で説明する形をとってください。
          アニメや映画のように文章のない作品も、場面の記述として登録できます。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">注意</h2>
        <ul className="list-disc space-y-2 pl-5 leading-loose text-ink-2">
          <li>初期データはサンプルです。座標や比定を含め、正確性を保証するものではありません。</li>
          <li>
            実在の場所には、そこで暮らし、働いている人がいます。私有地や住宅の特定・公開は行わないでください。
          </li>
          <li>地図は OpenStreetMap のデータを利用しています。</li>
        </ul>
      </section>

      <div className="flex gap-3 border-t border-rule pt-6">
        <Link href="/works" className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90">
          作品から探す
        </Link>
        <Link
          href="/register"
          className="rounded border border-rule-2 px-5 py-2.5 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
        >
          参加する
        </Link>
      </div>
    </div>
  );
}
