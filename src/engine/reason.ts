import type { Activity } from "./catalog";
import type { State } from "./types";

const WITH_PHRASE: Record<State["with"], string> = {
  solo: "一人で",
  partner: "パートナーと",
  friends: "友人と",
  family: "家族と",
};

const TIME_PHRASE: Record<State["time"], string> = {
  within_2h: "2時間以内にできる",
  half_day: "半日でできる",
  full_day: "1日かけて楽しめる",
};

/**
 * カタログの事前生成テキスト(pitch/first_step)とは別に、一致条件から組み立てる短い理由文。
 * 例:「一人で、雨でも、2時間以内にできるので」
 */
export function buildReason(activity: Activity, state: State): string {
  const parts: string[] = [WITH_PHRASE[state.with]];
  if (state.weather === "rainy" && activity.weather_ok.includes("rainy")) {
    parts.push("雨でも");
  }
  parts.push(TIME_PHRASE[state.time]);
  return `${parts.join("、")}ので`;
}
