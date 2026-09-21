"use server";

import { loadCatalog } from "@/engine/catalog";
import { JevJudge } from "@/engine/judge";
import { recommend } from "@/engine/recommend";
import { applyRejection, type RejectionReason } from "@/engine/rejection";
import { currentSeason } from "@/engine/season";
import { StateSchema, type State, type Suggestion } from "@/engine/types";

/** クライアントに渡す表示用の型。内部スコア(rule/jev)は含めない。 */
export interface SuggestionView {
  id: string;
  name: string;
  category: string;
  reason: string;
  pitch: string;
  firstStep: string;
}

export interface Answers {
  with: State["with"];
  energy: State["energy"];
  time: State["time"];
  budget: State["budget"];
  mood: string;
}

function toView(suggestion: Suggestion): SuggestionView {
  return {
    id: suggestion.activity.id,
    name: suggestion.activity.name,
    category: suggestion.activity.category,
    reason: suggestion.reason,
    pitch: suggestion.activity.pitch,
    firstStep: suggestion.activity.first_step,
  };
}

function buildInitialState(answers: Answers): State {
  return StateSchema.parse({
    with: answers.with,
    energy: answers.energy,
    time: answers.time,
    budget: answers.budget,
    mood: answers.mood || undefined,
    season: currentSeason(),
  });
}

export async function fetchSuggestions(
  answers: Answers
): Promise<{ state: State; suggestions: SuggestionView[] }> {
  const state = buildInitialState(answers);
  const catalog = loadCatalog();
  const judge = new JevJudge();
  const suggestions = await recommend(state, judge, catalog);
  return { state, suggestions: suggestions.map(toView) };
}

export type RejectInput =
  | { kind: "reason"; reason: RejectionReason }
  | { kind: "text"; text: string };

export async function rejectAndFetch(
  state: State,
  activityId: string,
  input: RejectInput
): Promise<{ state: State; suggestions: SuggestionView[]; classifiedReason: RejectionReason | null }> {
  const catalog = loadCatalog();
  const activity = catalog.find((a) => a.id === activityId);
  if (!activity) {
    throw new Error(`候補が見つかりません: ${activityId}`);
  }

  const judge = new JevJudge();
  const reason: RejectionReason | null =
    input.kind === "reason" ? input.reason : await judge.classifyReason(input.text);

  const nextState = reason
    ? applyRejection(state, activity, reason)
    : { ...state, rejectedIds: [...(state.rejectedIds ?? []), activity.id] };

  const suggestions = await recommend(nextState, judge, catalog);
  return { state: nextState, suggestions: suggestions.map(toView), classifiedReason: reason };
}
