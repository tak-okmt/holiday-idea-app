/**
 * ルール一致度とJevスコアの重み。週末2の探索結果（eval/jev-explore-results.md）に基づく初期値。
 * Jevは自由記述の解釈で価値を出しているが本番未検証のため五分五分から開始し、
 * 週末8の実利用フィードバックで調整する。
 */
export const RULE_WEIGHT = 0.5;
export const JEV_WEIGHT = 0.5;
