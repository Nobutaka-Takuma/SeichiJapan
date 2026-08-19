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
            ["ログインは要りません", "思いついたときに、そのまま直せます。誤字ひとつ、写真1枚でも十分な貢献です。名乗りたくなったら、あとからアカウントを作れます。"],
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
        <h2 className="font-serif text-xl font-bold tracking-wide">名乗らずに書けます</h2>
        <p className="leading-loose text-ink-2">
          編集も、シーンの登録も、議論への書き込みも、
          <strong className="font-bold text-ink">ログインなしでできます</strong>。
          思いついたときに直せることのほうが、名前が揃っていることより大事だと考えています。
        </p>
        <p className="leading-loose text-ink-2">
          名乗らずに書いた分は「匿名 a3f2」のような名前で記録されます。
          この名前はお使いのブラウザごとに決まるもので、個人を特定するものではありません。
          同じブラウザから書けば同じ名前になるので、その人の書いたものをまとめて見ることはできます。
        </p>
        <p className="leading-loose text-ink-2">
          あとから<Link href="/register" className="font-bold text-shu hover:underline">アカウントを作る</Link>と、
          <strong className="font-bold text-ink">それまでに書いた分もそのまま引き継がれます</strong>。
          先に書いて、気に入ったら名乗る、で構いません。
        </p>
        <Card className="p-6">
          <p className="text-sm font-bold text-ink-2">ログインが要るのは、この3つだけです</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
            <li>
              <b className="text-ink">旅の記録</b>（行った場所・コースの踏破）
              — あなたのものとして残るものだからです
            </li>
            <li><b className="text-ink">いいね</b> — 1人1回で数えるためです</li>
            <li><b className="text-ink">投票</b> — 1人1票で確度を出すためです</li>
          </ul>
        </Card>
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
          画像には<strong className="font-bold text-ink">「現地の写真」と「作品からの引用」の別</strong>があります。
          投稿するときにどちらかを選んでください。扱いが変わります。
        </p>
        <p className="leading-loose text-ink-2">
          <strong className="font-bold text-ink">現地の写真</strong>は、自分で撮ったものを使ってください。
          いちばん勧めたいのはこちらです。権利の心配がなく、季節や時間帯の違いも写り、
          「いま行くとこう見える」という、作品にはない情報が加わります。
        </p>
        <p className="leading-loose text-ink-2">
          現地の写真は<strong className="font-bold text-ink">1か所に何枚でも</strong>載せられます。
          誰かの写真を消してから載せる、ということはしなくて構いません。
          自分が載せた写真は、自分でいつでも外せます。
        </p>
        <p className="leading-loose text-ink-2">
          <strong className="font-bold text-ink">作品からの引用</strong>は、
          場面そのものを見せないと伝わらないときのためのものです。
          掲載箇所と出典を書いてもらい、掲載時は「引用」と分かる枠で囲って出します。
          あなた自身の説明を添えていない引用は保存できません。詳しくは{" "}
          <Link href="/rights" className="font-bold text-shu hover:underline">
            引用と権利について
          </Link>
          をご覧ください。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">この場面はどこ？</h2>
        <p className="leading-loose text-ink-2">
          手がかりを見て、地図の上で場所を当てる遊びです。近いほど高得点。
          答え合わせのあと、その場所の項目や行き方へ進めます。
          知らない作品の知らない土地に出会う入口としても使えます。
        </p>
        <p className="leading-loose text-ink-2">
          手がかりに使うのは、投稿者が撮った現地の写真と、投稿者が自分の言葉で書いた場面の記述、
          それに保護期間の終わった作品の本文です。
          <strong className="font-bold text-ink">作品から引用した画像は、遊びの題材には使いません。</strong>
          引用は説明の裏づけとして載せるものだからです。
        </p>
        <p className="leading-loose text-ink-2">
          <Link href="/guess" className="font-bold text-shu hover:underline">
            遊んでみる
          </Link>
          ／ 手がかりを増やすには、
          <Link href="/scenes/new" className="font-bold text-shu hover:underline">
            現地の写真を添えてシーンを登録
          </Link>
          してください。
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
          どのページも行き止まりにならないようにしてあります。場所からは、同じ作品に出てくる別の場所、
          同じ町の別の作品、本文から張られたリンク、この項目に言及している項目へ。
          シーンからは、同じ作品の前後のシーン、同じ場所で描かれた別の作品のシーン、
          その場所の近くで描かれた場所へ。作品からは、舞台が重なる別の作品と、その舞台の地域へ。
          行く予定がなくても、拾い読みしているうちに時間が溶けるのが、この手の事典の良さだと思っています。
        </p>
        <p className="leading-loose text-ink-2">
          記事の本文にも、シーンの注記にも、
          <code className="rounded bg-paper-2 px-1">[[別の場所の名前]]</code>{" "}
          と書くと、その項目へのリンクになります。まだ無い項目への赤リンクも、
          誰かが書けば埋まります。行き先を決めずに歩きたいときは{" "}
          <Link href="/random" prefetch={false} className="font-bold text-shu hover:underline">
            おまかせ
          </Link>
          （
          <Link href="/random?kind=passage" prefetch={false} className="font-bold text-shu hover:underline">
            シーンのおまかせ
          </Link>
          ）をどうぞ。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-bold tracking-wide">消されることについて</h2>
        <p className="leading-loose text-ink-2">
          間違いは<strong className="font-bold text-ink">直せば済みます</strong>。
          おかしな変更は履歴から一手で差し戻せるので、ふつうは削除の出番はありません。
        </p>
        <p className="leading-loose text-ink-2">
          それでも消さざるを得ないものがあります。宣伝目的の書き込み、
          権利者から申し立てのあった画像、間違って二重に作られた項目。
          これらは管理者が消せるようにしてあります。
          <strong className="font-bold text-ink">削除は元に戻せません</strong>が、
          誰が何をなぜ消したかは必ず記録に残ります。
        </p>
        <p className="leading-loose text-ink-2">
          自分の書いたものが消えていて納得がいかないときは、記録に残っている理由を
          手がかりに、書き直すか、議論の場で声を上げてください。
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
