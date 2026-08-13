/**
 * 動的セグメントの値を復号する。
 *
 * 作品の slug には日本語が入りうる。ルーティングを通ってくる値は
 * 百分率符号化されたままのことがあるため、明示的に戻してから検索する。
 */
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
