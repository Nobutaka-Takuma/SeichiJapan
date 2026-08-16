import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "このサイトについて",
  description: "場所ごとの項目をみんなで書き足していく、小説とアニメの地図帳。参加のしかたと決まりごと。",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="border-b border-rule pb-6">
        <h1 className="font-serif text-3xl font-bold tracking-wide">このサイトについて</h1>
        <p className="mt-3 leading-loose text-ink-2">
          聖地日本は、小説やアニメに出てくる場所を地図の上に集め、
          その場所についての知識をみんなで書き足していく地図帳です。
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">場所が主役です</h2>
        <p className="leading-loose text-ink-2">
          どこがどのシーンの場所かは、たいていファンの間ではもう分かっています。
          足りないのは、それが<strong className="font-bold text-ink">一箇所にまとまっていない</strong>ことです。
        </p>
        <p className="leading-loose text-ink-2">
          だからこのサイトの中心は、場所ごとの<strong className="font-bold text-ink">項目</strong>です。
          その場所がどんなところか、どの作品のどのシーンに出てくるか、どう行けばいいか、
          訪ねるときに何に気をつけるべきか。ひとつのページにまとめ、
          <strong className="font-bold text-ink">誰でも書き足せる</strong>ようにしています。
        </p>
        <p className="leading-loose text-ink-2">
          場所の解説だけでなく、<strong className="font-bold text-ink">シーンの記述そのもの</strong>
          も誰でも直せます。話数の間違い、曖昧な場面の説明、差し替えたほうがいい画像。
          気づいた人が直せば、それだけ地図帳の精度が上がります。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">誰でも編集できます</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["編集に許可はいりません", "ログインしていれば、どの項目でもすぐ直せます。誤字ひとつ、写真1枚でも十分な貢献です。"],
            ["すべて履歴に残ります", "いつ誰が何を変えたかが版として残り、前の版との差分が行単位で見られます。"],
            ["いつでも戻せます", "おかしな変更は、履歴から一手で差し戻せます。差し戻したこと自体も履歴に残ります。"],
          ].map(([t, d]) => (
            <Card key={t} className="p-5">
              <h3 className="font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">地図から書き込む</h2>
        <p className="leading-loose text-ink-2">
          作品ページを探さなくても、<Link href="/map" className="font-bold text-shu hover:underline">全国地図</Link>
          を開いて場所をクリックすれば、その場で「ここは○○のあのシーン」を登録できます。
          近くにすでに登録された場所があれば候補として出るので、
          同じ場所の項目が二重にできることを防げます。
        </p>
        <Card className="p-6">
          <ol className="space-y-3 text-sm leading-relaxed text-ink-2">
            <li>
              <b className="text-ink">0.</b> 地図の上の検索欄に「新宿区」「沼津市」のような地名を入れると、
              その周辺まで一息で移動します。目的地まで何度も拡大縮小する必要はありません
            </li>
            <li>
              <b className="text-ink">1.</b> 地図をクリックして地点を決める（ピンはドラッグで微調整できます）
            </li>
            <li>
              <b className="text-ink">2.</b> 近くの場所から選ぶか、新しい場所として登録する
              （すでにピンが立っている場所なら、そのピンを押すだけで選べます）
            </li>
            <li>
              <b className="text-ink">3.</b> 作品を選ぶ。入力すると候補が絞り込まれ、
              一覧に無ければその場で新しい作品として登録できます
            </li>
            <li>
              <b className="text-ink">4.</b> 画像を添える。アニメなら場面の画像、小説なら本文の描写にあたるもの
            </li>
          </ol>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">画像について</h2>
        <p className="leading-loose text-ink-2">
          <strong className="font-bold text-ink">自分で撮影した現地の写真を推奨します。</strong>
          作品の映像・挿絵・スクリーンショットは権利者のものです。
          引用の範囲を超える転載は避けてください。権利者から求めがあれば削除します。
        </p>
        <p className="leading-loose text-ink-2">
          撮影者や出典が分かる場合は、画像に添えて記録してください。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">訪ねるための機能</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              "近くの聖地",
              "現在地から近い順に、徒歩の目安つきで並べます。旅先で「いま何が近いか」を調べるための画面です。地名を入れて調べることもできます。",
            ],
            [
              "巡礼コース",
              "回る順に地点を並べたもの。地点間の距離と所要の目安が出ます。地図アプリにその順で渡せるので、現地では案内に従うだけで回れます。",
            ],
            [
              "訪問の記録",
              "行った場所に印を付けられます。コースの踏破率が進み、自分のページに足跡が残ります。",
            ],
          ].map(([t, d]) => (
            <Card key={t} className="p-5">
              <h3 className="font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </Card>
          ))}
        </div>
        <p className="leading-loose text-ink-2">
          コースは、迎える側が「うちの町の回り方」を示すのにも使えます。
          <Link href="/areas" className="font-bold text-shu hover:underline">
            地域から探す
          </Link>
          では、市区町村ごとにその土地の聖地・作品・訪問記録の数を見渡せます。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">読んで迷子になる</h2>
        <p className="leading-loose text-ink-2">
          項目から項目へ辿れるようにしてあります。同じ作品に出てくる別の場所、同じ町の別の作品、
          本文から張られたリンク、そしてこの項目に言及している項目。
          行く予定がなくても、拾い読みしているうちに時間が溶けるのが、この手の事典の良さだと思っています。
        </p>
        <p className="leading-loose text-ink-2">
          記事の本文に <code className="rounded bg-paper-2 px-1">[[別の場所の名前]]</code>{" "}
          と書くと、その項目へのリンクになります。まだ無い項目への赤リンクも、
          誰かが書けば埋まります。行き先を決めずに歩きたいときは{" "}
          <Link href="/random" prefetch={false} className="font-bold text-shu hover:underline">
            おまかせ
          </Link>
          をどうぞ。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">いいね</h2>
        <p className="leading-loose text-ink-2">
          行ってよかった場所、よく書けている項目にいいねを付けてください。
          いいねの多い場所は地図のピンが大きくなり、一覧の上に出ます。
          「どこから回ればいいか」の目印になります。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">まれに、説が割れたとき</h2>
        <p className="leading-loose text-ink-2">
          ほとんどの場所は決まっています。ただし古い小説などでは、
          本文に固有名が書かれておらず、どこを指すのか意見が分かれることがあります。
        </p>
        <p className="leading-loose text-ink-2">
          そういうときだけ、ひとつのシーンに複数の候補を並べ、根拠を書いて投票します。
          票の比率から<strong className="font-bold text-ink">確度</strong>が出て、地図には対立する説も点線のピンで残ります。
        </p>
        <Card className="p-6">
          <p className="font-mono text-sm text-ink-2">
            重み = max(0, 賛成 − 反対) + 0.5
            <br />
            確度 = その説の重み ÷ すべての説の重みの合計
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            末尾の <b>+0.5</b> は、票が少ないうちに確度が振り切れないようにするための補正です。
            異説が出ていないシーンでは確度の数字は表示しません。
            確度は多数決の結果であって、正しさの証明ではありません。
          </p>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">訪ねるときのお願い</h2>
        <ul className="list-disc space-y-2 pl-5 leading-loose text-ink-2">
          <li>
            聖地の多くは、人が暮らし、働いている場所です。住宅街の道、駅のホーム、営業中の店。
            長時間の滞在、車道での撮影、私有地への立ち入りはやめてください。
          </li>
          <li>
            コースを作るときは、無理のない順番と所要時間を書いてください。
            表示される距離は直線距離で、実際の道のりはもっと長くなります。
          </li>
          <li>個人の住宅の特定・公開は行わないでください。</li>
          <li>行き方の欄には、周囲に迷惑をかけずに訪れるための情報を書いてください。</li>
          <li>初期データはサンプルです。座標や記述の正確性は保証しません。気づいたら直してください。</li>
          <li>地図は OpenStreetMap のデータを利用しています。</li>
        </ul>
      </section>

      <div className="flex gap-3 border-t border-rule pt-6">
        <Link href="/map" className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90">
          地図に書き込む
        </Link>
        <Link
          href="/places"
          className="rounded border border-rule-2 px-5 py-2.5 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
        >
          聖地を見てまわる
        </Link>
      </div>
    </div>
  );
}
