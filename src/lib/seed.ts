import type Database from "better-sqlite3";
import { hashPassword } from "./password";

/**
 * 初期データ。
 *
 * 本文の引用はパブリックドメイン作品（夏目漱石・川端康成）のみ verbatim で収録し、
 * 著作権の生きている作品は「場面の記述」（kind='scene'）として要約で登録している。
 * 座標・比定・確度はいずれもサンプルであり、正しさを保証するものではない。
 * ——それを利用者の手で直していくことがこのサービスの目的。
 */

export const DEMO_PASSWORD = "seichi2024";

type SeedIdent = {
  place: string;
  rationale: string;
  evidence?: "guess" | "research" | "official";
  source_url?: string;
  by: string;
  up: number;
  down?: number;
};

type SeedPassage = {
  chapter?: string;
  kind?: "text" | "scene";
  quote: string;
  note?: string;
  by: string;
  idents: SeedIdent[];
  comments?: { by: string; body: string; on?: string }[];
};

type SeedWork = {
  slug: string;
  title: string;
  author: string;
  medium: "novel" | "anime" | "manga" | "film";
  year: number;
  description: string;
  passages: SeedPassage[];
};

const CONTRIBUTORS: { handle: string; name: string; bio: string }[] = [
  { handle: "soseki_walk", name: "漱石散歩", bio: "漱石作品の舞台を歩いて確かめています。明治期の東京市街図が愛読書。" },
  { handle: "kobo_map", name: "古地図倶楽部", bio: "明治・大正の地形図と現在地の照合が趣味。道の勾配から場所を割り出します。" },
  { handle: "kamakura_lo", name: "鎌倉在住", bio: "鎌倉生まれ。海と谷戸のことなら少しは分かります。" },
  { handle: "numazu_p", name: "沼津P", bio: "内浦・三津・沼津港を自転車で往復する日々。" },
  { handle: "hida_note", name: "飛騨ノート", bio: "飛騨地方の風景と作品の対応をメモしています。" },
  { handle: "bungei_ta", name: "文芸助手", bio: "近代文学の演習TA。出典の確認だけはうるさいです。" },
  { handle: "trip_log", name: "巡礼ログ", bio: "行った場所を記録するだけの人。写真と座標は残します。" },
  { handle: "yukiguni_r", name: "雪国鉄", bio: "上越線と信号場の歴史を追っています。" },
  { handle: "matsuyama_k", name: "松山経由", bio: "四国の近代建築と文学。道後には月2で行きます。" },
  { handle: "shonan_rail", name: "湘南レイル", bio: "江ノ電沿線の風景の変遷を撮り続けています。" },
];

/** 投票プールとなる一般ユーザーのハンドルを決定的に生成する。 */
function voterHandles(): string[] {
  const heads = ["yomite", "aruki", "shiori", "hyoushi", "kaidoku", "michikusa", "hondana", "kikou"];
  const tails = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];
  const out: string[] = [];
  for (const h of heads) for (const t of tails) out.push(`${h}_${t}`);
  return out; // 80人
}

const WORKS: SeedWork[] = [
  {
    slug: "kokoro",
    title: "こころ",
    author: "夏目漱石",
    medium: "novel",
    year: 1914,
    description:
      "「私」と「先生」の交わり、そして先生の遺書。鎌倉の海で始まり、東京の下宿町と墓地を巡る。作中の地名は東京・鎌倉に集中するが、具体的な地点を書かない箇所が多く、比定の余地が大きい。",
    passages: [
      {
        chapter: "上 先生と私・二",
        kind: "text",
        quote: "私が先生と知り合になったのは鎌倉である。",
        note: "「私」が先生を初めて見かけるのは鎌倉の海水浴場。作中では海岸の固有名が示されない。掛茶屋が並び、東京からの客で賑わう描写が手がかりになる。",
        by: "soseki_walk",
        idents: [
          {
            place: "由比ヶ浜",
            evidence: "research",
            by: "kamakura_lo",
            rationale:
              "明治末の鎌倉で「海水浴場」といえばまず由比ヶ浜。海の家の前身である掛茶屋が並び、東京からの避暑客で混み合った。作中の「大変な人」という描写と規模が一致する。",
            up: 20,
            down: 1,
          },
          {
            place: "材木座海岸",
            evidence: "guess",
            by: "kobo_map",
            rationale:
              "先生が毎日同じ場所に現れ、「私」が顔を覚えられる程度の人出しかない。由比ヶ浜の混雑ではそうならないのでは。滑川を挟んだ東側の材木座を推したい。",
            up: 3,
          },
        ],
        comments: [
          {
            by: "kobo_map",
            body: "この「海岸」、たぶん由比ヶ浜のことじゃないでしょうか。ただ人の多さの描写と、先生を毎日見つけられる距離感が噛み合わない気もします。",
          },
          {
            by: "kamakura_lo",
            body: "いや、由比ヶ浜でいいと思います。当時の海水浴場は長い砂浜のうちごく一部（茶屋の並ぶあたり）に人が固まっていたので、常連同士は自然と顔を覚えます。",
          },
          {
            by: "bungei_ta",
            body: "同時代の鎌倉案内を見ると、海水浴場としての設備があるのは由比ヶ浜側だけです。材木座は昭和に入ってから。作中の年代を考えると由比ヶ浜が有力かと。",
          },
          {
            by: "trip_log",
            body: "現地で見ると、材木座からは稲村ヶ崎が正面に見えます。作中に山の描写がほとんど出てこないのは、視界が開けた由比ヶ浜寄りだからでは。",
          },
        ],
      },
      {
        chapter: "上 先生と私・四",
        kind: "scene",
        quote: "先生が月に一度、決まって花と線香を持って訪れる墓地。「私」が偶然そこで先生に出会う。",
        note: "作中で地名は明示される数少ない例。現在の霊園のどの区画かまでは特定されていない。",
        by: "soseki_walk",
        idents: [
          {
            place: "雑司ヶ谷霊園",
            evidence: "official",
            by: "bungei_ta",
            rationale: "作中に地名がそのまま書かれている。漱石自身の墓も同霊園にある。",
            up: 21,
          },
        ],
      },
      {
        chapter: "上 先生と私",
        kind: "scene",
        quote: "「私」が足しげく通う、先生の家のある町。門を入ってすぐの座敷から庭が見える構えで、坂の上にあると読める。",
        note: "作中で番地はもちろん町名も特定されない。「私」の下宿からの距離、市電の使い方、坂の描写が手がかり。諸説あり。",
        by: "bungei_ta",
        idents: [
          {
            place: "小石川",
            evidence: "guess",
            by: "soseki_walk",
            rationale: "漱石自身が住んだ土地であり、坂の多い地形が描写と合う。作者の生活圏から書いたと考えるのが自然。",
            up: 4,
            down: 2,
          },
          {
            place: "本郷",
            evidence: "guess",
            by: "kobo_map",
            rationale: "「私」が大学生であることを踏まえると、徒歩圏の本郷台の方が往来の頻度と釣り合う。",
            up: 3,
            down: 1,
          },
        ],
        comments: [
          {
            by: "kobo_map",
            body: "作者の生活圏から考えるという筋は分かるのですが、それは作者の話であって作中人物の話ではないはず。「私」の移動時間の描写から詰めたいところ。",
          },
          {
            by: "soseki_walk",
            body: "そこは同意です。ただ坂と庭の描写は小石川台のそれに近い。決め手に欠けるので、当面は両論併記でいいと思っています。",
          },
        ],
      },
    ],
  },
  {
    slug: "sanshiro",
    title: "三四郎",
    author: "夏目漱石",
    medium: "novel",
    year: 1908,
    description:
      "熊本から上京した小川三四郎が見る東京。大学構内の池、上野の西洋料理店、本郷の下宿町。実在の店名・地名がそのまま出てくる箇所が多く、比定の難度は低いが、下宿の位置などには議論がある。",
    passages: [
      {
        chapter: "四",
        kind: "scene",
        quote: "三四郎が誘われて出かける、上野の西洋料理店での会。作中でその店は実名で呼ばれる。",
        note: "明治期を代表する西洋料理店。上野公園内の本店とみられる。",
        by: "bungei_ta",
        idents: [
          {
            place: "上野精養軒",
            evidence: "official",
            by: "bungei_ta",
            rationale: "作中に店名がそのまま記される。当時の上野公園内の本店にあたる。",
            up: 12,
          },
        ],
      },
      {
        chapter: "二",
        kind: "scene",
        quote: "三四郎が大学構内の池のほとりで、団扇を持った女性を見上げる場面。",
        note: "この小説にちなんで、後にこの池が通称で呼ばれるようになった。",
        by: "soseki_walk",
        idents: [
          {
            place: "三四郎池（育徳園心字池）",
            evidence: "official",
            by: "soseki_walk",
            rationale: "東京大学本郷キャンパス内の池。作品にちなむ通称が定着している。",
            up: 34,
          },
        ],
      },
      {
        chapter: "三",
        kind: "scene",
        quote: "三四郎が上京後に落ち着く下宿のある町。大学までは歩いて通える距離に描かれる。",
        note: "本郷台のどこか、とされるが特定はされていない。",
        by: "kobo_map",
        idents: [
          {
            place: "西片町",
            evidence: "guess",
            by: "kobo_map",
            rationale: "当時の学生・教員の下宿が集中した町。大学までの距離感が合う。",
            up: 5,
          },
          {
            place: "本郷菊坂",
            evidence: "guess",
            by: "soseki_walk",
            rationale: "下宿屋の密度でいえば菊坂界隈。坂を上って通学する描写と整合する。",
            up: 4,
            down: 1,
          },
        ],
      },
    ],
  },
  {
    slug: "botchan",
    title: "坊っちゃん",
    author: "夏目漱石",
    medium: "novel",
    year: 1906,
    description:
      "江戸っ子の新任教師が四国の中学校に赴任する。地名はほとんど伏せられ、「住田の温泉」のように作中名で書かれるため、現実の地点との対応づけが必要になる。",
    passages: [
      {
        chapter: "三",
        kind: "scene",
        quote: "赴任先で唯一気に入り、毎日のように通う温泉。作中では「住田の温泉」と呼ばれる。",
        note: "作中名と実在名が異なる典型例。",
        by: "matsuyama_k",
        idents: [
          {
            place: "道後温泉本館",
            evidence: "research",
            by: "matsuyama_k",
            rationale:
              "漱石の松山中学赴任時期と、当時すでに現在の本館が竣工していた時期が重なる。市内から汽車で通える距離という描写も道後と合う。",
            up: 28,
            down: 1,
          },
        ],
      },
      {
        chapter: "二",
        kind: "scene",
        quote: "坊っちゃんが数学教師として赴任する中学校。生徒との衝突の舞台になる。",
        by: "matsuyama_k",
        idents: [
          {
            place: "旧制松山中学（現・松山東高等学校）",
            evidence: "research",
            by: "matsuyama_k",
            rationale: "漱石が実際に英語教師として赴任した学校。作中の設定と重なる部分が多い。",
            up: 9,
          },
        ],
      },
    ],
  },
  {
    slug: "yukiguni",
    title: "雪国",
    author: "川端康成",
    medium: "novel",
    year: 1937,
    description:
      "島村が雪国の温泉町へ通う。冒頭のトンネルと信号所は上越線の実在の設備を指すと考えられているが、作中に固有名は出てこない。",
    passages: [
      {
        chapter: "冒頭",
        kind: "text",
        quote: "国境の長いトンネルを抜けると雪国であった。夜の底が白くなった。",
        note: "「国境」は上野国と越後国、すなわち群馬・新潟県境。当時の上越線でこれに当たる長大トンネルは限られる。",
        by: "yukiguni_r",
        idents: [
          {
            place: "清水トンネル",
            evidence: "research",
            by: "yukiguni_r",
            rationale:
              "作品執筆時、群馬・新潟県境を貫いていた上越線の長大トンネル。全長約9.7km で「長いトンネル」の描写に符合する。",
            up: 24,
            down: 1,
          },
        ],
      },
      {
        chapter: "一",
        kind: "scene",
        quote: "トンネルを抜けた汽車が停まる信号所。駅ではなく信号所であることが明記される。",
        note: "当時、トンネル出口の直後にあった信号場が候補になる。",
        by: "yukiguni_r",
        idents: [
          {
            place: "土樽駅（旧・土樽信号場）",
            evidence: "research",
            by: "yukiguni_r",
            rationale: "清水トンネル新潟側の出口直後に置かれていた信号場。のちに駅へ昇格した。位置関係が本文の順序と一致する。",
            up: 11,
          },
          {
            place: "越後中里駅",
            evidence: "guess",
            by: "trip_log",
            rationale: "汽車が停まる描写から、旅客扱いのある駅と読む余地もあるのでは。",
            up: 4,
            down: 2,
          },
        ],
      },
      {
        chapter: "一",
        kind: "scene",
        quote: "島村が繰り返し訪れる、雪深い温泉町。駒子と出会う宿がある。",
        note: "川端が実際に逗留した宿がある町として知られる。",
        by: "yukiguni_r",
        idents: [
          {
            place: "越後湯沢",
            evidence: "official",
            by: "bungei_ta",
            rationale: "作者が執筆時に長期滞在した温泉町。宿も現存し、作品との関係が公にされている。",
            up: 33,
          },
        ],
      },
    ],
  },
  {
    slug: "love-live-sunshine",
    title: "ラブライブ！サンシャイン!!",
    author: "サンライズ",
    medium: "anime",
    year: 2016,
    description:
      "静岡県沼津市・内浦を舞台にしたスクールアイドルの物語。背景美術が実在の風景をほぼそのまま写しており、比定の精度が高い作品の代表例。",
    passages: [
      {
        kind: "scene",
        quote: "主人公たちが東京へ向かうときに使う、市街地側の鉄道駅。駅前のロータリーと商店街が繰り返し描かれる。",
        by: "numazu_p",
        idents: [
          {
            place: "沼津駅",
            evidence: "official",
            by: "numazu_p",
            rationale: "駅舎・ホーム・駅前の構造が背景美術とほぼ一致する。市の観光案内でも舞台として扱われている。",
            up: 41,
          },
        ],
      },
      {
        kind: "scene",
        quote: "部員を集めるために訪れる、水族館のある島。渡船で渡り、対岸に富士山が見える。",
        by: "numazu_p",
        idents: [
          {
            place: "淡島",
            evidence: "research",
            by: "numazu_p",
            rationale: "内浦湾に浮かぶ小島で、渡船と水族館という条件を満たす。島影のシルエットが背景と一致する。",
            up: 18,
            down: 1,
          },
        ],
      },
      {
        kind: "scene",
        quote: "合宿で泊まる、海に面した木造三階建ての旅館。",
        by: "trip_log",
        idents: [
          {
            place: "安田屋旅館",
            evidence: "official",
            by: "trip_log",
            rationale: "内浦の海沿いに建つ木造三階建ての旅館。外観・階段の構造が作中の描写と一致する。",
            up: 27,
          },
        ],
      },
      {
        kind: "scene",
        quote: "1年生の3人が海を眺めながら話す、漁港の堤防。奥に小さな灯台が見える。",
        note: "内浦の漁港はいくつかあり、堤防の形が似ているため決め手に欠ける。要検証。",
        by: "numazu_p",
        idents: [
          {
            place: "内浦漁港",
            evidence: "guess",
            by: "numazu_p",
            rationale: "堤防の長さと護岸の形が近い。灯台の位置関係も矛盾しない。",
            up: 6,
          },
          {
            place: "三津浜",
            evidence: "guess",
            by: "trip_log",
            rationale: "背景の山の稜線は三津側から見たものに近いのでは。時間帯の光の向きも気になる。",
            up: 5,
            down: 2,
          },
        ],
        comments: [
          {
            by: "trip_log",
            body: "夕方の逆光で海が光っている構図なので、西を向いていることになります。内浦漁港の堤防だと向きが合わない気がするのですが、どうでしょう。",
          },
          {
            by: "numazu_p",
            body: "堤防は途中で折れているので、先端付近なら西向きの画も撮れます。今度同じ時間帯に行って写真を撮ってきます。",
          },
        ],
      },
    ],
  },
  {
    slug: "kimi-no-na-wa",
    title: "君の名は。",
    author: "新海誠",
    medium: "film",
    year: 2016,
    description:
      "東京と飛騨の町を入れ替わる二人の物語。都内の階段や飛騨地方の風景が実景を元に描かれており、公開後に多くの地点が特定された。",
    passages: [
      {
        kind: "scene",
        quote: "終盤、二人がすれ違い、そして振り返る住宅街の石段。上りきったところに神社の鳥居がある。",
        by: "trip_log",
        idents: [
          {
            place: "須賀神社 男坂",
            evidence: "research",
            by: "trip_log",
            rationale: "階段の段数、両脇の建物、上部の鳥居の位置関係が一致する。公開後に多数の検証記事が出ている。",
            up: 52,
            down: 2,
          },
        ],
      },
      {
        kind: "scene",
        quote: "瀧たちが糸守町の手がかりを探して立ち寄る図書館。",
        note: "飛騨地方の図書館とされるが、どの館かについては複数の指摘がある。",
        by: "hida_note",
        idents: [
          {
            place: "飛騨市図書館",
            evidence: "research",
            by: "hida_note",
            rationale: "外観と閲覧室の吹き抜けの構造が作中の描写と一致する。飛騨市も舞台として案内している。",
            up: 19,
          },
          {
            place: "高山市図書館 煥章館",
            evidence: "guess",
            by: "trip_log",
            rationale:
              "洋風の外観の印象は煥章館に近いという指摘もある。ただし作中の館内の造りは飛騨市図書館の方が合う。",
            up: 3,
            down: 1,
          },
        ],
        comments: [
          {
            by: "hida_note",
            body: "館内の吹き抜けと書架の並びは飛騨市図書館で間違いないと思います。外観の印象だけで煥章館と混同されがちです。",
          },
        ],
      },
      {
        kind: "scene",
        quote: "瀧たちが飛騨に降り立つ駅。ホームと跨線橋、駅前の様子が描かれる。",
        by: "hida_note",
        idents: [
          {
            place: "飛騨古川駅",
            evidence: "research",
            by: "hida_note",
            rationale: "ホームの配置と跨線橋、駅舎の形が一致する。作中で三葉を探しはじめる起点になる。",
            up: 38,
            down: 1,
          },
        ],
      },
      {
        kind: "scene",
        quote: "三葉たちが下校時に使う、山あいの道路沿いのバス停。バスを待つ場面が印象に残る。",
        note: "国道沿いの待合所。周囲に人家が少なく、訪問には車が要る。",
        by: "hida_note",
        idents: [
          {
            place: "落合バス停",
            evidence: "research",
            by: "hida_note",
            rationale: "待合所の形と、背後の山の稜線、道路のカーブの具合が一致する。",
            up: 16,
          },
        ],
      },
      {
        kind: "scene",
        quote: "瀧が奥寺先輩と出かける美術館。ガラス張りの曲面の壁と、逆円錐の上のカフェが描かれる。",
        by: "trip_log",
        idents: [
          {
            place: "国立新美術館",
            evidence: "research",
            by: "trip_log",
            rationale:
              "波打つガラスのファサードと、館内の逆円錐の上にあるカフェは他に類例がない。デートの場面の構図と一致する。",
            up: 24,
          },
        ],
      },
      {
        kind: "scene",
        quote: "瀧が電車を見下ろす歩道橋。奥に線路が並び、都心のビルが見える。",
        note: "似た構図の歩道橋が近隣に複数あり、特定には注意が要る。",
        by: "trip_log",
        idents: [
          {
            place: "信濃町駅前の歩道橋",
            evidence: "guess",
            by: "trip_log",
            rationale: "線路の本数と、正面に見える建物の並びが近い。",
            up: 9,
            down: 2,
          },
        ],
      },
      {
        kind: "scene",
        quote: "瀧の通学路として繰り返し描かれる、外堀沿いの道と駅前。",
        by: "trip_log",
        idents: [
          {
            place: "四ツ谷駅",
            evidence: "research",
            by: "trip_log",
            rationale: "須賀神社からの距離と、外堀沿いの土手・線路の位置関係が作中の移動と合う。",
            up: 13,
          },
        ],
      },
      {
        kind: "scene",
        quote: "三葉たちが神事を行う神社。境内の階段と社殿の配置が印象的に描かれる。",
        note: "飛騨地方の複数の神社の要素が合成されている可能性があり、単一の場所には決めきれない。",
        by: "hida_note",
        idents: [
          {
            place: "気多若宮神社",
            evidence: "guess",
            by: "hida_note",
            rationale: "参道と社殿の配置が近い。飛騨古川の中心部からの距離も作中の移動と矛盾しない。",
            up: 7,
            down: 1,
          },
        ],
      },
    ],
  },
  {
    slug: "slam-dunk",
    title: "SLAM DUNK",
    author: "井上雄彦",
    medium: "manga",
    year: 1990,
    description: "湘南を舞台にした高校バスケットボール漫画。踏切から海を望む構図が特に知られる。",
    passages: [
      {
        kind: "scene",
        quote: "踏切の向こうに海と江ノ電が見える、湘南の海沿いの一場面。",
        by: "shonan_rail",
        idents: [
          {
            place: "鎌倉高校前1号踏切",
            evidence: "research",
            by: "shonan_rail",
            rationale: "江ノ島電鉄の踏切のうち、海・砂浜・線路・江ノ島の位置関係が構図と一致するのはここだけ。",
            up: 45,
            down: 1,
          },
        ],
      },
    ],
  },
];

type SeedPlace = {
  lat: number;
  lng: number;
  pref: string;
  address?: string;
  note?: string;
  body?: string;
  access?: string;
  likes?: number;
};

const PLACES: Record<string, SeedPlace> = {
  由比ヶ浜: { lat: 35.3085, lng: 139.5391, pref: "神奈川県", address: "鎌倉市由比ガ浜", note: "鎌倉を代表する海岸。明治期から海水浴場として賑わった。", body: "鎌倉市南部、相模湾に面した砂浜。滑川の河口を境に、西側を由比ヶ浜、東側を材木座海岸と呼び分けるのが一般的だが、広い意味では一続きの浜として扱われることも多い。\n\n■ 明治期の海水浴場\n明治中期以降、鎌倉は東京からの避暑地として整備が進み、海水浴場としてもっとも賑わったのがこの浜だった。当時は現在の海の家にあたる「掛茶屋」が並び、夏のあいだ客が集まった。近代文学に出てくる「鎌倉の海」の多くは、この情景を下敷きにしている。\n\n■ 作品での扱い\n『こころ』で「私」が先生を見かける海水浴場は、作中では固有名が示されない。掛茶屋の描写や人出の多さから由比ヶ浜とする見方が有力だが、材木座を推す説もある。", access: "江ノ島電鉄「由比ヶ浜駅」から徒歩5分ほど。鎌倉駅からも歩ける。夏季は海水浴客で非常に混雑する。", likes: 34 },
  材木座海岸: { lat: 35.308, lng: 139.549, pref: "神奈川県", address: "鎌倉市材木座", note: "滑川を挟んで由比ヶ浜の東側に続く海岸。", body: "滑川を挟んで由比ヶ浜の東側に続く砂浜。かつて材木の集積地であったことが名の由来とされる。由比ヶ浜に比べると人出は落ち着いている。", access: "鎌倉駅から徒歩15分ほど。", likes: 6 },
  雑司ヶ谷霊園: { lat: 35.7215, lng: 139.7127, pref: "東京都", address: "豊島区南池袋4", note: "夏目漱石、泉鏡花らの墓所がある都立霊園。", body: "東京都豊島区にある都立霊園。1874年に開設された。\n\n■ 文学者の墓所\n夏目漱石、泉鏡花、小泉八雲、永井荷風など、近代文学に関わる人物の墓が多くある。漱石の墓は園内でも大きく、訪れる人が絶えない。\n\n■ 作品での扱い\n『こころ』では、先生が月に一度、友人の墓に参る場所として地名がそのまま書かれている。作中で明示される数少ない地点のひとつ。", access: "東京メトロ副都心線「雑司が谷駅」から徒歩5分。都電荒川線「都電雑司ヶ谷駅」からも近い。墓地なので静かに。", likes: 19 },
  小石川: { lat: 35.718, lng: 139.744, pref: "東京都", address: "文京区小石川", note: "坂の多い台地。漱石の旧居跡も近い。", likes: 3 },
  本郷: { lat: 35.708, lng: 139.76, pref: "東京都", address: "文京区本郷", note: "東京大学に隣接する学生街。", likes: 4 },
  上野精養軒: { lat: 35.7148, lng: 139.7738, pref: "東京都", address: "台東区上野公園4-58", note: "明治期に開業した西洋料理店。上野公園内に本店を構える。", body: "上野公園内にある西洋料理店。1876年に上野に開業し、明治期を代表する洋食の店として知られた。\n\n■ 明治の社交の場\n鹿鳴館時代の前後、西洋料理は限られた人々のものであり、精養軒はその中心的な存在だった。文学作品に「会」の舞台として登場するのは、当時の知識人の集まりが実際にこうした店で開かれていたことの反映でもある。\n\n■ 作品での扱い\n『三四郎』では、店名がそのまま作中に記される。三四郎が誘われて出かける会の場面。", access: "JR上野駅公園口から徒歩5分。上野公園内。", likes: 27 },
  "三四郎池（育徳園心字池）": { lat: 35.7128, lng: 139.7639, pref: "東京都", address: "文京区本郷7-3-1 東京大学構内", note: "旧加賀藩邸の庭園の池。小説にちなむ通称が定着した。", body: "東京大学本郷キャンパスの中にある池。正式には育徳園心字池といい、加賀藩前田家の上屋敷の庭園に由来する。\n\n■ 「三四郎池」という通称\n夏目漱石の『三四郎』で、主人公がこの池のほとりで女性を見上げる印象的な場面が描かれた。以後この通称が定着し、現在では大学の案内図にもこの名で載っている。作品が現実の地名を作った例として知られる。\n\n■ 訪れる際に\nキャンパス内だが一般に開放されている。池の周囲は起伏があり、木々に囲まれて都心とは思えない静けさがある。", access: "東京メトロ丸ノ内線「本郷三丁目駅」から徒歩10分。赤門または正門から入って構内を south へ。足元が滑りやすいので雨の日は注意。", likes: 41 },
  西片町: { lat: 35.7154, lng: 139.753, pref: "東京都", address: "文京区西片", note: "明治期に学者・文人が多く住んだ住宅地。", likes: 2 },
  本郷菊坂: { lat: 35.7098, lng: 139.7546, pref: "東京都", address: "文京区本郷4-5丁目", note: "下宿屋が集中していた坂道。樋口一葉の旧居跡もある。", body: "本郷台地の谷にあたる坂道。明治期には下宿屋が多く集まっていた。樋口一葉が住んだ旧居跡と井戸が近くに残る。", likes: 7 },
  道後温泉本館: { lat: 33.852, lng: 132.7864, pref: "愛媛県", address: "松山市道後湯之町5-6", note: "1894年竣工の共同浴場。国の重要文化財。", body: "松山市道後にある共同浴場。現在の建物は1894年（明治27年）の竣工で、国の重要文化財に指定されている。\n\n■ 木造三層楼\n中央に振鷺閣を頂く木造の楼閣建築。時を告げる太鼓が今も鳴らされる。\n\n■ 作品での扱い\n『坊っちゃん』では「住田の温泉」として登場し、主人公が唯一気に入ったものとして繰り返し通う。漱石が松山中学に赴任していた時期と、この建物が完成した時期は重なっている。", access: "伊予鉄道城南線「道後温泉駅」から徒歩5分。保存修理工事の状況によって入浴できる浴室が変わることがあるため、訪問前に公式の案内を確認するとよい。", likes: 38 },
  "旧制松山中学（現・松山東高等学校）": { lat: 33.8412, lng: 132.771, pref: "愛媛県", address: "松山市持田町2-2-12", note: "漱石が英語教師として赴任した学校の後身。", body: "夏目漱石が1895年に英語教師として赴任した旧制松山中学の後身にあたる高等学校。『坊っちゃん』の中学校のモデルとされる。現役の学校であり、校内の見学はできない。", likes: 5 },
  清水トンネル: { lat: 36.8402, lng: 138.9235, pref: "群馬県／新潟県", address: "上越線 土合〜土樽間", note: "1931年開通。群馬・新潟県境を貫く全長約9.7kmの鉄道トンネル。", body: "上越線の土合・土樽間を貫く鉄道トンネル。1931年に開通し、全長は約9.7km。当時としては国内有数の長大トンネルだった。\n\n■ 「国境の長いトンネル」\n『雪国』の冒頭で島村の乗る汽車が抜けるトンネルは、このトンネルを指すと考えられている。「国境」は上野国（群馬）と越後国（新潟）の境。群馬側と新潟側で気候が大きく変わることが、あの一文の前提になっている。", access: "トンネルそのものには立ち入れない。土合駅・土樽駅から地上の坑口付近を望むことはできる。", likes: 16 },
  "土樽駅（旧・土樽信号場）": { lat: 36.8737, lng: 138.858, pref: "新潟県", address: "南魚沼郡湯沢町土樽", note: "清水トンネル新潟側出口の直後に設けられた信号場が前身。", body: "上越線の駅。清水トンネルの新潟側出口の直後に置かれた信号場が前身で、のちに駅へ昇格した。『雪国』で汽車が停まる「信号所」はこことする説が有力。周囲に人家は少ない。", likes: 8 },
  越後中里駅: { lat: 36.8896, lng: 138.8378, pref: "新潟県", address: "南魚沼郡湯沢町土樽", note: "上越線の駅。", likes: 2 },
  越後湯沢: { lat: 36.9366, lng: 138.8098, pref: "新潟県", address: "南魚沼郡湯沢町湯沢", note: "三国街道沿いの温泉町。川端康成が逗留した宿が現存する。", body: "新潟県南魚沼郡湯沢町の温泉町。三国街道の宿場として発展し、現在は上越新幹線が停まる。\n\n■ 『雪国』の宿\n川端康成は昭和のはじめ、この町の宿に長期滞在しながら『雪国』を書いた。逗留した宿は現在も営業しており、当時の部屋が保存されている。\n\n■ 雪\n豪雪地帯であり、冬の積雪は数メートルに達する。作中の雪の描写は誇張ではない。", access: "上越新幹線「越後湯沢駅」下車。駅から温泉街は徒歩圏。冬は路面の凍結に注意。", likes: 23 },
  沼津駅: { lat: 35.1044, lng: 138.858, pref: "静岡県", address: "沼津市大手町1", note: "東海道本線の駅。内浦方面へのバスが発着する。", body: "静岡県沼津市の中心にある東海道本線の駅。内浦・三津方面へ向かうバスはここから発着する。\n\n■ 聖地巡礼の起点\n内浦を舞台とする作品の巡礼では、多くの人がまずこの駅に降りる。駅前や商店街も作中に描かれており、街のあちこちに関連する掲示が見られる時期がある。\n\n■ 訪れる際に\n駅前から内浦方面へのバスは本数が限られる。時刻表を事前に確認しておくとよい。", access: "JR東海道本線「沼津駅」。内浦方面は南口のバスのりばから。", likes: 45 },
  淡島: { lat: 35.0206, lng: 138.888, pref: "静岡県", address: "沼津市内浦重寺", note: "内浦湾に浮かぶ小島。渡船で渡る。", body: "内浦湾に浮かぶ周囲2.5kmほどの小島。渡船で渡り、島内には水族館やホテルがある。対岸から見た島影は内浦の風景を特徴づけている。", access: "沼津駅からバスで「あわしまマリンパーク前」下車、渡船で島へ。運航状況は事前に確認を。", likes: 21 },
  安田屋旅館: { lat: 35.0186, lng: 138.8853, pref: "静岡県", address: "沼津市内浦三津", note: "海沿いに建つ木造三階建ての旅館。", body: "内浦の海沿いに建つ木造三階建ての旅館。1887年創業と伝わる。\n\n■ 建物\n海に面して建つ木造三層の造りで、国の登録有形文化財。太宰治が『斜陽』を執筆した宿としても知られる。\n\n■ 訪れる際に\n営業中の旅館です。宿泊・食事の利用者以外が館内に立ち入ることはできません。外観の撮影も、他のお客さんや近隣の迷惑にならない範囲で。", access: "沼津駅からバスで「三津シーパラダイス」付近下車、徒歩。", likes: 31 },
  内浦漁港: { lat: 35.0163, lng: 138.8905, pref: "静岡県", address: "沼津市内浦小海", note: "内浦湾の漁港。", body: "内浦湾に面した漁港。堤防の先から駿河湾越しに富士山が見える日がある。現役の漁港であり、作業の妨げにならないよう注意が必要。", access: "沼津駅からバス。漁港内は関係者の作業場です。立入禁止の表示に従ってください。", likes: 9 },
  三津浜: { lat: 35.0203, lng: 138.8865, pref: "静岡県", address: "沼津市内浦三津", note: "内浦湾に面した浜。", likes: 7 },
  "須賀神社 男坂": { lat: 35.6873, lng: 139.7205, pref: "東京都", address: "新宿区須賀町5", note: "四谷の須賀神社へ上る石段。", body: "新宿区須賀町の須賀神社へ上る石段。男坂と呼ばれる急な階段で、上りきったところに鳥居がある。\n\n■ 作品での扱い\nアニメーション映画のラストシーンで、二人がすれ違い、振り返る場所として描かれた。公開後に場所が特定され、多くの人が訪れるようになった。\n\n■ 訪れる際に\nごく普通の住宅街の中の階段です。近隣にお住まいの方の生活道路でもあります。長時間の滞在、車道での撮影、大声はご遠慮ください。", access: "JR・東京メトロ「四ツ谷駅」または「四谷三丁目駅」から徒歩10分ほど。", likes: 52 },
  飛騨市図書館: { lat: 36.241, lng: 137.187, pref: "岐阜県", address: "飛騨市古川町本町2-22", note: "飛騨古川の市立図書館。", body: "岐阜県飛騨市古川町にある市立図書館。2軒の蔵をイメージした外観で、館内は吹き抜けになっている。作品に登場したことで訪れる人が増えた。", access: "JR高山本線「飛騨古川駅」から徒歩5分。開館時間は市の案内を確認してください。図書館なので静かに。", likes: 14 },
  気多若宮神社: { lat: 36.2427, lng: 137.1794, pref: "岐阜県", address: "飛騨市古川町上気多1297", note: "古川祭で知られる神社。", body: "飛騨市古川町の神社。毎年4月の古川祭で知られる。参道の階段と社殿の配置が作中の神社に近いとされるが、作品の神社は複数の場所の要素が合わさっている可能性が高い。", likes: 11 },
  飛騨古川駅: {
    lat: 36.2372,
    lng: 137.1877,
    pref: "岐阜県",
    address: "飛騨市古川町金森町",
    note: "JR高山本線の駅。瀧たちが飛騨に降り立つ場面で描かれる。",
    body: `岐阜県飛騨市古川町にあるJR高山本線の駅。

■ 作品での扱い
瀧・司・奥寺先輩の三人が糸守町を探して降り立つ駅として描かれる。ホームと跨線橋、駅舎の前でスケッチを見せて聞き込みをする場面が続く。

■ 訪れる際に
現役の駅です。ホームや跨線橋での撮影は、列車の運行と他の利用者の妨げにならない範囲で。入場券が必要な区域があります。`,
    access: "JR高山本線「飛騨古川駅」。高山駅から普通列車で15分ほど。飛騨市図書館へは徒歩5分。",
    likes: 29,
  },
  落合バス停: {
    lat: 36.2005,
    lng: 137.0742,
    pref: "岐阜県",
    address: "飛騨市河合町",
    note: "山あいの国道沿いにあるバス停。作中の待合所の場面で知られる。",
    body: `飛騨市河合町、国道沿いにあるバス停の待合所。

■ 作品での扱い
三葉たちが下校時にバスを待つ場面で描かれる。周囲に建物がほとんどない、山あいの風景が印象に残る。

■ 訪れる際に
公共交通の本数が非常に少なく、実質的に車での訪問になります。国道沿いのため、路上駐車や道路上での撮影は危険です。待合所は地域の方が使う施設であることを忘れずに。`,
    access: "飛騨古川駅から車で30分ほど。バスの便は限られます。",
    likes: 12,
  },
  国立新美術館: {
    lat: 35.6654,
    lng: 139.7263,
    pref: "東京都",
    address: "港区六本木7-22-2",
    note: "波打つガラスのファサードで知られる美術館。館内の逆円錐の上にカフェがある。",
    body: `東京・六本木にある美術館。2007年開館。黒川紀章の設計による、波打つガラスのファサードが特徴。

■ 作品での扱い
瀧が奥寺先輩と出かける場面で描かれる。館内の逆円錐の構造物の上にあるカフェは、他に例のない形で、作中の構図の決め手になっている。

■ 訪れる際に
休館日と展覧会の会期は事前に確認を。館内の撮影可否は場所によって異なります。`,
    access: "東京メトロ千代田線「乃木坂駅」青山霊園方面出口から直結。日比谷線「六本木駅」から徒歩5分。",
    likes: 18,
  },
  信濃町駅前の歩道橋: {
    lat: 35.6802,
    lng: 139.7203,
    pref: "東京都",
    address: "新宿区信濃町",
    note: "線路を見下ろす歩道橋。作中の構図に近いとされるが、周辺に似た地点が複数ある。",
    body: `JR信濃町駅の近く、線路をまたぐ歩道橋。

■ 作品での扱い
瀧が電車を見下ろす場面の構図に近いとされる。ただし中央線・総武線沿線には似た構図の歩道橋が複数あり、特定には慎重さが要る。異論があれば根拠とともに書き足してください。

■ 訪れる際に
生活道路です。通行の妨げにならないように。`,
    access: "JR中央・総武線「信濃町駅」からすぐ。",
    likes: 6,
  },
  四ツ谷駅: {
    lat: 35.6862,
    lng: 139.7302,
    pref: "東京都",
    address: "新宿区四谷1丁目",
    note: "外堀に面した駅。須賀神社へ向かう起点になる。",
    body: `JR中央線・総武線と東京メトロ丸ノ内線・南北線が乗り入れる駅。外堀の土手に沿ってホームがある。

■ 作品での扱い
瀧の生活圏として、駅前や外堀沿いの道が繰り返し描かれる。終盤の石段（須賀神社の男坂）へは、ここから徒歩10分ほど。

■ 巡礼の起点として
四ツ谷駅 → 須賀神社の男坂 → 四谷三丁目駅、という順で歩くと、作中の東京側の風景をまとめて見られます。`,
    access: "JR中央・総武線、東京メトロ丸ノ内線・南北線「四ツ谷駅」。",
    likes: 15,
  },
  "高山市図書館 煥章館": {
    lat: 36.1418,
    lng: 137.2503,
    pref: "岐阜県",
    address: "高山市馬場町2-115",
    note: "高山市の市立図書館。明治期の洋風建築を再現した外観をもつ。",
    body: "岐阜県高山市の市立図書館。かつてこの地にあった洋風校舎の外観を再現した建物で、館内には近代文学館も併設されている。作中の図書館の候補として挙げられることがあるが、館内の造りは飛騨市図書館の方が近いという指摘が多い。",
    access: "JR高山本線「高山駅」から徒歩10分ほど。",
    likes: 4,
  },
  "鎌倉高校前1号踏切": { lat: 35.3068, lng: 139.501, pref: "神奈川県", address: "鎌倉市腰越1丁目", note: "江ノ島電鉄の踏切。海と江ノ島を望む。", body: "江ノ島電鉄の鎌倉高校前駅に隣接する踏切。踏切の向こうに国道134号、その先に相模湾と江ノ島が広がる。\n\n■ 有名な構図\n海と江ノ電と踏切が一枚に収まるこの構図は、作品のオープニングに使われたことで広く知られるようになった。国内外から訪れる人が多い。\n\n■ 訪れる際に\n生活道路であり、幹線道路に面しています。車道へのはみ出し、線路内への立ち入り、路上駐車は絶対にやめてください。近隣住民の生活が続いている場所です。", access: "江ノ島電鉄「鎌倉高校前駅」からすぐ。周辺に駐車場はほとんどありません。電車での訪問を強くおすすめします。", likes: 63 },
};

export function seedIfEmpty(db: Database.Database) {
  const isEmpty = () => (db.prepare("SELECT COUNT(*) AS n FROM works").get() as { n: number }).n === 0;
  if (!isEmpty()) return;

  const pw = hashPassword(DEMO_PASSWORD); // 全サンプルユーザー共通

  const insertUser = db.prepare(
    "INSERT INTO users (handle, display_name, bio, password_hash) VALUES (?, ?, ?, ?)",
  );
  const insertPlace = db.prepare(
    `INSERT INTO places (name, lat, lng, prefecture, address, note, body, access, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
  );
  const insertRevision = db.prepare(
    `INSERT INTO place_revisions
       (place_id, editor_id, name, lat, lng, prefecture, address, note, body, access, photo_path, summary)
     SELECT id, ?, name, lat, lng, prefecture, address, note, body, access, photo_path, ?
       FROM places WHERE id = ?`,
  );
  const insertLike = db.prepare("INSERT OR IGNORE INTO place_likes (place_id, user_id) VALUES (?, ?)");
  const insertPassageRevision = db.prepare(
    `INSERT INTO passage_revisions
       (passage_id, editor_id, chapter, kind, quote, note, image_path, image_caption, image_credit, summary)
     SELECT id, ?, chapter, kind, quote, note, image_path, image_caption, image_credit, ?
       FROM passages WHERE id = ?`,
  );
  const insertWork = db.prepare(
    "INSERT INTO works (slug, title, author, medium, year, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPassage = db.prepare(
    "INSERT INTO passages (work_id, chapter, kind, quote, note, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertIdent = db.prepare(
    "INSERT INTO identifications (passage_id, place_id, rationale, evidence, source_url, created_by) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertVote = db.prepare(
    "INSERT OR IGNORE INTO votes (identification_id, user_id, value) VALUES (?, ?, ?)",
  );
  const insertComment = db.prepare(
    "INSERT INTO comments (passage_id, identification_id, user_id, body) VALUES (?, ?, ?, ?)",
  );

  // 複数プロセスが同時に起動しても二重投入にならないよう、
  // 書き込みロックを取ってから中でもう一度確認する。
  db.transaction(() => {
    if (!isEmpty()) return;

    const userId: Record<string, number> = {};
    for (const c of CONTRIBUTORS) {
      userId[c.handle] = insertUser.run(c.handle, c.name, c.bio, pw).lastInsertRowid as number;
    }
    const voters: number[] = [];
    for (const h of voterHandles()) {
      voters.push(insertUser.run(h, h, "", pw).lastInsertRowid as number);
    }

    const placeId: Record<string, number> = {};
    let likeCursor = 0;
    for (const [name, p] of Object.entries(PLACES)) {
      const author = userId["trip_log"];
      const id = insertPlace.run(
        name,
        p.lat,
        p.lng,
        p.pref,
        p.address ?? "",
        p.note ?? "",
        p.body ?? "",
        p.access ?? "",
        author,
        author,
      ).lastInsertRowid as number;
      placeId[name] = id;

      // 最初の版として、いまの状態を履歴に残す
      insertRevision.run(author, "新規作成", id);

      // いいねを配る。投票と同じ要領で投稿者をずらす。
      for (let i = 0; i < (p.likes ?? 0); i++) {
        insertLike.run(id, voters[(likeCursor + i) % voters.length]);
      }
      likeCursor = (likeCursor + (p.likes ?? 0) + 3) % voters.length;
    }

    // 後からの加筆を再現して、履歴に複数の版が並ぶようにする
    const laterEdits: { place: string; by: string; summary: string; append: string; access?: string }[] = [
      {
        place: "鎌倉高校前1号踏切",
        by: "shonan_rail",
        summary: "訪問マナーの注意を追記",
        append:
          "■ 近年の状況\n訪れる人の増加にともない、周辺では通行や撮影をめぐる問題が起きている。地元自治体や鉄道会社から注意の呼びかけが出ることもある。信号と踏切の遮断機に従い、車道に出ないこと。",
      },
      {
        place: "須賀神社 男坂",
        by: "trip_log",
        summary: "階段の位置と行き方を補足",
        append:
          "■ 現地の様子\n階段の下からと上からでは印象がまったく違う。作中の構図に近いのは、坂の下から見上げる角度。周囲は住宅で、朝夕は通勤・通学の人が通る。",
        access: "JR・東京メトロ「四ツ谷駅」または「四谷三丁目駅」から徒歩10分ほど。周辺に駐車場はありません。",
      },
      {
        place: "道後温泉本館",
        by: "matsuyama_k",
        summary: "建物の説明を加筆",
        append:
          "■ 又新殿\n本館には皇室専用の浴室である又新殿が設けられている。一般の入浴はできないが、館内見学の対象になることがある。",
      },
      {
        place: "沼津駅",
        by: "numazu_p",
        summary: "バスの案内を修正",
        append: "■ 内浦へ\n内浦・三津方面のバスは南口から。本数が少ない時間帯があるため、帰りの便も先に確認しておきたい。",
      },
    ];

    const applyEdit = db.prepare(
      `UPDATE places
          SET body = TRIM(body || char(10) || char(10) || @append),
              access = COALESCE(NULLIF(@access, ''), access),
              updated_at = datetime('now'), updated_by = @editor
        WHERE id = @id`,
    );
    for (const e of laterEdits) {
      const id = placeId[e.place];
      if (!id) continue;
      applyEdit.run({ id, append: e.append, access: e.access ?? "", editor: userId[e.by] });
      insertRevision.run(userId[e.by], e.summary, id);
    }

    // 票を配るカーソル。案ごとに投票者をずらして重複を避ける。
    let cursor = 0;
    const castVotes = (identId: number, up: number, down: number) => {
      for (let i = 0; i < up + down; i++) {
        const uid = voters[(cursor + i) % voters.length];
        insertVote.run(identId, uid, i < up ? 1 : -1);
      }
      cursor = (cursor + up + down + 7) % voters.length;
    };

    for (const w of WORKS) {
      const wid = insertWork.run(
        w.slug,
        w.title,
        w.author,
        w.medium,
        w.year,
        w.description,
        userId["bungei_ta"],
      ).lastInsertRowid as number;

      w.passages.forEach((p, i) => {
        const pid = insertPassage.run(
          wid,
          p.chapter ?? "",
          p.kind ?? "scene",
          p.quote,
          p.note ?? "",
          i,
          userId[p.by],
        ).lastInsertRowid as number;

        // 場所と同じく、最初の版を履歴に残す（初回の編集も差し戻せるように）
        insertPassageRevision.run(userId[p.by], "新規作成", pid);

        const identIdByPlace: Record<string, number> = {};
        for (const idt of p.idents) {
          const iid = insertIdent.run(
            pid,
            placeId[idt.place],
            idt.rationale,
            idt.evidence ?? "guess",
            idt.source_url ?? "",
            userId[idt.by],
          ).lastInsertRowid as number;
          identIdByPlace[idt.place] = iid;
          castVotes(iid, idt.up, idt.down ?? 0);
          // 提案者自身の1票
          insertVote.run(iid, userId[idt.by], 1);
        }

        for (const c of p.comments ?? []) {
          insertComment.run(pid, c.on ? identIdByPlace[c.on] : null, userId[c.by], c.body);
        }
      });
    }
  }).immediate();
}
