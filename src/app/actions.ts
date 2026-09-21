"use server";

import { loadCatalog } from "@/engine/catalog";
import { JevJudge } from "@/engine/judge";
import { recommend } from "@/engine/recommend";
import { applyRejection, type RejectionReason } from "@/engine/rejection";
import { currentSeason } from "@/engine/season";
import { StateSchema, type State, type Suggestion } from "@/engine/types";
import {
  logDecision as recordDecision,
  logRejection,
  logSessionAndAnswers,
  logSuggestions,
} from "@/lib/log";

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
  sessionId: string,
  answers: Answers
): Promise<{ state: State; suggestions: SuggestionView[]; round: number }> {
  const state = buildInitialState(answers);
  const catalog = loadCatalog();
  const judge = new JevJudge();
  const suggestions = await recommend(state, judge, catalog);

  const round = 0;
  await logSessionAndAnswers(sessionId, state);
  await logSuggestions(sessionId, round, suggestions);

  return { state, suggestions: suggestions.map(toView), round };
}

export type RejectInput =
  | { kind: "reason"; reason: RejectionReason }
  | { kind: "text"; text: string };

export async function rejectAndFetch(
  sessionId: string,
  state: State,
  round: number,
  activityId: string,
  input: RejectInput
): Promise<{
  state: State;
  suggestions: SuggestionView[];
  classifiedReason: RejectionReason | null;
  round: number;
}> {
  const catalog = loadCatalog();
  const activity = catalog.find((a) => a.id === activityId);
  if (!activity) {
    throw new Error(`候補が見つかりません: ${activityId}`);
  }

  const judge = new JevJudge();
  const reason: RejectionReason | null =
    input.kind === "reason" ? input.reason : await judge.classifyReason(input.text);

  await logRejection(sessionId, round, activityId, {
    reason: input.kind === "reason" ? input.reason : undefined,
    freeText: input.kind === "text" ? input.text : undefined,
    classifiedReason: input.kind === "text" ? reason : undefined,
  });

  const nextState = reason
    ? applyRejection(state, activity, reason)
    : { ...state, rejectedIds: [...(state.rejectedIds ?? []), activity.id] };

  const nextRound = round + 1;
  const suggestions = await recommend(nextState, judge, catalog);
  await logSuggestions(sessionId, nextRound, suggestions);

  return {
    state: nextState,
    suggestions: suggestions.map(toView),
    classifiedReason: reason,
    round: nextRound,
  };
}

export async function logDecision(sessionId: string, activityId: string): Promise<void> {
  await recordDecision(sessionId, activityId);
}
