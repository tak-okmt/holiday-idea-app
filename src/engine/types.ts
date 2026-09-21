import { z } from "zod";
import type { Activity } from "./catalog";
import { BUDGET_LEVELS, ENERGY_LEVELS, WEATHER_OPTIONS, WITH_OPTIONS } from "./catalog";

/** 質問フローの「使える時間は？」の選択肢。分数への変換は rules.ts で行う。 */
export const TIME_OPTIONS = ["within_2h", "half_day", "full_day"] as const;

/** ユーザーへは聞かず、現在日から自動算出する（catalogのseasonsにある"all"は含まない）。 */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

export const StateSchema = z.object({
  with: z.enum(WITH_OPTIONS),
  energy: z.enum(ENERGY_LEVELS),
  time: z.enum(TIME_OPTIONS),
  budget: z.enum(BUDGET_LEVELS),
  /** 今の気分をひとこと（任意の自由記述）。 */
  mood: z.string().optional(),
  season: z.enum(SEASONS),
  /** 天気は任意。未指定なら天気による足切りをしない。 */
  weather: z.enum(WEATHER_OPTIONS).optional(),
  /** 「違うな」で除外済みの候補id。週末3では単純な除外のみ扱う。 */
  rejectedIds: z.array(z.string()).optional(),
});

export type State = z.infer<typeof StateSchema>;

/** 1件の提案。スコアの内訳も含めてCLI/将来のUIで説明できるようにする。 */
export interface Suggestion {
  activity: Activity;
  /** ルール一致度 (0-1)。 */
  ruleScore: number;
  /** Jevの採点を0-1に正規化した値。Jevが使えなかった場合はnull。 */
  jevScore: number | null;
  /** ルールとJevを重み付け合成した最終スコア (0-1)。 */
  finalScore: number;
  reason: string;
}
