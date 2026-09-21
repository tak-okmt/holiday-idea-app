import { writeFileSync } from "node:fs";
import { loadCatalog } from "../src/engine/catalog";

const catalog = loadCatalog();

const columns = [
  "id",
  "name",
  "category",
  "indoor",
  "with",
  "energy",
  "minutes_min",
  "minutes_max",
  "budget",
  "weather_ok",
  "seasons",
  "needs_prep",
  "pitch",
  "first_step",
  "link",
] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const lines = [columns.join(",")];

for (const a of catalog) {
  const row = [
    a.id,
    a.name,
    a.category,
    String(a.indoor),
    a.with.join("|"),
    a.energy,
    String(a.minutes[0]),
    String(a.minutes[1]),
    a.budget,
    a.weather_ok.join("|"),
    a.seasons.join("|"),
    String(a.needs_prep),
    a.pitch,
    a.first_step,
    a.link ?? "",
  ].map(csvEscape);
  lines.push(row.join(","));
}

writeFileSync("data/activities.csv", lines.join("\n") + "\n", "utf-8");
console.log(`${catalog.length} 件を data/activities.csv に書き出しました。`);
