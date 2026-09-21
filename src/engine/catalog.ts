import { readFileSync } from "node:fs";
import { z } from "zod";

export const CATEGORIES = [
  "craft",
  "nature",
  "learning",
  "sports",
  "food",
  "appreciation",
  "rest",
  "social",
  "play",
] as const;

export const WITH_OPTIONS = ["solo", "partner", "friends", "family"] as const;

export const ENERGY_LEVELS = ["low", "medium", "high"] as const;

export const BUDGET_LEVELS = ["free", "under3000", "unlimited"] as const;

export const WEATHER_OPTIONS = ["sunny", "cloudy", "rainy"] as const;

export const SEASON_OPTIONS = [
  "spring",
  "summer",
  "autumn",
  "winter",
  "all",
] as const;

export const ActivitySchema = z.object({
  id: z.string().regex(/^act_\d{3,}$/, "id は act_012 のような形式にしてください"),
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  indoor: z.boolean(),
  with: z.array(z.enum(WITH_OPTIONS)).min(1),
  energy: z.enum(ENERGY_LEVELS),
  minutes: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([min, max]) => min <= max, {
      message: "minutes は [下限, 上限] の順で、下限 <= 上限 にしてください",
    }),
  budget: z.enum(BUDGET_LEVELS),
  weather_ok: z.array(z.enum(WEATHER_OPTIONS)).min(1),
  seasons: z.array(z.enum(SEASON_OPTIONS)).min(1),
  needs_prep: z.boolean(),
  pitch: z.string().min(1),
  first_step: z.string().min(1),
  link: z.string().url().nullable(),
});

export type Activity = z.infer<typeof ActivitySchema>;

export const ActivityCatalogSchema = z.array(ActivitySchema).superRefine((items, ctx) => {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `id が重複しています: ${item.id}`,
        path: [index, "id"],
      });
    }
    seen.add(item.id);
  }
});

/** data/activities.json を読み込み、zod スキーマで検証したうえで返す。 */
export function loadCatalog(path = `${process.cwd()}/data/activities.json`): Activity[] {
  const raw = readFileSync(path, "utf-8");
  const json = JSON.parse(raw);
  return ActivityCatalogSchema.parse(json);
}
