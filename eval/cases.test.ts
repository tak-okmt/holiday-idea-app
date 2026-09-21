import { describe, expect, it } from "vitest";
import { loadCatalog } from "../src/engine/catalog";
import type { Judge, JevScoreResult } from "../src/engine/judge";
import { recommend } from "../src/engine/recommend";
import { applyRejection, REJECTION_REASONS } from "../src/engine/rejection";
import { BUDGET_ORDER, ENERGY_ORDER, passesFilters } from "../src/engine/rules";
import type { State } from "../src/engine/types";
import casesData from "./cases.json";

/**
 * eval/cases.json の回帰テスト。
 * 実カタログ(100件)を使いつつ、Jevは呼ばない(決定的・無料にするため)。
 * 「その他(自由記述)」のJev分類は eval/jev-explore.ts や recommend-cli.ts の --reject-text で
 * 実APIを使って手動確認する運用とし、ここではルール層のみを検証する。
 */
const noopJudge: Judge = {
  async scoreCandidates(): Promise<JevScoreResult[]> {
    return [];
  },
  async classifyReason(): Promise<null> {
    return null;
  },
};

const catalog = loadCatalog();

type Case = { id: string; description: string; state: State };
const cases = casesData as Case[];

describe("eval/cases.json 回帰テスト", () => {
  for (const testCase of cases) {
    describe(`[${testCase.id}] ${testCase.description}`, () => {
      it("提案は3件以内で、全て足切り条件を満たし、スコア降順である", async () => {
        const suggestions = await recommend(testCase.state, noopJudge, catalog);
        expect(suggestions.length).toBeLessThanOrEqual(3);
        for (const s of suggestions) {
          expect(passesFilters(s.activity, testCase.state)).toBe(true);
        }
        for (let i = 1; i < suggestions.length; i++) {
          expect(suggestions[i - 1].finalScore).toBeGreaterThanOrEqual(suggestions[i].finalScore);
        }
      });

      for (const reason of REJECTION_REASONS) {
        it(`「${reason}」で却下すると再提案に反映される`, async () => {
          const first = await recommend(testCase.state, noopJudge, catalog);
          if (first.length === 0) return;

          const rejected = first[0].activity;
          const nextState = applyRejection(testCase.state, rejected, reason);
          const second = await recommend(nextState, noopJudge, catalog);

          // 却下した候補は二度と出てこない
          expect(second.some((s) => s.activity.id === rejected.id)).toBe(false);
          for (const s of second) {
            expect(passesFilters(s.activity, nextState)).toBe(true);
          }

          if (reason === "money") {
            expect(BUDGET_ORDER[nextState.budget]).toBeLessThanOrEqual(BUDGET_ORDER[testCase.state.budget]);
          }
          if (reason === "hassle") {
            expect(ENERGY_ORDER[nextState.energy]).toBeLessThanOrEqual(ENERGY_ORDER[testCase.state.energy]);
            expect(nextState.excludeNeedsPrep).toBe(true);
            expect(second.every((s) => !s.activity.needs_prep)).toBe(true);
          }
          if (reason === "not_in_mood") {
            expect(nextState.penalizedCategories).toContain(rejected.category);
          }
          if (reason === "stay_home") {
            expect(nextState.penalizeOutdoor).toBe(true);
          }
          if (reason === "not_interested") {
            expect(nextState.excludedCategories).toContain(rejected.category);
            expect(second.every((s) => s.activity.category !== rejected.category)).toBe(true);
          }
        });
      }
    });
  }
});
