import { writeFileSync } from "node:fs";
import { choice, score, TypeSafeClient, TypeSafeError } from "@typesafe-ai/sdk";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local が無い場合はシェルの環境変数をそのまま使う
}

const client = new TypeSafeClient();

const FIT_LEVELS = [
  "全く合わない",
  "あまり合わない",
  "まあまあ合う",
  "よく合う",
  "非常によく合う",
] as const;

const REASON_CRITERIA = {
  money: "お金がかかるという理由",
  hassle: "準備や手間が面倒だという理由",
  been_there: "すでにやったことがあるという理由",
  not_in_mood: "今の気分ではないという理由",
  stay_home: "外に出たくないという理由",
} as const;

type Profile = {
  with: string;
  energy: string;
  time: string;
  budget: string;
  season: string;
  weather: string;
};

type CandidateBrief = {
  name: string;
  category: string;
  pitch: string;
  indoor: boolean;
  energy: string;
};

type FitCase = {
  id: string;
  label: string;
  profile: Profile;
  mood: string;
  candidates: CandidateBrief[];
};

type ReasonCase = {
  id: string;
  label: string;
  message: string;
};

const fitCases: FitCase[] = [
  {
    id: "fit_01",
    label: "友人と体を動かしたい気分",
    profile: { with: "friends", energy: "high", time: "2h", budget: "under3000", season: "autumn", weather: "sunny" },
    mood: "体を動かしたい気分",
    candidates: [
      { name: "ジョギングで近所を軽く走る", category: "sports", pitch: "短時間でも体を動かすと、頭がすっきりして気分が切り替わる。", indoor: false, energy: "high" },
      { name: "湯船にゆっくり浸かって半身浴をする", category: "rest", pitch: "お湯に浸かる時間そのものが、心身をゆるめてくれる。", indoor: true, energy: "low" },
      { name: "ボードゲームカフェで新作ゲームを遊ぶ", category: "play", pitch: "スタッフに説明してもらいながら、知らないゲームにも気軽に挑戦できる。", indoor: true, energy: "medium" },
    ],
  },
  {
    id: "fit_02",
    label: "ひとりで疲れていて何もしたくないが家にこもりきりも嫌",
    profile: { with: "solo", energy: "low", time: "half_day", budget: "free", season: "winter", weather: "cloudy" },
    mood: "何もしたくないけど、家にずっといるのもな",
    candidates: [
      { name: "何も予定を入れずに家でゴロゴロして過ごす", category: "rest", pitch: "何もしないと決めることも、立派な休日の過ごし方のひとつ。", indoor: true, energy: "low" },
      { name: "河原や海辺を散歩して景色を眺める", category: "nature", pitch: "水辺を歩くだけで気分が切り替わる、準備いらずの気分転換。", indoor: false, energy: "low" },
      { name: "カラオケで好きな曲を歌いまくる", category: "play", pitch: "声を出して歌うだけで、たまったストレスがすっきり発散できる。", indoor: true, energy: "high" },
    ],
  },
  {
    id: "fit_03",
    label: "子ども連れの家族、晴れた半日",
    profile: { with: "family", energy: "medium", time: "half_day", budget: "under3000", season: "spring", weather: "sunny" },
    mood: "",
    candidates: [
      { name: "子どもと一緒に公園で遊具遊びをする", category: "social", pitch: "一緒に体を動かして遊ぶだけで、子どもとの距離がぐっと縮まる。", indoor: false, energy: "medium" },
      { name: "博物館や科学館で展示をじっくり見る", category: "learning", pitch: "普段考えない分野の展示を見ると、頭の中がリフレッシュされる。", indoor: true, energy: "low" },
      { name: "ボウリングでスコアを競う", category: "sports", pitch: "力加減を工夫するだけで盛り上がる、幅広い世代で楽しめる遊び。", indoor: true, energy: "medium" },
    ],
  },
  {
    id: "fit_04",
    label: "パートナーと雨の日、気持ちは揺れている",
    profile: { with: "partner", energy: "medium", time: "2h", budget: "under3000", season: "summer", weather: "rainy" },
    mood: "雨だから家系じゃなくて外に出たい気分だけど、雨だし迷う",
    candidates: [
      { name: "美術館で企画展をじっくり見て回る", category: "appreciation", pitch: "作品の前で立ち止まる時間そのものが、贅沢な気分転換になる。", indoor: true, energy: "low" },
      { name: "ボードゲームカフェで新作ゲームを遊ぶ", category: "play", pitch: "スタッフに説明してもらいながら、知らないゲームにも気軽に挑戦できる。", indoor: true, energy: "medium" },
      { name: "湯船にゆっくり浸かって半身浴をする", category: "rest", pitch: "お湯に浸かる時間そのものが、心身をゆるめてくれる。", indoor: true, energy: "low" },
    ],
  },
  {
    id: "fit_05",
    label: "ひとりで非日常を味わいたい、予算気にしない",
    profile: { with: "solo", energy: "high", time: "full_day", budget: "unlimited", season: "autumn", weather: "sunny" },
    mood: "非日常を味わいたい",
    candidates: [
      { name: "陶芸体験用の粘土で器を1つ成形する", category: "craft", pitch: "粘土をこねて形にする作業は、無心になれる時間を作ってくれる。", indoor: true, energy: "medium" },
      { name: "気になっていた映画を映画館で観る", category: "appreciation", pitch: "大きなスクリーンに集中するだけで、日常から離れられる。", indoor: true, energy: "low" },
      { name: "ライブハウスやコンサートで生演奏を聴く", category: "appreciation", pitch: "生の音を浴びる体験は、配信では味わえない高揚感がある。", indoor: true, energy: "medium" },
    ],
  },
  {
    id: "fit_06",
    label: "友人グループでワイワイしたい、雨、短時間",
    profile: { with: "friends", energy: "medium", time: "2h", budget: "under3000", season: "winter", weather: "rainy" },
    mood: "みんなでワイワイしたい",
    candidates: [
      { name: "カラオケで好きな曲を歌いまくる", category: "play", pitch: "声を出して歌うだけで、たまったストレスがすっきり発散できる。", indoor: true, energy: "high" },
      { name: "アロマを焚いてソファで読みかけの本を眺める", category: "rest", pitch: "香りと読書を組み合わせるだけで、いつもの部屋が休息の空間になる。", indoor: true, energy: "low" },
      { name: "友人を家に呼んでゲーム会をする", category: "social", pitch: "好きなゲームを囲むだけで、自然と会話も盛り上がる。", indoor: true, energy: "medium" },
    ],
  },
];

const reasonCases: ReasonCase[] = [
  { id: "reason_01", label: "お金がかかる(想定)", message: "うーん、これ結構お金かかりそうだからパス" },
  { id: "reason_02", label: "面倒そう(想定)", message: "準備するもの多くて面倒くさそう" },
  { id: "reason_03", label: "やったことある(想定)", message: "これもう何回もやったことあるんだよね" },
  { id: "reason_04", label: "気分じゃない(想定)", message: "なんか今日はそんな気分じゃないかな、別の感じがいい" },
];

type FitResult = {
  case: FitCase;
  ok: true;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  scores: { name: string; score: number; confidence: number }[];
} | { case: FitCase; ok: false; latencyMs: number; error: string };

type ReasonResult = {
  case: ReasonCase;
  ok: true;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
} | { case: ReasonCase; ok: false; latencyMs: number; error: string };

async function runFitCase(c: FitCase): Promise<FitResult> {
  const questions = Object.fromEntries(
    c.candidates.map((_, i) => [
      `fit_${i}`,
      score(
        `\`candidates[${i}]\` は、\`profile\`（誰と/気力/使える時間/予算/季節/天気）と \`mood\` を踏まえて、今のユーザーにどれくらい合いますか？`,
        FIT_LEVELS
      ),
    ])
  );

  const start = Date.now();
  try {
    const result = await client.systemOne({
      state: { profile: c.profile, mood: c.mood, candidates: c.candidates },
      questions,
    });
    const latencyMs = Date.now() - start;
    const scores = c.candidates.map((cand, i) => {
      const answer = result.answers[`fit_${i}`];
      return { name: cand.name, score: answer.score, confidence: answer.confidence };
    });
    return {
      case: c,
      ok: true,
      latencyMs,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      scores,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof TypeSafeError ? err.message : String(err);
    return { case: c, ok: false, latencyMs, error: message };
  }
}

async function runReasonCase(c: ReasonCase): Promise<ReasonResult> {
  const start = Date.now();
  try {
    const result = await client.systemOne({
      state: { message: c.message },
      questions: {
        reason: choice(
          "`message` は、次のどの却下理由に最も近いですか？",
          REASON_CRITERIA
        ),
      },
    });
    const latencyMs = Date.now() - start;
    const answer = result.answers.reason;
    return {
      case: c,
      ok: true,
      latencyMs,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof TypeSafeError ? err.message : String(err);
    return { case: c, ok: false, latencyMs, error: message };
  }
}

async function main() {
  console.log(`Jev探索: score型 ${fitCases.length}ケース + choice型 ${reasonCases.length}ケース\n`);

  const fitResults: FitResult[] = [];
  for (const c of fitCases) {
    console.log(`--- [${c.id}] ${c.label} ---`);
    const r = await runFitCase(c);
    fitResults.push(r);
    if (r.ok) {
      for (const s of r.scores) {
        console.log(`  ${s.name.padEnd(28)} score=${s.score.toFixed(2)} confidence=${s.confidence.toFixed(2)}`);
      }
      console.log(`  latency=${r.latencyMs}ms tokens(in/out)=${r.inputTokens}/${r.outputTokens}`);
    } else {
      console.log(`  ERROR: ${r.error} (latency=${r.latencyMs}ms)`);
    }
    console.log();
  }

  const reasonResults: ReasonResult[] = [];
  for (const c of reasonCases) {
    console.log(`--- [${c.id}] ${c.label} ---`);
    console.log(`  発言: "${c.message}"`);
    const r = await runReasonCase(c);
    reasonResults.push(r);
    if (r.ok) {
      console.log(`  choice=${r.choice} confidence=${r.confidence.toFixed(2)}`);
      console.log(`  probabilities: ${JSON.stringify(r.probabilities)}`);
      console.log(`  latency=${r.latencyMs}ms tokens(in/out)=${r.inputTokens}/${r.outputTokens}`);
    } else {
      console.log(`  ERROR: ${r.error} (latency=${r.latencyMs}ms)`);
    }
    console.log();
  }

  writeMarkdownReport(fitResults, reasonResults);
}

function writeMarkdownReport(fitResults: FitResult[], reasonResults: ReasonResult[]) {
  const lines: string[] = [];
  lines.push("# Jev探索結果 (週末2)");
  lines.push("");
  lines.push(`実行日時: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## score型: 候補適合度スコアリング (6ケース)");
  lines.push("");
  for (const r of fitResults) {
    lines.push(`### [${r.case.id}] ${r.case.label}`);
    lines.push(`- profile: \`${JSON.stringify(r.case.profile)}\``);
    lines.push(`- mood: "${r.case.mood}"`);
    if (r.ok) {
      lines.push(`- latency: ${r.latencyMs}ms / tokens(in/out): ${r.inputTokens}/${r.outputTokens}`);
      lines.push("");
      lines.push("| 候補 | score(0-4) | confidence |");
      lines.push("|---|---|---|");
      for (const s of r.scores) {
        lines.push(`| ${s.name} | ${s.score.toFixed(2)} | ${s.confidence.toFixed(2)} |`);
      }
    } else {
      lines.push(`- ERROR: ${r.error} (latency: ${r.latencyMs}ms)`);
    }
    lines.push("");
  }

  lines.push("## choice型: 自由記述の却下理由分類 (4ケース)");
  lines.push("");
  lines.push("| ケース | 発言 | 分類結果 | confidence | 確率分布 |");
  lines.push("|---|---|---|---|---|");
  for (const r of reasonResults) {
    if (r.ok) {
      lines.push(
        `| ${r.case.id} | ${r.case.message} | ${r.choice} | ${r.confidence.toFixed(2)} | ${JSON.stringify(r.probabilities)} |`
      );
    } else {
      lines.push(`| ${r.case.id} | ${r.case.message} | ERROR: ${r.error} | - | - |`);
    }
  }
  lines.push("");

  const okFit = fitResults.filter((r): r is Extract<FitResult, { ok: true }> => r.ok);
  const totalLatency = [...okFit, ...reasonResults.filter((r): r is Extract<ReasonResult, { ok: true }> => r.ok)]
    .reduce((sum, r) => sum + r.latencyMs, 0);
  const totalInputTokens = [...okFit, ...reasonResults.filter((r): r is Extract<ReasonResult, { ok: true }> => r.ok)]
    .reduce((sum, r) => sum + r.inputTokens, 0);
  const callCount = okFit.length + reasonResults.filter((r) => r.ok).length;

  lines.push("## 集計");
  lines.push(`- 成功呼び出し数: ${callCount} / ${fitResults.length + reasonResults.length}`);
  if (callCount > 0) {
    lines.push(`- 平均レイテンシ: ${(totalLatency / callCount).toFixed(0)}ms`);
  }
  lines.push(`- 合計 input tokens: ${totalInputTokens}`);
  lines.push("");

  writeFileSync("eval/jev-explore-results.md", lines.join("\n") + "\n", "utf-8");
  console.log("結果を eval/jev-explore-results.md に書き出しました。");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
