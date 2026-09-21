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

const QUESTION_STEPS = ["with", "energy", "time", "budget", "mood"] as const;
/** 進捗表示の分母。moodは任意なのでカウントしない。 */
const REQUIRED_QUESTION_COUNT = 4;

type Screen =
  | { step: "question"; index: number }
  | { step: "loading" }
  | { step: "result"; state: State; suggestion: SuggestionView }
  | { step: "decided"; suggestion: SuggestionView }
  | { step: "empty" }
  | { step: "error"; message: string };

function ReasonPicker({ onReject }: { onReject: (input: RejectInput) => void }) {
  const [otherText, setOtherText] = useState("");
  return (
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
    </div>
  );
}

export function Planner() {
  const [screen, setScreen] = useState<Screen>({ step: "question", index: 0 });
  const [withValue, setWithValue] = useState<Answers["with"] | null>(null);
  const [energyValue, setEnergyValue] = useState<Answers["energy"] | null>(null);
  const [timeValue, setTimeValue] = useState<Answers["time"] | null>(null);
  const [budgetValue, setBudgetValue] = useState<Answers["budget"] | null>(null);
  const [mood, setMood] = useState("");
  const [showReasonPicker, setShowReasonPicker] = useState(false);

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
      if (result.suggestions.length === 0) {
        setScreen({ step: "empty" });
      } else {
        setScreen({ step: "result", state: result.state, suggestion: result.suggestions[0] });
      }
    } catch (err) {
      setScreen({ step: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  function goToQuestion(index: number) {
    if (index >= QUESTION_STEPS.length) {
      void handleSubmit();
      return;
    }
    setShowReasonPicker(false);
    setScreen({ step: "question", index });
  }

  function answerWith(value: Answers["with"], nextIndex: number) {
    setWithValue(value);
    goToQuestion(nextIndex);
  }
  function answerEnergy(value: Answers["energy"], nextIndex: number) {
    setEnergyValue(value);
    goToQuestion(nextIndex);
  }
  function answerTime(value: Answers["time"], nextIndex: number) {
    setTimeValue(value);
    goToQuestion(nextIndex);
  }
  function answerBudget(value: Answers["budget"], nextIndex: number) {
    setBudgetValue(value);
    goToQuestion(nextIndex);
  }

  async function handleReject(currentState: State, activityId: string, input: RejectInput) {
    setScreen({ step: "loading" });
    setShowReasonPicker(false);
    try {
      const result = await rejectAndFetch(currentState, activityId, input);
      if (result.suggestions.length === 0) {
        setScreen({ step: "empty" });
      } else {
        setScreen({ step: "result", state: result.state, suggestion: result.suggestions[0] });
      }
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
    setShowReasonPicker(false);
    setScreen({ step: "question", index: 0 });
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

  if (screen.step === "decided") {
    const s = screen.suggestion;
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>決まり！</h1>
        <div className={styles.card}>
          <div className={styles.cardCategory}>{s.category}</div>
          <h3 className={styles.cardTitle}>{s.name}</h3>
          <p className={styles.cardFirstStep}>最初の一歩: {s.firstStep}</p>
        </div>
        <p className={styles.decidedMessage}>良い休日を！</p>
        <button type="button" className={styles.linkButton} onClick={handleReset}>
          また最初から選ぶ
        </button>
      </div>
    );
  }

  if (screen.step === "empty") {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>条件に合う候補が見つかりませんでした。</p>
        <button type="button" className={styles.submitButton} onClick={handleReset}>
          最初からやり直す
        </button>
      </div>
    );
  }

  if (screen.step === "result") {
    const s = screen.suggestion;
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>今日はこれ、どう？</h1>
        <div className={styles.card}>
          <div className={styles.cardCategory}>{s.category}</div>
          <h3 className={styles.cardTitle}>{s.name}</h3>
          <p className={styles.cardReason}>{s.reason}</p>
          <p className={styles.cardPitch}>{s.pitch}</p>
          <p className={styles.cardFirstStep}>最初の一歩: {s.firstStep}</p>

          {!showReasonPicker ? (
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.acceptButton}
                onClick={() => setScreen({ step: "decided", suggestion: s })}
              >
                これにする！
              </button>
              <button
                type="button"
                className={styles.rejectButton}
                onClick={() => setShowReasonPicker(true)}
              >
                違うな
              </button>
            </div>
          ) : (
            <>
              <ReasonPicker
                onReject={(input) => handleReject(screen.state, s.id, input)}
              />
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowReasonPicker(false)}
              >
                キャンセル
              </button>
            </>
          )}
        </div>
        <button type="button" className={styles.linkButton} onClick={handleReset}>
          最初からやり直す
        </button>
      </div>
    );
  }

  // screen.step === "question"
  const question = QUESTION_STEPS[screen.index];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>休日アイデア提案</h1>
      {question !== "mood" && (
        <p className={styles.progress}>
          質問 {screen.index + 1}/{REQUIRED_QUESTION_COUNT}
        </p>
      )}

      {question === "with" && (
        <section className={styles.question}>
          <h2 className={styles.questionTitle}>誰と過ごす？</h2>
          <div className={styles.optionRow}>
            {WITH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={withValue === opt.value}
                className={withValue === opt.value ? styles.optionSelected : styles.option}
                onClick={() => answerWith(opt.value, screen.index + 1)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {question === "energy" && (
        <section className={styles.question}>
          <h2 className={styles.questionTitle}>今日の気力は？</h2>
          <div className={styles.optionRow}>
            {ENERGY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={energyValue === opt.value}
                className={energyValue === opt.value ? styles.optionSelected : styles.option}
                onClick={() => answerEnergy(opt.value, screen.index + 1)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {question === "time" && (
        <section className={styles.question}>
          <h2 className={styles.questionTitle}>使える時間は？</h2>
          <div className={styles.optionRow}>
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={timeValue === opt.value}
                className={timeValue === opt.value ? styles.optionSelected : styles.option}
                onClick={() => answerTime(opt.value, screen.index + 1)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {question === "budget" && (
        <section className={styles.question}>
          <h2 className={styles.questionTitle}>予算は？</h2>
          <div className={styles.optionRow}>
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={budgetValue === opt.value}
                className={budgetValue === opt.value ? styles.optionSelected : styles.option}
                onClick={() => answerBudget(opt.value, screen.index + 1)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {question === "mood" && (
        <section className={styles.question}>
          <h2 className={styles.questionTitle}>今の気分をひとこと（任意）</h2>
          <input
            type="text"
            className={styles.moodInput}
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToQuestion(screen.index + 1);
            }}
            placeholder="例: のんびりしたい、体を動かしたい…"
          />
          <button
            type="button"
            className={styles.submitButton}
            onClick={() => goToQuestion(screen.index + 1)}
          >
            提案してもらう
          </button>
        </section>
      )}

      {screen.index > 0 && (
        <button type="button" className={styles.linkButton} onClick={() => goToQuestion(screen.index - 1)}>
          戻る
        </button>
      )}
    </div>
  );
}
