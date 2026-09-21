import type { Activity } from "./catalog";
import type { State } from "./types";

const TIME_BUDGET_MINUTES: Record<State["time"], number> = {
  within_2h: 120,
  half_day: 300,
  full_day: 480,
};

const BUDGET_ORDER: Record<Activity["budget"], number> = {
  free: 0,
  under3000: 1,
  unlimited: 2,
};

const ENERGY_ORDER: Record<Activity["energy"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * 足切り（CLAUDE.md記載: 人数・時間・予算・天気・却下済み）。
 * energyはここでは判定しない（一致度スコアの方で扱う。理由は ruleMatchScore を参照）。
 */
export function passesFilters(activity: Activity, state: State): boolean {
  if (!activity.with.includes(state.with)) return false;
  if (activity.minutes[0] > TIME_BUDGET_MINUTES[state.time]) return false;
  if (BUDGET_ORDER[activity.budget] > BUDGET_ORDER[state.budget]) return false;
  if (state.weather && !activity.weather_ok.includes(state.weather)) return false;
  if (state.rejectedIds?.includes(activity.id)) return false;
  return true;
}

export function filterCandidates(catalog: Activity[], state: State): Activity[] {
  return catalog.filter((activity) => passesFilters(activity, state));
}

/**
 * ルール一致度 (0-1)。
 * CLAUDE.mdの足切り一覧(人数・時間・予算・天気・却下済み)にenergyが含まれていないため、
 * ここではenergyの近さのみをスコア化する。季節・気分など自由記述のニュアンスはJevの役割とする。
 * 完全一致=1.0、1段差(例: low/medium)=0.5、2段差(low/high)=0.0。
 */
export function ruleMatchScore(activity: Activity, state: State): number {
  const diff = Math.abs(ENERGY_ORDER[activity.energy] - ENERGY_ORDER[state.energy]);
  return 1 - diff / 2;
}
