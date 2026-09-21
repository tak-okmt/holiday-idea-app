import type { Activity } from "./catalog";
import { BUDGET_ORDER, ENERGY_ORDER } from "./rules";
import type { State } from "./types";

/** CLAUDE.md記載の「違うな」の理由タップ。 */
export const REJECTION_REASONS = [
  "money",
  "hassle",
  "been_there",
  "not_in_mood",
  "stay_home",
  "not_interested",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** Jevのchoiceで自由記述をこの説明文から分類する。REJECTION_REASONSとキーを揃えること。 */
export const REJECTION_REASON_CRITERIA: Record<RejectionReason, string> = {
  money: "お金がかかるという理由",
  hassle: "準備や手間が面倒だという理由",
  been_there: "すでにやったことがあるという理由",
  not_in_mood: "今の気分ではない(今日はその気になれない)という理由。また今度は良いかもというニュアンス",
  stay_home: "外に出たくないという理由",
  not_interested: "そのジャンル自体に一般的に興味がない・好みではないという理由。今日に限らずずっと関心がないニュアンス",
};

const BUDGET_LEVELS_BY_ORDER = Object.entries(BUDGET_ORDER).sort((a, b) => a[1] - b[1]).map(([k]) => k) as State["budget"][];
const ENERGY_LEVELS_BY_ORDER = Object.entries(ENERGY_ORDER).sort((a, b) => a[1] - b[1]).map(([k]) => k) as State["energy"][];

function lowerBudget(budget: State["budget"]): State["budget"] {
  const index = BUDGET_ORDER[budget];
  return BUDGET_LEVELS_BY_ORDER[Math.max(0, index - 1)];
}

function lowerEnergy(energy: State["energy"]): State["energy"] {
  const index = ENERGY_ORDER[energy];
  return ENERGY_LEVELS_BY_ORDER[Math.max(0, index - 1)];
}

/**
 * CLAUDE.mdの「違うな」の理由と状態更新テーブルに沿ってStateを更新する。
 * 理由を問わず、却下した候補自体は rejectedIds に積む(同じ案を出し続けないため。
 * テーブル上「その候補を除外」と明記されているのは been_there のみだが、
 * どの理由でも直前に却下した案を再提示しないほうが自然という判断で共通化している)。
 */
export function applyRejection(state: State, rejected: Activity, reason: RejectionReason): State {
  const base: State = {
    ...state,
    rejectedIds: [...(state.rejectedIds ?? []), rejected.id],
  };

  switch (reason) {
    case "money":
      return { ...base, budget: lowerBudget(state.budget) };
    case "hassle":
      return { ...base, excludeNeedsPrep: true, energy: lowerEnergy(state.energy) };
    case "been_there":
      return base;
    case "not_in_mood":
      return {
        ...base,
        penalizedCategories: [...(state.penalizedCategories ?? []), rejected.category],
      };
    case "stay_home":
      return { ...base, penalizeOutdoor: true };
    case "not_interested":
      return {
        ...base,
        excludedCategories: [...(state.excludedCategories ?? []), rejected.category],
      };
  }
}
