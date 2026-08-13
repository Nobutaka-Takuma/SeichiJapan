/**
 * 「確度」の計算。
 *
 * ある記述（passage）に複数の比定案（identification）がぶら下がる。
 * 各案の支持度を、同じ記述に対する全案の中でのシェアとして表す。
 *
 *   支持 s = 賛成票 - 反対票 （下限 0）
 *   重み w = s + PRIOR
 *   確度   = w / Σw
 *
 * PRIOR はラプラス平滑化の擬似カウント。票がほとんど入っていない段階で
 * 「1票入っただけで確度100%」のような極端な値が出るのを防ぐ。
 * 案が1つしかない場合も、票が集まるまでは100%にならない。
 */
const PRIOR = 0.5;

/** 未投票の単独案が到達しうる上限。「まだ検証されていない」ことを示すため頭打ちにする。 */
const UNVERIFIED_CAP = 0.6;

export type Tally = { up: number; down: number };

export function confidenceShares(tallies: Tally[]): number[] {
  if (tallies.length === 0) return [];
  const weights = tallies.map((t) => Math.max(0, t.up - t.down) + PRIOR);
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => w / sum);

  // 案が1つだけのときはシェアが必ず100%になってしまうので、票数で割り引く。
  if (tallies.length === 1) {
    const net = Math.max(0, tallies[0].up - tallies[0].down);
    return [Math.min(1, UNVERIFIED_CAP + (1 - UNVERIFIED_CAP) * (net / (net + 4)))];
  }
  return shares;
}

/** 議論の厚み（投じられた票の総数）。確度の信頼性の目安として併記する。 */
export function evidenceWeight(tallies: Tally[]): number {
  return tallies.reduce((a, t) => a + t.up + t.down, 0);
}

export type ConsensusLevel = "settled" | "leading" | "contested" | "open";

/** 確度の分布から議論の状態を判定する。 */
export function consensusLevel(shares: number[], votes: number): ConsensusLevel {
  if (shares.length === 0) return "open";
  const top = Math.max(...shares);
  if (votes < 3) return "open";
  if (top >= 0.8) return "settled";
  if (top >= 0.55) return "leading";
  return "contested";
}

export const CONSENSUS_LABEL: Record<ConsensusLevel, string> = {
  settled: "ほぼ確定",
  leading: "有力説あり",
  contested: "議論中",
  open: "検証待ち",
};

/** 確度に応じた色。地図のピンとバーで共通に使う。 */
export function confidenceColor(share: number): string {
  if (share >= 0.8) return "#b4472e"; // 朱
  if (share >= 0.55) return "#c98a2e"; // 黄土
  if (share >= 0.3) return "#6b8f71"; // 苔
  return "#8a8580"; // 鼠
}

export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
