import { describe, expect, it } from "vitest";
import { CATEGORIES, loadCatalog } from "./catalog";

describe("catalog", () => {
  it("data/activities.json がスキーマ通りに読み込める", () => {
    const catalog = loadCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(200);
  });

  it("id が重複していない", () => {
    const catalog = loadCatalog();
    const ids = catalog.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("全カテゴリが1件以上含まれている(restを含む)", () => {
    const catalog = loadCatalog();
    const categories = new Set(catalog.map((a) => a.category));
    for (const category of CATEGORIES) {
      expect(categories.has(category)).toBe(true);
    }
  });

  it("MVPでは link が常に null", () => {
    const catalog = loadCatalog();
    expect(catalog.every((a) => a.link === null)).toBe(true);
  });
});
