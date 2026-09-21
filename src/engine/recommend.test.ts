import { describe, expect, it } from "vitest";
import type { Activity } from "./catalog";
import type { Judge, JevScoreResult } from "./judge";
import { JEV_SCORE_MAX } from "./judge";
import { recommend } from "./recommend";
import type { State } from "./types";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act_001",
    name: "テスト候補",
    category: "rest",
    indoor: true,
    with: ["solo"],
    energy: "low",
    minutes: [30, 60],
    budget: "free",
    weather_ok: ["sunny", "cloudy", "rainy"],
    seasons: ["all"],
    needs_prep: false,
    pitch: "pitch",
    first_step: "first_step",
    link: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<State> = {}): State {
  return {
    with: "solo",
    energy: "low",
    time: "within_2h",
    budget: "free",
    season: "autumn",
    ...overrides,
  };
}

class FakeJudge implements Judge {
  constructor(private readonly results: JevScoreResult[] | null) {}
  async scoreCandidates(): Promise<JevScoreResult[] | null> {
    return this.results;
  }
}

describe("recommend", () => {
  it("足切りを通らない候補は結果に含めない", async () => {
    const catalog = [
      makeActivity({ id: "act_001", with: ["solo"] }),
      makeActivity({ id: "act_002", with: ["family"] }),
    ];
    const judge = new FakeJudge([]);
    const result = await recommend(makeState({ with: "solo" }), judge, catalog);
    expect(result.map((s) => s.activity.id)).toEqual(["act_001"]);
  });

  it("ルールとJevのスコアを0.5:0.5で合成し、高い順に並べる", async () => {
    const catalog = [
      makeActivity({ id: "act_low_jev", energy: "low" }),
      makeActivity({ id: "act_high_jev", energy: "low" }),
    ];
    // energyは両方とも一致(ruleScore=1.0)なので、Jevスコアの差だけが最終順位を決める
    const judge = new FakeJudge([
      { activityId: "act_low_jev", score: 0, confidence: 0.9 },
      { activityId: "act_high_jev", score: JEV_SCORE_MAX, confidence: 0.9 },
    ]);
    const result = await recommend(makeState({ energy: "low" }), judge, catalog);
    expect(result.map((s) => s.activity.id)).toEqual(["act_high_jev", "act_low_jev"]);
    expect(result[0].finalScore).toBeCloseTo(0.5 * 1 + 0.5 * 1, 5);
    expect(result[1].finalScore).toBeCloseTo(0.5 * 1 + 0.5 * 0, 5);
  });

  it("Jevがnullを返したらルールスコアのみにフォールバックする", async () => {
    const catalog = [
      makeActivity({ id: "act_exact", energy: "low" }),
      makeActivity({ id: "act_far", energy: "high" }),
    ];
    const judge = new FakeJudge(null);
    const result = await recommend(makeState({ energy: "low" }), judge, catalog);
    expect(result[0].activity.id).toBe("act_exact");
    expect(result[0].jevScore).toBeNull();
    expect(result[0].finalScore).toBe(1);
    expect(result[1].finalScore).toBe(0);
  });

  it("上位N件だけを返す", async () => {
    const catalog = Array.from({ length: 5 }, (_, i) => makeActivity({ id: `act_${i}` }));
    const judge = new FakeJudge([]);
    const result = await recommend(makeState(), judge, catalog, 3);
    expect(result).toHaveLength(3);
  });

  it("該当候補が0件なら空配列を返す(Jevは呼ばない)", async () => {
    const catalog = [makeActivity({ with: ["family"] })];
    let called = false;
    const judge: Judge = {
      async scoreCandidates() {
        called = true;
        return [];
      },
    };
    const result = await recommend(makeState({ with: "solo" }), judge, catalog);
    expect(result).toEqual([]);
    expect(called).toBe(false);
  });
});
