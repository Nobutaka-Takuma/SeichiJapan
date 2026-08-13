/**
 * 場所の「確からしさ」。
 *
 * このサービスの前提として、ピン止めの大半はファンの間ですでに固まっている。
 * だから既定は「定説」であり、確度の数字が前に出るのは
 * **異説が実際に提出されたときだけ** にしている。
 *
 * 候補が複数あるとき：
 *   支持 s = 賛成票 - 反対票 （下限 0）
 *   重み w = s + PRIOR
 *   確度   = w / Σw
 *
 * PRIOR はラプラス平滑化の擬似カウント。数票で確度が振り切れるのを防ぐ。
 */
const PRIOR = 0.5;

export type Tally = { up: number; down: number };

export function confidenceShares(tallies: Tally[]): number[] {
  if (tallies.length === 0) return [];
  // 異説が出ていないものは定説として扱う（確度は表示しない）
  if (tallies.length === 1) return [1];

  const weights = tallies.map((t) => Math.max(0, t.up - t.down) + PRIOR);
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

/** 異説が出ているか。確度の数字を出すかどうかの判定に使う。 */
export function isDisputed(candidateCount: number): boolean {
  return candidateCount > 1;
}

/** 集まった票の総数。 */
export function evidenceWeight(tallies: Tally[]): number {
  return tallies.reduce((a, t) => a + t.up + t.down, 0);
}

export type ConsensusLevel = "settled" | "leading" | "contested" | "open";

export function consensusLevel(shares: number[], votes: number): ConsensusLevel {
  if (shares.length === 0) return "open";
  if (shares.length === 1) return "settled";
  // 異説は出ているが、まだ誰も検証していない段階
  if (votes < 2) return "open";
  const top = Math.max(...shares);
  if (top >= 0.8) return "settled";
  if (top >= 0.55) return "leading";
  return "contested";
}

export const CONSENSUS_LABEL: Record<ConsensusLevel, string> = {
  settled: "定説",
  leading: "有力説あり",
  contested: "異説あり",
  open: "場所の情報を募集中",
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
