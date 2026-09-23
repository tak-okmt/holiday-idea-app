import { readFileSync } from "node:fs";
import {
  ActivityCatalogSchema,
  BUDGET_LEVELS,
  ENERGY_LEVELS,
  WITH_OPTIONS,
  type Activity,
} from "../src/engine/catalog";
import type { Judge } from "../src/engine/judge";
import { recommend } from "../src/engine/recommend";
import { filterCandidates } from "../src/engine/rules";
import { TIME_OPTIONS, type State } from "../src/engine/types";

/**
 * with/energy/time/budget の全組み合わせ(4x3x3x3=108通り)を、Jevを呼ばずルールスコアのみで
 * 機械的に評価するオフライン検証ツール。カタログ拡充の効果を、人を雇わず・無料・決定論的に測る。
 *
 * 【注意】season は passesFilters/ruleMatchScore(rules.ts) では一切使われておらず、
 * Jevへのコンテキストとしてのみ渡される設計になっている(実装を確認済み)。そのため season の
 * 違いはこの評価には影響しない。季節限定の活動(冬季の雪遊び等)が季節を問わず候補に入りうる点は、
 * このツールの限界ではなくエンジン自体の現状の設計(足切りは人数・時間・予算・天気・却下済みのみ)。
 */

class NullJudge implements Judge {
  async scoreCandidates() {
    return null;
  }
  async classifyReason() {
    return null;
  }
}

function loadCatalogFromPath(path: string): Activity[] {
  const raw = readFileSync(path, "utf-8");
  return ActivityCatalogSchema.parse(JSON.parse(raw));
}

interface ComboResult {
  with: State["with"];
  energy: State["energy"];
  time: State["time"];
  budget: State["budget"];
  survivorCount: number;
  top3Ids: string[];
}

async function evaluate(catalog: Activity[]): Promise<ComboResult[]> {
  const judge = new NullJudge();
  const combos: ComboResult[] = [];
  for (const withValue of WITH_OPTIONS) {
    for (const energy of ENERGY_LEVELS) {
      for (const time of TIME_OPTIONS) {
        for (const budget of BUDGET_LEVELS) {
          const state: State = { with: withValue, energy, time, budget, season: "autumn" };
          const survivors = filterCandidates(catalog, state);
          const top3 = await recommend(state, judge, catalog, 3);
          combos.push({
            with: withValue,
            energy,
            time,
            budget,
            survivorCount: survivors.length,
            top3Ids: top3.map((s) => s.activity.id),
          });
        }
      }
    }
  }
  return combos;
}

interface Metrics {
  catalogSize: number;
  totalCombos: number;
  deadEnds: ComboResult[];
  under3: ComboResult[];
  avgSurvivors: number;
  minSurvivors: number;
  uniqueTop3Count: number;
  coverageRatio: number;
}

function computeMetrics(catalogSize: number, combos: ComboResult[]): Metrics {
  const deadEnds = combos.filter((c) => c.survivorCount === 0);
  const under3 = combos.filter((c) => c.survivorCount > 0 && c.survivorCount < 3);
  const survivorCounts = combos.map((c) => c.survivorCount);
  const avgSurvivors = survivorCounts.reduce((a, b) => a + b, 0) / survivorCounts.length;
  const minSurvivors = Math.min(...survivorCounts);
  const uniqueTop3 = new Set(combos.flatMap((c) => c.top3Ids));
  return {
    catalogSize,
    totalCombos: combos.length,
    deadEnds,
    under3,
    avgSurvivors,
    minSurvivors,
    uniqueTop3Count: uniqueTop3.size,
    coverageRatio: uniqueTop3.size / catalogSize,
  };
}

function printMetrics(label: string, m: Metrics) {
  console.log(`\n=== ${label}(${m.catalogSize}件) ===`);
  console.log(`組み合わせ総数: ${m.totalCombos}`);
  console.log(
    `候補ゼロ(デッドエンド): ${m.deadEnds.length}件 (${((m.deadEnds.length / m.totalCombos) * 100).toFixed(1)}%)`
  );
  console.log(
    `候補1〜2件(3件出せない): ${m.under3.length}件 (${((m.under3.length / m.totalCombos) * 100).toFixed(1)}%)`
  );
  console.log(`候補数 平均: ${m.avgSurvivors.toFixed(1)}件 / 最小: ${m.minSurvivors}件`);
  console.log(
    `カバレッジ(いずれかの組み合わせのtop3に一度でも入る活動の割合): ${m.uniqueTop3Count}/${m.catalogSize} (${(
      m.coverageRatio * 100
    ).toFixed(1)}%)`
  );
  if (m.deadEnds.length > 0) {
    console.log(`デッドエンドの組み合わせ:`);
    for (const c of m.deadEnds) {
      console.log(`  with=${c.with} energy=${c.energy} time=${c.time} budget=${c.budget}`);
    }
  }
}

/** 週末6・今回の改善で「手薄」と指摘されていた軸の候補数を個別確認する。 */
function printTargetedSegments(label: string, combos: ComboResult[]) {
  const targets: Array<{ label: string; match: (c: ComboResult) => boolean }> = [
    { label: "with=family", match: (c) => c.with === "family" },
    { label: "with=friends", match: (c) => c.with === "friends" },
    { label: "energy=high", match: (c) => c.energy === "high" },
    { label: "budget=unlimited", match: (c) => c.budget === "unlimited" },
    {
      label: "with=family & energy=high",
      match: (c) => c.with === "family" && c.energy === "high",
    },
    {
      label: "with=friends & energy=high & budget=unlimited",
      match: (c) => c.with === "friends" && c.energy === "high" && c.budget === "unlimited",
    },
  ];
  console.log(`\n--- 手薄だった軸の平均候補数(${label}) ---`);
  for (const t of targets) {
    const matched = combos.filter(t.match);
    const avg = matched.reduce((a, c) => a + c.survivorCount, 0) / matched.length;
    const zero = matched.filter((c) => c.survivorCount === 0).length;
    console.log(
      `${t.label}: 平均${avg.toFixed(1)}件 (対象${matched.length}組み合わせ中、候補ゼロが${zero}件)`
    );
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const beforeArg = args.find((a) => a.startsWith("--before="))?.slice("--before=".length);
  const afterArg =
    args.find((a) => a.startsWith("--after="))?.slice("--after=".length) ?? "data/activities.json";

  const afterCatalog = loadCatalogFromPath(afterArg);
  const afterCombos = await evaluate(afterCatalog);
  const afterMetrics = computeMetrics(afterCatalog.length, afterCombos);
  printMetrics("after", afterMetrics);
  printTargetedSegments("after", afterCombos);

  if (beforeArg) {
    const beforeCatalog = loadCatalogFromPath(beforeArg);
    const beforeCombos = await evaluate(beforeCatalog);
    const beforeMetrics = computeMetrics(beforeCatalog.length, beforeCombos);
    printMetrics("before", beforeMetrics);
    printTargetedSegments("before", beforeCombos);

    console.log(`\n=== before → after 比較 ===`);
    console.log(`カタログ件数: ${beforeMetrics.catalogSize} → ${afterMetrics.catalogSize}`);
    console.log(
      `デッドエンド: ${beforeMetrics.deadEnds.length}件 → ${afterMetrics.deadEnds.length}件`
    );
    console.log(
      `候補1〜2件: ${beforeMetrics.under3.length}件 → ${afterMetrics.under3.length}件`
    );
    console.log(
      `候補数平均: ${beforeMetrics.avgSurvivors.toFixed(1)}件 → ${afterMetrics.avgSurvivors.toFixed(1)}件`
    );
    console.log(
      `候補数最小: ${beforeMetrics.minSurvivors}件 → ${afterMetrics.minSurvivors}件`
    );
    console.log(
      `カバレッジ: ${(beforeMetrics.coverageRatio * 100).toFixed(1)}% → ${(
        afterMetrics.coverageRatio * 100
      ).toFixed(1)}%`
    );
  }
}

main();
