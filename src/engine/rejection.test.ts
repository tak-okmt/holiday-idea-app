import { describe, expect, it } from "vitest";
import type { Activity } from "./catalog";
import { applyRejection, REJECTION_REASONS } from "./rejection";
import type { State } from "./types";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act_001",
    name: "テスト候補",
    category: "food",
    indoor: false,
    with: ["solo"],
    energy: "medium",
    minutes: [30, 60],
    budget: "under3000",
    weather_ok: ["sunny", "cloudy", "rainy"],
    seasons: ["all"],
    needs_prep: true,
    pitch: "pitch",
    first_step: "first_step",
    link: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<State> = {}): State {
  return {
    with: "solo",
    energy: "medium",
    time: "within_2h",
    budget: "under3000",
    season: "autumn",
    ...overrides,
  };
}

describe("applyRejection", () => {
  it("どの理由でも却下した候補をrejectedIdsに積む", () => {
    const state = makeState();
    const activity = makeActivity({ id: "act_042" });
    for (const reason of REJECTION_REASONS) {
      const next = applyRejection(state, activity, reason);
      expect(next.rejectedIds).toContain("act_042");
    }
  });

  it("money: 予算を1段下げる。既にfreeならそのまま", () => {
    expect(applyRejection(makeState({ budget: "unlimited" }), makeActivity(), "money").budget).toBe("under3000");
    expect(applyRejection(makeState({ budget: "under3000" }), makeActivity(), "money").budget).toBe("free");
    expect(applyRejection(makeState({ budget: "free" }), makeActivity(), "money").budget).toBe("free");
  });

  it("hassle: excludeNeedsPrepを立て、energyを1段下げる。既にlowならそのまま", () => {
    const result = applyRejection(makeState({ energy: "high" }), makeActivity(), "hassle");
    expect(result.excludeNeedsPrep).toBe(true);
    expect(result.energy).toBe("medium");
    expect(applyRejection(makeState({ energy: "low" }), makeActivity(), "hassle").energy).toBe("low");
  });

  it("been_there: rejectedIds以外は変化しない", () => {
    const state = makeState();
    const result = applyRejection(state, makeActivity({ id: "act_001" }), "been_there");
    expect(result).toEqual({ ...state, rejectedIds: ["act_001"] });
  });

  it("not_in_mood: 却下した候補のカテゴリをpenalizedCategoriesに積む(累積)", () => {
    const state = makeState({ penalizedCategories: ["craft"] });
    const result = applyRejection(state, makeActivity({ category: "food" }), "not_in_mood");
    expect(result.penalizedCategories).toEqual(["craft", "food"]);
  });

  it("stay_home: penalizeOutdoorを立てる", () => {
    const result = applyRejection(makeState(), makeActivity(), "stay_home");
    expect(result.penalizeOutdoor).toBe(true);
  });

  it("not_interested: 却下した候補のカテゴリをexcludedCategoriesに積む(累積、not_in_moodの減点より強い除外)", () => {
    const state = makeState({ excludedCategories: ["craft"] });
    const result = applyRejection(state, makeActivity({ category: "food" }), "not_interested");
    expect(result.excludedCategories).toEqual(["craft", "food"]);
  });
});
