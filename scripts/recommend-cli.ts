import { parseArgs } from "node:util";
import type { Activity } from "../src/engine/catalog";
import { loadCatalog } from "../src/engine/catalog";
import { JevJudge } from "../src/engine/judge";
import { recommend } from "../src/engine/recommend";
import { applyRejection, REJECTION_REASONS, type RejectionReason } from "../src/engine/rejection";
import { StateSchema, type State, type Suggestion } from "../src/engine/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local が無い場合はシェルの環境変数をそのまま使う
}

function currentSeason(date = new Date()): State["season"] {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

// pnpm は `pnpm run recommend -- --with=solo` の "--" 自体を引数として渡してくる。
// parseArgsは素の"--"を「オプション終端」とみなし以降を全て位置引数にしてしまうため、
// 事前に取り除く。
const args = process.argv.slice(2).filter((arg) => arg !== "--");

const { values } = parseArgs({
  args,
  options: {
    with: { type: "string" },
    energy: { type: "string" },
    time: { type: "string" },
    budget: { type: "string" },
    mood: { type: "string" },
    weather: { type: "string" },
    season: { type: "string" },
    rejected: { type: "string", multiple: true, default: [] },
    "reject-id": { type: "string" },
    "reject-reason": { type: "string" },
    "reject-text": { type: "string" },
  },
});

function printUsageAndExit(message: string): never {
  console.error(message);
  console.error(
    "\n使い方: pnpm run recommend -- --with=solo --energy=medium --time=within_2h --budget=under3000 [--mood=\"...\"] [--weather=rainy] [--season=autumn] [--rejected=act_001]"
  );
  console.error("  with: solo | partner | friends | family");
  console.error("  energy: low | medium | high");
  console.error("  time: within_2h | half_day | full_day");
  console.error("  budget: free | under3000 | unlimited");
  console.error("  weather(任意): sunny | cloudy | rainy");
  console.error(
    "\n「違うな」の再ランキングを試す場合(1回目の提案の中から --reject-id で候補を指定):"
  );
  console.error(`  --reject-id=act_XXX --reject-reason=<${REJECTION_REASONS.join("|")}>`);
  console.error("  --reject-id=act_XXX --reject-text=\"お金かかりそうだしな\" (Jevのchoiceで理由を分類)");
  process.exit(1);
}

const parsed = StateSchema.safeParse({
  with: values.with,
  energy: values.energy,
  time: values.time,
  budget: values.budget,
  mood: values.mood,
  weather: values.weather,
  season: values.season ?? currentSeason(),
  rejectedIds: values.rejected,
});

if (!parsed.success) {
  printUsageAndExit(`入力が不正です: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ")}`);
}

const state = parsed.data;

if (values["reject-id"] && !values["reject-reason"] && !values["reject-text"]) {
  printUsageAndExit("--reject-id 指定時は --reject-reason か --reject-text のどちらかが必要です");
}
if (values["reject-reason"] && !REJECTION_REASONS.includes(values["reject-reason"] as RejectionReason)) {
  printUsageAndExit(`--reject-reason は ${REJECTION_REASONS.join("|")} のいずれかにしてください`);
}

function printSuggestions(suggestions: Suggestion[]) {
  if (suggestions.length === 0) {
    console.log("条件に合う候補が見つかりませんでした。");
    return;
  }
  suggestions.forEach((s, i) => {
    console.log(`${i + 1}. ${s.activity.name} [${s.activity.category}]`);
    console.log(`   ${s.reason}`);
    console.log(`   ${s.activity.pitch}`);
    console.log(`   最初の一歩: ${s.activity.first_step}`);
    const jevScoreText = s.jevScore === null ? "N/A" : s.jevScore.toFixed(2);
    console.log(
      `   score: rule=${s.ruleScore.toFixed(2)} jev=${jevScoreText} final=${s.finalScore.toFixed(2)}`
    );
    console.log();
  });
}

async function main() {
  const catalog = loadCatalog();
  const judge = new JevJudge();

  console.log(`条件: ${JSON.stringify(state)}`);
  console.log();
  const suggestions = await recommend(state, judge, catalog);
  printSuggestions(suggestions);

  const rejectId = values["reject-id"];
  if (!rejectId) return;

  const rejected: Activity | undefined = catalog.find((a) => a.id === rejectId);
  if (!rejected) {
    console.error(`--reject-id=${rejectId} はカタログに見つかりません`);
    process.exitCode = 1;
    return;
  }

  let reason: RejectionReason | null;
  if (values["reject-reason"]) {
    reason = values["reject-reason"] as RejectionReason;
  } else {
    reason = await judge.classifyReason(values["reject-text"]!);
    console.log(`Jevによる理由分類: ${reason ?? "分類できませんでした(却下idの除外のみ行います)"}`);
  }

  const nextState = reason ? applyRejection(state, rejected, reason) : { ...state, rejectedIds: [...(state.rejectedIds ?? []), rejected.id] };

  console.log(`\n--- 「${rejected.name}」を却下後 ---`);
  console.log(`更新後の条件: ${JSON.stringify(nextState)}`);
  console.log();
  const nextSuggestions = await recommend(nextState, judge, catalog);
  printSuggestions(nextSuggestions);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
