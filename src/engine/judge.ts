import { TypeSafeClient, TypeSafeError, choice, score } from "@typesafe-ai/sdk";
import type { Activity } from "./catalog";
import { REJECTION_REASON_CRITERIA, type RejectionReason } from "./rejection";
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
  /**
   * 「違うな」のその他(自由記述)を、CLAUDE.md記載の5つの理由のいずれかに分類する。
   * 分類できない/失敗した場合はnull(呼び出し側は却下idの除外のみ行う)。
   */
  classifyReason(freeText: string): Promise<RejectionReason | null>;
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

  async classifyReason(freeText: string): Promise<RejectionReason | null> {
    try {
      const result = await this.client.systemOne({
        state: { message: freeText },
        questions: {
          reason: choice("`message` は、次のどの却下理由に最も近いですか？", REJECTION_REASON_CRITERIA),
        },
      });
      return result.answers.reason.choice;
    } catch (err) {
      if (err instanceof TypeSafeError) {
        console.warn(`Jevの理由分類に失敗しました: ${err.message}`);
        return null;
      }
      throw err;
    }
  }
}
