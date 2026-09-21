import type { Activity } from "./catalog";
import type { State } from "./types";

const TIME_BUDGET_MINUTES: Record<State["time"], number> = {
  within_2h: 120,
  half_day: 300,
  full_day: 480,
};

/** 予算の段階順。「お金がかかる」による1段階引き下げ(rejection.ts)でも使う。 */
export const BUDGET_ORDER: Record<Activity["budget"], number> = {
  free: 0,
  under3000: 1,
  unlimited: 2,
};

/** 気力の段階順。「面倒そう」による1段階引き下げ(rejection.ts)でも使う。 */
export const ENERGY_ORDER: Record<Activity["energy"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** 同じカテゴリ/屋外への減点係数(週末4)。強すぎ/弱すぎる場合は要調整。 */
const CATEGORY_PENALTY_FACTOR = 0.5;
const OUTDOOR_PENALTY_FACTOR = 0.5;

/**
 * 足切り（CLAUDE.md記載: 人数・時間・予算・天気・却下済み）。
 * energyはここでは判定しない（一致度スコアの方で扱う。理由は ruleMatchScore を参照）。
 * excludeNeedsPrep は「面倒そう」、excludedCategories は「興味がない」による却下(rejection.ts)で立つ。
 */
export function passesFilters(activity: Activity, state: State): boolean {
  if (!activity.with.includes(state.with)) return false;
  if (activity.minutes[0] > TIME_BUDGET_MINUTES[state.time]) return false;
  if (BUDGET_ORDER[activity.budget] > BUDGET_ORDER[state.budget]) return false;
  if (state.weather && !activity.weather_ok.includes(state.weather)) return false;
  if (state.rejectedIds?.includes(activity.id)) return false;
  if (state.excludeNeedsPrep && activity.needs_prep) return false;
  if (state.excludedCategories?.includes(activity.category)) return false;
  return true;
}

export function filterCandidates(catalog: Activity[], state: State): Activity[] {
  return catalog.filter((activity) => passesFilters(activity, state));
}

/**
 * ルール一致度 (0-1)。
 * CLAUDE.mdの足切り一覧(人数・時間・予算・天気・却下済み)にenergyが含まれていないため、
 * ベースはenergyの近さのみをスコア化する。季節・気分など自由記述のニュアンスはJevの役割とする。
 * 完全一致=1.0、1段差(例: low/medium)=0.5、2段差(low/high)=0.0。
 * 「気分じゃない」「外に出たくない」による却下(rejection.ts)が立っていれば、
 * 該当する候補のスコアを減衰させる(乗算、重ね掛け可)。
 */
export function ruleMatchScore(activity: Activity, state: State): number {
  const diff = Math.abs(ENERGY_ORDER[activity.energy] - ENERGY_ORDER[state.energy]);
  let matchScore = 1 - diff / 2;
  if (state.penalizedCategories?.includes(activity.category)) {
    matchScore *= CATEGORY_PENALTY_FACTOR;
  }
  if (state.penalizeOutdoor && !activity.indoor) {
    matchScore *= OUTDOOR_PENALTY_FACTOR;
  }
  return matchScore;
}
