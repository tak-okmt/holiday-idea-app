import { loadCatalog } from "../src/engine/catalog";

const catalog = loadCatalog();

function countSingle<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

function countMulti<T extends string>(valueLists: T[][]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const list of valueLists) {
    for (const v of list) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

function printTable(title: string, counts: Map<string, number>, denom: number) {
  console.log(`\n### ${title}`);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, count] of rows) {
    const pct = ((count / denom) * 100).toFixed(1);
    const bar = "■".repeat(Math.round(count / 2));
    console.log(`${key.padEnd(14)} ${String(count).padStart(3)}件 (${pct}%) ${bar}`);
  }
}

console.log(`カタログ件数: ${catalog.length}`);

printTable("カテゴリ (category)", countSingle(catalog.map((a) => a.category)), catalog.length);
printTable(
  "人数 (with) ※1件が複数値を持つため延べ数",
  countMulti(catalog.map((a) => a.with)),
  catalog.length
);
printTable("気力 (energy)", countSingle(catalog.map((a) => a.energy)), catalog.length);
printTable("予算 (budget)", countSingle(catalog.map((a) => a.budget)), catalog.length);
printTable("屋内/屋外 (indoor)", countSingle(catalog.map((a) => String(a.indoor))), catalog.length);
printTable("準備要否 (needs_prep)", countSingle(catalog.map((a) => String(a.needs_prep))), catalog.length);
