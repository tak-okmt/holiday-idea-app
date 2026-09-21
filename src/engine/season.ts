import type { State } from "./types";

/** ユーザーには聞かず、現在日から季節を自動算出する。 */
export function currentSeason(date = new Date()): State["season"] {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}
