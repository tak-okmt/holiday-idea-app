import type { Activity } from "./catalog";
import { loadCatalog } from "./catalog";
import type { Judge } from "./judge";
import { JEV_SCORE_MAX } from "./judge";
import { buildReason } from "./reason";
import { filterCandidates, ruleMatchScore } from "./rules";
import type { State, Suggestion } from "./types";
import { JEV_WEIGHT, RULE_WEIGHT } from "./weights";

/**
 * State からカタログを絞り込み、ルール一致度とJevスコアを重み付けして上位N件を返す。
 * UI・フレームワークに依存しない純粋なモジュール(CLAUDE.mdのアーキテクチャ方針)。
 */
export async function recommend(
  state: State,
  judge: Judge,
  catalog: Activity[] = loadCatalog(),
  topN = 3
): Promise<Suggestion[]> {
  const candidates = filterCandidates(catalog, state);
  if (candidates.length === 0) return [];

  const jevResults = await judge.scoreCandidates(state, candidates);
  const jevById = new Map(jevResults?.map((r) => [r.activityId, r] as const));

  const suggestions: Suggestion[] = candidates.map((activity) => {
    const ruleScore = ruleMatchScore(activity, state);
    const jevResult = jevById.get(activity.id);
    const jevScore = jevResult ? jevResult.score / JEV_SCORE_MAX : null;
    const finalScore = jevScore === null ? ruleScore : RULE_WEIGHT * ruleScore + JEV_WEIGHT * jevScore;
    return {
      activity,
      ruleScore,
      jevScore,
      finalScore,
      reason: buildReason(activity, state),
    };
  });

  suggestions.sort((a, b) => b.finalScore - a.finalScore);
  return suggestions.slice(0, topN);
}
