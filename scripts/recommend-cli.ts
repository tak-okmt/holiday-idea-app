import { parseArgs } from "node:util";
import { loadCatalog } from "../src/engine/catalog";
import { JevJudge } from "../src/engine/judge";
import { recommend } from "../src/engine/recommend";
import { StateSchema, type State } from "../src/engine/types";

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

async function main() {
  const catalog = loadCatalog();
  const judge = new JevJudge();
  const suggestions = await recommend(state, judge, catalog);

  console.log(`条件: ${JSON.stringify(state)}`);
  console.log();

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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
