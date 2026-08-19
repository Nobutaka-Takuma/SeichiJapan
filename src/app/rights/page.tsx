import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "引用と権利について",
  description: "作品の一場面をどう扱うか、権利者の方からの連絡先。",
};

export default function RightsPage() {
  const contact = process.env.SEICHI_CONTACT ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="border-b border-rule pb-5">
        <h1 className="font-serif text-2xl font-bold tracking-wide sm:text-3xl">引用と権利について</h1>
        <p className="mt-3 leading-loose text-ink-2">
          聖地の魅力は、作品の場面と実際の風景が重なるところにあります。
          その重なりを示すために、作品の一場面を引くことがあります。
          どういう形なら載せてよいと考えているかを、ここに書いておきます。
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">まず、現地の写真を</h2>
        <p className="leading-loose text-ink-2">
          いちばん勧めたいのは、<strong className="font-bold text-ink">自分で撮った現地の写真</strong>です。
          権利の心配がなく、季節や時間帯の違いも写り、
          「いま行くとこう見える」という、作品にはない情報が加わります。
        </p>
        <p className="leading-loose text-ink-2">
          写真は<strong className="font-bold text-ink">1か所に何枚でも</strong>載せられます。
          誰かの写真を消さないと自分の写真を載せられない、ということはありません。
          同じ場所でも、季節・時刻・訪れた年で見え方は変わります。積み上がるほど、その場所の姿は正確になります。
          消せるのは<strong className="font-bold text-ink">自分が載せた写真だけ</strong>です。
        </p>
        <p className="leading-loose text-ink-2">
          <Link href="/guess" className="font-bold text-shu hover:underline">
            この場面はどこ？
          </Link>
          の手がかりにも、現地の写真が使われます。写真が増えるほど遊びが面白くなります
          （同じ場所でも、そのとき載っている写真から1枚が選ばれます）。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">作品からの引用</h2>
        <p className="leading-loose text-ink-2">
          場面そのものを見せないと伝わらないことがあります。そのときは
          <strong className="font-bold text-ink">引用</strong>として載せられるようにしています。
          引用として成り立つために、次の形を守っています。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            [
              "どこからが引用か分かるようにする",
              "引用は枠で囲い、「引用」の札を付けて表示します。こちらが書いた文章と混ざらないようにするためです。",
            ],
            [
              "出所を必ず添える",
              "作品名と作者は作品の側にあるので、あとは「どの部分か」だけ書いてもらいます（話数や巻・ページ）。章・話数の欄に書いてあればそれで足ります。出版社・配信元は、分かれば添えてください。",
            ],
            [
              "説明が主、引用が従",
              "引用だけを置くことはできません。あなた自身の説明を添えたうえで、その裏づけとして載せてください。",
            ],
            [
              "必要な範囲にとどめる",
              "1シーンにつき1点まで。大きく表示せず、拡大表示のリンクも付けません。連続した場面を並べることもしません。",
            ],
          ].map(([t, d]) => (
            <Card key={t} className="p-5">
              <h3 className="font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </Card>
          ))}
        </div>
        <p className="leading-loose text-ink-2">
          遊びの手がかりには、<strong className="font-bold text-ink">引用画像を使いません</strong>。
          引用は説明の裏づけとして載せるものなので、遊びの題材にすると、その目的から外れてしまうからです。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">やってはいけないこと</h2>
        <ul className="list-disc space-y-2 pl-5 leading-loose text-ink-2">
          <li>作品の画像を、説明を付けずに並べること</li>
          <li>連続した場面をまとめて載せること（作品の代わりになってしまいます）</li>
          <li>出所を書かずに載せること</li>
          <li>他人が撮った写真を、断りなく現地写真として載せること</li>
          <li>個人の住宅や私有地を特定して公開すること</li>
        </ul>
      </section>

      <section className="space-y-4 border-t border-rule pt-6">
        <h2 className="font-serif text-xl font-bold tracking-wide">権利者の方へ</h2>
        <p className="leading-loose text-ink-2">
          掲載を望まれない場合は、お知らせください。
          <strong className="font-bold text-ink">内容を確認のうえ、速やかに削除します。</strong>
          判断の前に取り下げを求められた場合も、まず外すことを優先します。
        </p>
        <p className="leading-loose text-ink-2">
          お知らせいただく際、対象のページのURLを添えていただけると早く対応できます。
        </p>
        {contact ? (
          <p className="leading-loose text-ink-2">
            連絡先：
            <a href={contact} className="font-bold text-shu hover:underline" rel="noopener noreferrer">
              {contact}
            </a>
          </p>
        ) : (
          <p className="rounded-md border border-dashed border-rule-2 px-4 py-3 text-sm text-ink-3">
            連絡先はまだ設定されていません（運営者の方へ：環境変数
            <code className="mx-1 rounded bg-paper-2 px-1">SEICHI_CONTACT</code>
            に連絡先のURLを設定してください）。
          </p>
        )}
        <p className="text-sm leading-relaxed text-ink-3">
          削除したことは記録に残ります（誰が・何を・なぜ）。
          同じものが再び投稿された場合も、同じ扱いをします。
        </p>
      </section>
    </div>
  );
}
