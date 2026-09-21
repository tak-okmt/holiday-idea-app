import { describe, expect, it } from "vitest";
import type { Activity } from "./catalog";
import { buildReason } from "./reason";
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

describe("buildReason", () => {
  it("CLAUDE.md記載の例文を再現する: 一人・雨・2時間以内", () => {
    const activity = makeActivity({ weather_ok: ["sunny", "cloudy", "rainy"] });
    const state = makeState({ with: "solo", weather: "rainy", time: "within_2h" });
    expect(buildReason(activity, state)).toBe("一人で、雨でも、2時間以内にできるので");
  });

  it("天気の指定がなければ雨の文言は入れない", () => {
    const activity = makeActivity();
    const state = makeState({ with: "friends", weather: undefined, time: "half_day" });
    expect(buildReason(activity, state)).toBe("友人と、半日でできるので");
  });

  it("候補が雨に対応していなければ雨の文言は入れない", () => {
    const activity = makeActivity({ weather_ok: ["sunny"] });
    const state = makeState({ with: "family", weather: "rainy", time: "full_day" });
    expect(buildReason(activity, state)).toBe("家族と、1日かけて楽しめるので");
  });
});
