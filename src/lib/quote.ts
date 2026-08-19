/**
 * 引用の扱い。
 *
 * 作品の一コマや一節を載せられると、聖地の魅力はぐっと伝わる。
 * ただし著作物なので、**引用として成り立つ形**でなければ載せられない。
 * 日本の著作権法32条とその運用で求められるのは、おおむね次の4つ。
 *
 *   1. 明瞭区別性 — どこからどこまでが引用か、見て分かること
 *   2. 主従関係   — 引用が従で、こちらの記述が主であること
 *   3. 出所の明示 — 作品名・作者・掲載箇所を示すこと（48条）
 *   4. 必要な範囲 — 目的に照らして要る分だけであること
 *
 * この module は 2〜4 を**入力の段階で担保する**ためのもの。
 * 1（見た目の区別）は QuotedImage / PassageQuote が受け持つ。
 */

export const IMAGE_KIND = ["site_photo", "work_quote"] as const;
export type ImageKind = (typeof IMAGE_KIND)[number];

export const IMAGE_KIND_LABEL: Record<ImageKind, string> = {
  site_photo: "現地の写真",
  work_quote: "作品からの引用",
};

export function asImageKind(value: unknown): ImageKind {
  return value === "work_quote" ? "work_quote" : "site_photo";
}

/** 引用にあたるか。画像でも本文でも、同じ判定で扱う。 */
export function isQuotation(kind: string, imageKind: string): boolean {
  return kind === "text" || imageKind === "work_quote";
}

/**
 * 引用として必要なものが揃っているか。
 *
 * ここを通らなければ保存しない。あとから「出典を書き忘れた引用」が
 * 残っていると、それだけで引用の要件を欠くため。
 */
export type QuoteInput = {
  kind: string;
  imageKind: string;
  /** 掲載箇所。「第3話」「第2巻 p.45」など。 */
  citationDetail: string;
  /** 出版社・配信元など。**任意**。 */
  citationSource: string;
  /** 章・話数の欄。ここに書いてあれば、掲載箇所はそれで足りる。 */
  chapter?: string;
  /** こちらの記述（場面の説明・補足）。主従関係の「主」にあたる。 */
  commentary: string;
};

/** 引用に添える自分の記述の下限。これを切ると「引用だけの投稿」になる。 */
export const COMMENTARY_MIN = 10;

/**
 * 必須は**ひとつだけ**にしてある。
 *
 * 作品名と作者はすでに作品の側にあるので、あとは「どこの部分か」が分かればよい。
 * それも、章・話数の欄に書いてあればそれで足りる（同じことを二度書かせない）。
 * 出典（出版社・配信元）は、あれば添えるが必須にしない。
 * 媒体によって書きようが違いすぎて、必須にすると書けない人が出るため。
 */
export function checkQuotation(q: QuoteInput): string | null {
  if (!isQuotation(q.kind, q.imageKind)) return null;

  const where = (q.citationDetail || q.chapter || "").trim();
  if (!where) {
    return "引用には出所が要ります。「掲載箇所」か「章・話数」のどちらかに、どの部分かを書いてください（例：第3話、第2巻 p.45）";
  }
  if (q.commentary.trim().length < COMMENTARY_MIN) {
    return `引用には、あなた自身の説明を${COMMENTARY_MIN}文字以上で添えてください。引用は説明の裏づけとして載せるものです`;
  }
  return null;
}

/** 表示に使う出所の一行。作品名・作者は呼び出し側が持っているので受け取る。 */
export function citationLine(opts: {
  workTitle: string;
  author: string;
  detail: string;
  source: string;
}): string {
  return [
    `『${opts.workTitle}』`,
    opts.author,
    opts.detail,
    opts.source,
  ]
    .filter((v) => v && v.trim())
    .join("／");
}
