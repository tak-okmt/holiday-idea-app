import { describe, expect, it } from "vitest";
import type { Activity } from "./catalog";
import { filterCandidates, passesFilters, ruleMatchScore } from "./rules";
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

describe("passesFilters", () => {
  it("withが含まれない候補は除外する", () => {
    const activity = makeActivity({ with: ["friends"] });
    expect(passesFilters(activity, makeState({ with: "solo" }))).toBe(false);
  });

  it("候補の最短時間がユーザーの使える時間を超えていたら除外する", () => {
    const activity = makeActivity({ minutes: [180, 240] });
    expect(passesFilters(activity, makeState({ time: "within_2h" }))).toBe(false);
    expect(passesFilters(activity, makeState({ time: "half_day" }))).toBe(true);
  });

  it("候補の予算段階がユーザーの予算を超えていたら除外する", () => {
    const activity = makeActivity({ budget: "unlimited" });
    expect(passesFilters(activity, makeState({ budget: "under3000" }))).toBe(false);
    expect(passesFilters(activity, makeState({ budget: "unlimited" }))).toBe(true);
  });

  it("天気の指定があり候補が対応していなければ除外する", () => {
    const activity = makeActivity({ weather_ok: ["sunny", "cloudy"] });
    expect(passesFilters(activity, makeState({ weather: "rainy" }))).toBe(false);
    expect(passesFilters(activity, makeState({ weather: "sunny" }))).toBe(true);
  });

  it("天気の指定がなければ足切りしない", () => {
    const activity = makeActivity({ weather_ok: ["sunny"] });
    expect(passesFilters(activity, makeState({ weather: undefined }))).toBe(true);
  });

  it("却下済みIDは除外する", () => {
    const activity = makeActivity({ id: "act_099" });
    expect(passesFilters(activity, makeState({ rejectedIds: ["act_099"] }))).toBe(false);
    expect(passesFilters(activity, makeState({ rejectedIds: ["act_001"] }))).toBe(true);
  });

  it("excludeNeedsPrepが立っていれば準備が必要な候補を除外する(「面倒そう」による却下)", () => {
    const activity = makeActivity({ needs_prep: true });
    expect(passesFilters(activity, makeState({ excludeNeedsPrep: true }))).toBe(false);
    expect(passesFilters(activity, makeState({ excludeNeedsPrep: false }))).toBe(true);
    expect(passesFilters(makeActivity({ needs_prep: false }), makeState({ excludeNeedsPrep: true }))).toBe(true);
  });
});

describe("ruleMatchScore", () => {
  it("energyが完全一致なら1.0", () => {
    expect(ruleMatchScore(makeActivity({ energy: "medium" }), makeState({ energy: "medium" }))).toBe(1);
  });

  it("energyが1段差なら0.5", () => {
    expect(ruleMatchScore(makeActivity({ energy: "low" }), makeState({ energy: "medium" }))).toBe(0.5);
  });

  it("energyが2段差なら0", () => {
    expect(ruleMatchScore(makeActivity({ energy: "low" }), makeState({ energy: "high" }))).toBe(0);
  });

  it("penalizedCategoriesに含まれるカテゴリは半減する(「気分じゃない」による却下)", () => {
    const activity = makeActivity({ category: "food", energy: "low" });
    const state = makeState({ energy: "low", penalizedCategories: ["food"] });
    expect(ruleMatchScore(activity, state)).toBe(0.5);
    expect(ruleMatchScore(activity, makeState({ energy: "low", penalizedCategories: ["craft"] }))).toBe(1);
  });

  it("penalizeOutdoorが立っていれば屋外候補は半減する(「外に出たくない」による却下)", () => {
    const outdoor = makeActivity({ indoor: false, energy: "low" });
    const indoor = makeActivity({ indoor: true, energy: "low" });
    const state = makeState({ energy: "low", penalizeOutdoor: true });
    expect(ruleMatchScore(outdoor, state)).toBe(0.5);
    expect(ruleMatchScore(indoor, state)).toBe(1);
  });

  it("複数のペナルティは重ね掛けされる", () => {
    const activity = makeActivity({ category: "food", indoor: false, energy: "low" });
    const state = makeState({ energy: "low", penalizedCategories: ["food"], penalizeOutdoor: true });
    expect(ruleMatchScore(activity, state)).toBe(0.25);
  });
});

describe("filterCandidates", () => {
  it("条件を満たす候補だけを返す", () => {
    const catalog = [
      makeActivity({ id: "act_001", with: ["solo"] }),
      makeActivity({ id: "act_002", with: ["family"] }),
    ];
    const result = filterCandidates(catalog, makeState({ with: "solo" }));
    expect(result.map((a) => a.id)).toEqual(["act_001"]);
  });
});
