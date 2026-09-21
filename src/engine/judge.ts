import { TypeSafeClient, TypeSafeError, score } from "@typesafe-ai/sdk";
import type { Activity } from "./catalog";
import type { State } from "./types";

export const FIT_LEVELS = [
  "全く合わない",
  "あまり合わない",
  "まあまあ合う",
  "よく合う",
  "非常によく合う",
] as const;

/** score型の段階数-1。JevのScoreResponseは0〜この値の連続値を返す。 */
export const JEV_SCORE_MAX = FIT_LEVELS.length - 1;

export interface JevScoreResult {
  activityId: string;
  score: number;
  confidence: number;
}

/**
 * 候補の採点を担うインターフェース。Jev以外(LLMの構造化出力など)にも差し替え可能にする。
 * 失敗・タイムアウト時はnullを返す契約とし、呼び出し側(recommend.ts)がルールスコアのみに
 * フォールバックできるようにする。Jevの障害でアプリを止めない、というCLAUDE.mdの方針に対応。
 */
export interface Judge {
  scoreCandidates(state: State, candidates: Activity[]): Promise<JevScoreResult[] | null>;
}

export class JevJudge implements Judge {
  constructor(private readonly client: TypeSafeClient = new TypeSafeClient()) {}

  async scoreCandidates(state: State, candidates: Activity[]): Promise<JevScoreResult[] | null> {
    if (candidates.length === 0) return [];

    const questions = Object.fromEntries(
      candidates.map((_, i) => [
        `fit_${i}`,
        score(
          "`candidates[" +
            i +
            "]` は、`profile`（誰と/気力/使える時間/予算/季節/天気）と `mood` を踏まえて、今のユーザーにどれくらい合いますか？",
          FIT_LEVELS
        ),
      ])
    );

    try {
      const result = await this.client.systemOne({
        state: {
          profile: {
            with: state.with,
            energy: state.energy,
            time: state.time,
            budget: state.budget,
            season: state.season,
            weather: state.weather ?? null,
          },
          mood: state.mood ?? "",
          candidates: candidates.map((c) => ({
            name: c.name,
            category: c.category,
            pitch: c.pitch,
            indoor: c.indoor,
            energy: c.energy,
          })),
        },
        questions,
      });

      return candidates.map((candidate, i) => {
        const answer = result.answers[`fit_${i}`];
        return { activityId: candidate.id, score: answer.score, confidence: answer.confidence };
      });
    } catch (err) {
      if (err instanceof TypeSafeError) {
        console.warn(`Jevの採点に失敗したため、ルールスコアのみで続行します: ${err.message}`);
        return null;
      }
      throw err;
    }
  }
}
