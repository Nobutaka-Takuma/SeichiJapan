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
        quote: "主人公が町の記録を調べるために立ち寄る図書館。",
        by: "hida_note",
        idents: [
          {
            place: "飛騨市図書館",
            evidence: "research",
            by: "hida_note",
            rationale: "外観と閲覧室の構造が作中の描写と一致する。飛騨市も舞台として案内している。",
            up: 19,
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

const PLACES: Record<string, { lat: number; lng: number; pref: string; address?: string; note?: string }> = {
  由比ヶ浜: { lat: 35.3085, lng: 139.5391, pref: "神奈川県", address: "鎌倉市由比ガ浜", note: "鎌倉を代表する海岸。明治期から海水浴場として賑わった。" },
  材木座海岸: { lat: 35.308, lng: 139.549, pref: "神奈川県", address: "鎌倉市材木座", note: "滑川を挟んで由比ヶ浜の東側に続く海岸。" },
  雑司ヶ谷霊園: { lat: 35.7215, lng: 139.7127, pref: "東京都", address: "豊島区南池袋4", note: "夏目漱石、泉鏡花らの墓所がある都立霊園。" },
  小石川: { lat: 35.718, lng: 139.744, pref: "東京都", address: "文京区小石川", note: "坂の多い台地。漱石の旧居跡も近い。" },
  本郷: { lat: 35.708, lng: 139.76, pref: "東京都", address: "文京区本郷", note: "東京大学に隣接する学生街。" },
  上野精養軒: { lat: 35.7148, lng: 139.7738, pref: "東京都", address: "台東区上野公園4-58", note: "明治期に開業した西洋料理店。上野公園内に本店を構える。" },
  "三四郎池（育徳園心字池）": { lat: 35.7128, lng: 139.7639, pref: "東京都", address: "文京区本郷7-3-1 東京大学構内", note: "旧加賀藩邸の庭園の池。小説にちなむ通称が定着した。" },
  西片町: { lat: 35.7154, lng: 139.753, pref: "東京都", address: "文京区西片", note: "明治期に学者・文人が多く住んだ住宅地。" },
  本郷菊坂: { lat: 35.7098, lng: 139.7546, pref: "東京都", address: "文京区本郷4-5丁目", note: "下宿屋が集中していた坂道。樋口一葉の旧居跡もある。" },
  道後温泉本館: { lat: 33.852, lng: 132.7864, pref: "愛媛県", address: "松山市道後湯之町5-6", note: "1894年竣工の共同浴場。国の重要文化財。" },
  "旧制松山中学（現・松山東高等学校）": { lat: 33.8412, lng: 132.771, pref: "愛媛県", address: "松山市持田町2-2-12", note: "漱石が英語教師として赴任した学校の後身。" },
  清水トンネル: { lat: 36.8402, lng: 138.9235, pref: "群馬県／新潟県", address: "上越線 土合〜土樽間", note: "1931年開通。群馬・新潟県境を貫く全長約9.7kmの鉄道トンネル。" },
  "土樽駅（旧・土樽信号場）": { lat: 36.8737, lng: 138.858, pref: "新潟県", address: "南魚沼郡湯沢町土樽", note: "清水トンネル新潟側出口の直後に設けられた信号場が前身。" },
  越後中里駅: { lat: 36.8896, lng: 138.8378, pref: "新潟県", address: "南魚沼郡湯沢町土樽", note: "上越線の駅。" },
  越後湯沢: { lat: 36.9366, lng: 138.8098, pref: "新潟県", address: "南魚沼郡湯沢町湯沢", note: "三国街道沿いの温泉町。川端康成が逗留した宿が現存する。" },
  沼津駅: { lat: 35.1044, lng: 138.858, pref: "静岡県", address: "沼津市大手町1", note: "東海道本線の駅。内浦方面へのバスが発着する。" },
  淡島: { lat: 35.0206, lng: 138.888, pref: "静岡県", address: "沼津市内浦重寺", note: "内浦湾に浮かぶ小島。渡船で渡る。" },
  安田屋旅館: { lat: 35.0186, lng: 138.8853, pref: "静岡県", address: "沼津市内浦三津", note: "海沿いに建つ木造三階建ての旅館。" },
  内浦漁港: { lat: 35.0163, lng: 138.8905, pref: "静岡県", address: "沼津市内浦小海", note: "内浦湾の漁港。" },
  三津浜: { lat: 35.0203, lng: 138.8865, pref: "静岡県", address: "沼津市内浦三津", note: "内浦湾に面した浜。" },
  "須賀神社 男坂": { lat: 35.6873, lng: 139.7205, pref: "東京都", address: "新宿区須賀町5", note: "四谷の須賀神社へ上る石段。" },
  飛騨市図書館: { lat: 36.241, lng: 137.187, pref: "岐阜県", address: "飛騨市古川町本町2-22", note: "飛騨古川の市立図書館。" },
  気多若宮神社: { lat: 36.2427, lng: 137.1794, pref: "岐阜県", address: "飛騨市古川町上気多1297", note: "古川祭で知られる神社。" },
  "鎌倉高校前1号踏切": { lat: 35.3068, lng: 139.501, pref: "神奈川県", address: "鎌倉市腰越1丁目", note: "江ノ島電鉄の踏切。海と江ノ島を望む。" },
};

export function seedIfEmpty(db: Database.Database) {
  const isEmpty = () => (db.prepare("SELECT COUNT(*) AS n FROM works").get() as { n: number }).n === 0;
  if (!isEmpty()) return;

  const pw = hashPassword(DEMO_PASSWORD); // 全サンプルユーザー共通

  const insertUser = db.prepare(
    "INSERT INTO users (handle, display_name, bio, password_hash) VALUES (?, ?, ?, ?)",
  );
  const insertPlace = db.prepare(
    "INSERT INTO places (name, lat, lng, prefecture, address, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    for (const [name, p] of Object.entries(PLACES)) {
      placeId[name] = insertPlace.run(
        name,
        p.lat,
        p.lng,
        p.pref,
        p.address ?? "",
        p.note ?? "",
        userId["trip_log"],
      ).lastInsertRowid as number;
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
