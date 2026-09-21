"use client";

import { useState } from "react";
import {
  fetchSuggestions,
  rejectAndFetch,
  type Answers,
  type RejectInput,
  type SuggestionView,
} from "./actions";
import { REJECTION_REASONS, type RejectionReason } from "@/engine/rejection";
import type { State } from "@/engine/types";
import styles from "./planner.module.css";

const WITH_OPTIONS: { value: Answers["with"]; label: string }[] = [
  { value: "solo", label: "一人" },
  { value: "partner", label: "パートナー" },
  { value: "friends", label: "友人" },
  { value: "family", label: "家族・子ども" },
];

const ENERGY_OPTIONS: { value: Answers["energy"]; label: string }[] = [
  { value: "low", label: "ゴロゴロしたい" },
  { value: "medium", label: "ほどほど" },
  { value: "high", label: "しっかり動きたい" },
];

const TIME_OPTIONS: { value: Answers["time"]; label: string }[] = [
  { value: "within_2h", label: "2時間以内" },
  { value: "half_day", label: "半日" },
  { value: "full_day", label: "1日" },
];

const BUDGET_OPTIONS: { value: Answers["budget"]; label: string }[] = [
  { value: "free", label: "0円" },
  { value: "under3000", label: "3千円くらいまで" },
  { value: "unlimited", label: "気にしない" },
];

const REASON_LABELS: Record<RejectionReason, string> = {
  money: "お金がかかる",
  hassle: "面倒そう",
  been_there: "やったことある",
  not_in_mood: "気分じゃない",
  stay_home: "外に出たくない",
};

type Screen =
  | { step: "form" }
  | { step: "loading" }
  | { step: "results"; state: State; suggestions: SuggestionView[] }
  | { step: "error"; message: string };

function ActivityCard({
  suggestion,
  onReject,
}: {
  suggestion: SuggestionView;
  onReject: (input: RejectInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [otherText, setOtherText] = useState("");

  return (
    <li className={styles.card}>
      <div className={styles.cardCategory}>{suggestion.category}</div>
      <h3 className={styles.cardTitle}>{suggestion.name}</h3>
      <p className={styles.cardReason}>{suggestion.reason}</p>
      <p className={styles.cardPitch}>{suggestion.pitch}</p>
      <p className={styles.cardFirstStep}>最初の一歩: {suggestion.firstStep}</p>

      {!open ? (
        <button type="button" className={styles.rejectButton} onClick={() => setOpen(true)}>
          違うな
        </button>
      ) : (
        <div className={styles.reasonPicker}>
          <p className={styles.reasonPickerLabel}>理由を教えてください</p>
          <div className={styles.reasonButtons}>
            {REJECTION_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className={styles.reasonButton}
                onClick={() => onReject({ kind: "reason", reason })}
              >
                {REASON_LABELS[reason]}
              </button>
            ))}
          </div>
          <div className={styles.otherRow}>
            <input
              type="text"
              className={styles.otherInput}
              placeholder="その他（自由に書いてください）"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
            />
            <button
              type="button"
              className={styles.otherSubmit}
              disabled={otherText.trim() === ""}
              onClick={() => onReject({ kind: "text", text: otherText.trim() })}
            >
              送信
            </button>
          </div>
          <button type="button" className={styles.cancelButton} onClick={() => setOpen(false)}>
            キャンセル
          </button>
        </div>
      )}
    </li>
  );
}

export function Planner() {
  const [screen, setScreen] = useState<Screen>({ step: "form" });
  const [withValue, setWithValue] = useState<Answers["with"] | null>(null);
  const [energyValue, setEnergyValue] = useState<Answers["energy"] | null>(null);
  const [timeValue, setTimeValue] = useState<Answers["time"] | null>(null);
  const [budgetValue, setBudgetValue] = useState<Answers["budget"] | null>(null);
  const [mood, setMood] = useState("");

  const canSubmit = withValue && energyValue && timeValue && budgetValue;

  async function handleSubmit() {
    if (!withValue || !energyValue || !timeValue || !budgetValue) return;
    setScreen({ step: "loading" });
    try {
      const result = await fetchSuggestions({
        with: withValue,
        energy: energyValue,
        time: timeValue,
        budget: budgetValue,
        mood,
      });
      setScreen({ step: "results", state: result.state, suggestions: result.suggestions });
    } catch (err) {
      setScreen({ step: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleReject(currentState: State, activityId: string, input: RejectInput) {
    setScreen({ step: "loading" });
    try {
      const result = await rejectAndFetch(currentState, activityId, input);
      setScreen({ step: "results", state: result.state, suggestions: result.suggestions });
    } catch (err) {
      setScreen({ step: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  function handleReset() {
    setWithValue(null);
    setEnergyValue(null);
    setTimeValue(null);
    setBudgetValue(null);
    setMood("");
    setScreen({ step: "form" });
  }

  if (screen.step === "loading") {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>提案を考えています…</p>
      </div>
    );
  }

  if (screen.step === "error") {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>エラーが発生しました: {screen.message}</p>
        <button type="button" className={styles.submitButton} onClick={handleReset}>
          最初からやり直す
        </button>
      </div>
    );
  }

  if (screen.step === "results") {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>今日はこれ、どう？</h1>
        {screen.suggestions.length === 0 ? (
          <>
            <p className={styles.empty}>条件に合う候補が見つかりませんでした。</p>
            <button type="button" className={styles.submitButton} onClick={handleReset}>
              最初からやり直す
            </button>
          </>
        ) : (
          <ul className={styles.cardList}>
            {screen.suggestions.map((s) => (
              <ActivityCard
                key={s.id}
                suggestion={s}
                onReject={(input) => handleReject(screen.state, s.id, input)}
              />
            ))}
          </ul>
        )}
        <button type="button" className={styles.linkButton} onClick={handleReset}>
          最初からやり直す
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>休日アイデア提案</h1>

      <section className={styles.question}>
        <h2 className={styles.questionTitle}>誰と過ごす？</h2>
        <div className={styles.optionRow}>
          {WITH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={withValue === opt.value}
              className={withValue === opt.value ? styles.optionSelected : styles.option}
              onClick={() => setWithValue(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.question}>
        <h2 className={styles.questionTitle}>今日の気力は？</h2>
        <div className={styles.optionRow}>
          {ENERGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={energyValue === opt.value}
              className={energyValue === opt.value ? styles.optionSelected : styles.option}
              onClick={() => setEnergyValue(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.question}>
        <h2 className={styles.questionTitle}>使える時間は？</h2>
        <div className={styles.optionRow}>
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={timeValue === opt.value}
              className={timeValue === opt.value ? styles.optionSelected : styles.option}
              onClick={() => setTimeValue(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.question}>
        <h2 className={styles.questionTitle}>予算は？</h2>
        <div className={styles.optionRow}>
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={budgetValue === opt.value}
              className={budgetValue === opt.value ? styles.optionSelected : styles.option}
              onClick={() => setBudgetValue(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.question}>
        <h2 className={styles.questionTitle}>今の気分をひとこと（任意）</h2>
        <input
          type="text"
          className={styles.moodInput}
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="例: のんびりしたい、体を動かしたい…"
        />
      </section>

      <button
        type="button"
        className={styles.submitButton}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        提案してもらう
      </button>
    </div>
  );
}
