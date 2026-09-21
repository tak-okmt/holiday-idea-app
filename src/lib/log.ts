import type { RejectionReason } from "@/engine/rejection";
import type { State, Suggestion } from "@/engine/types";
import { createLogClient } from "./supabase";

/**
 * ログ保存はアプリの動作に必須ではない。SUPABASE_URL/SUPABASE_ANON_KEY未設定時や
 * 書き込み失敗時はコンソールに警告するだけで、呼び出し元には例外を投げない
 * (Jevの障害でアプリを止めない、と同じ方針)。
 */
function warn(label: string, err: unknown) {
  console.warn(
    `[log] ${label}の記録に失敗しました(ログはスキップしてアプリは継続します): ${
      err instanceof Error ? err.message : String(err)
    }`
  );
}

export async function logSessionAndAnswers(sessionId: string, state: State): Promise<void> {
  const client = createLogClient();
  if (!client) return;
  try {
    const { error: sessionError } = await client.from("sessions").insert({ session_id: sessionId });
    if (sessionError) throw sessionError;

    const { error: answersError } = await client.from("answers").insert({
      session_id: sessionId,
      with_value: state.with,
      energy: state.energy,
      time_value: state.time,
      budget: state.budget,
      mood: state.mood ?? null,
      weather: state.weather ?? null,
      season: state.season,
    });
    if (answersError) throw answersError;
  } catch (err) {
    warn("セッション/回答", err);
  }
}

export async function logSuggestions(
  sessionId: string,
  round: number,
  suggestions: Suggestion[]
): Promise<void> {
  if (suggestions.length === 0) return;
  const client = createLogClient();
  if (!client) return;
  try {
    const rows = suggestions.map((s, i) => ({
      session_id: sessionId,
      round,
      activity_id: s.activity.id,
      rank: i + 1,
      rule_score: s.ruleScore,
      jev_score: s.jevScore,
      final_score: s.finalScore,
    }));
    const { error } = await client.from("suggestions").insert(rows);
    if (error) throw error;
  } catch (err) {
    warn("提案", err);
  }
}

export async function logRejection(
  sessionId: string,
  round: number,
  activityId: string,
  input: { reason?: RejectionReason; freeText?: string; classifiedReason?: RejectionReason | null }
): Promise<void> {
  const client = createLogClient();
  if (!client) return;
  try {
    const { error } = await client.from("rejections").insert({
      session_id: sessionId,
      round,
      activity_id: activityId,
      reason: input.reason ?? input.classifiedReason ?? null,
      free_text: input.freeText ?? null,
      classified_reason: input.classifiedReason ?? null,
    });
    if (error) throw error;
  } catch (err) {
    warn("却下", err);
  }
}

export async function logDecision(sessionId: string, activityId: string): Promise<void> {
  const client = createLogClient();
  if (!client) return;
  try {
    const { error } = await client.from("decisions").insert({ session_id: sessionId, activity_id: activityId });
    if (error) throw error;
  } catch (err) {
    warn("決定", err);
  }
}
