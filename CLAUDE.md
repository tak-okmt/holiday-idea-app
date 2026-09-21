# 休日アイデア提案アプリ（仮称）

## このプロジェクトについて
休日にやることが思いつかない人が、タップ中心の質問に答えると「やること」を3件提案するWebアプリ。
提案が合わなければ「違うな」と理由を伝えると、状態を更新して追加質問または再提案する。

- 開発者はフルタイムのソフトウェアエンジニアで、週末のみの個人開発。スコープを小さく保つことが最優先。
- 対象は日本在住の20〜50代。まずは開発者本人と友人・知人に使ってもらう。収益化は将来。
- 提案の粒度は「やることの種類」まで（例: 陶芸体験）。具体的な店舗・スポット・イベントは扱わない。

## MVPで作らないもの
ログイン / 位置情報 / 管理画面 / ネイティブアプリ / 決済 / 実行時のLLM呼び出し / 具体的なスポット・イベント情報。
これ以外でも、ロードマップにない機能を足す前には必ず開発者に確認すること。

## アーキテクチャ
- 推薦エンジン（`src/engine`）はUI・フレームワークに依存しない純粋なTypeScriptモジュールにする。
  入力は状態（State）、出力は提案3件。将来LINE Botからも同じエンジンを呼ぶため、この分離は必ず守る。
- 処理の流れ
  1. 回答から State を組み立てる（回答 + 季節 + 天気[任意] + 却下履歴）
  2. ルールで足切り（人数・時間・予算・天気・却下済み）
  3. Jev で残った候補を1リクエストで一括採点（score）。自由記述の気分・却下理由の解釈にも Jev を使う
  4. ルールの一致度と Jev のスコアを重み付けして上位3件を返す（重みは定数として1か所にまとめる）
  5. 提案文はカタログの事前生成テキスト（pitch / first_step）＋一致条件から組み立てるテンプレート理由
     例:「一人で、雨でも、2時間以内にできるので」
- 判定部分は `Judge` インターフェースで包み、Jev 以外（LLMの構造化出力など）にも差し替え可能にする。
- Jev が失敗・タイムアウトした場合はルールのスコアだけで返す。Jev の障害でアプリを止めない。

## 質問フロー（MVP）
固定4問 + 任意の自由記述。最初の提案まで4タップ・30秒以内が目標。

| id | 質問 | 選択肢 |
|---|---|---|
| with | 誰と過ごす？ | 一人 / パートナー / 友人 / 家族・子ども |
| energy | 今日の気力は？ | ゴロゴロしたい / ほどほど / しっかり動きたい |
| time | 使える時間は？ | 2時間以内 / 半日 / 1日 |
| budget | 予算は？ | 0円 / 3千円くらいまで / 気にしない |
| mood（任意） | 今の気分をひとこと | 自由記述 |

性別は聞かない。性別で提案を変えない。

## 「違うな」の理由と状態更新

| 理由（タップ） | 状態の更新 |
|---|---|
| お金がかかる | 予算を1段下げる |
| 面倒そう | 準備が必要な候補を除外し、energy を1段下げる |
| やったことある | その候補を除外 |
| 気分じゃない | 同じカテゴリを減点 |
| 外に出たくない | 屋外の候補を減点 |
| その他（自由記述） | Jev の choice で上のいずれかに分類 |

## 候補カタログ
- `data/activities.json` に保存。`src/engine/catalog.ts` に zod スキーマを置き、読み込み時に検証する。
- 1件の例:

```json
{
  "id": "act_012",
  "name": "レザークラフトのキットで小物を作る",
  "category": "craft",
  "indoor": true,
  "with": ["solo", "partner"],
  "energy": "low",
  "minutes": [90, 180],
  "budget": "under3000",
  "weather_ok": ["sunny", "cloudy", "rainy"],
  "seasons": ["all"],
  "needs_prep": true,
  "pitch": "手を動かしているうちに時間を忘れられる、ひとり時間向きのものづくり。",
  "first_step": "近くの手芸店か通販で、初心者向けのキーケースキットを1つ選ぶ。",
  "link": null
}
```

- category は固定の列挙: craft / nature / learning / sports / food / appreciation / rest / social / play
- 「休息」系（ゆっくり休む日を肯定する提案）も必ず含める。
- pitch と first_step は Claude Code が下書きし、開発者がチェックする。
- link はアフィリエイト用の予約フィールド（MVPでは常に null）。

## Jev（TypeSafe AI）メモ（2026-09-21時点）
- 文章を生成せず、型付きの判定を確率付きで返すモデル。質問タイプは choice / score / noul。
- 同じ state に対する質問は1リクエストにまとめる（並列に評価され、追加コストもほぼない）。
  候補ごとに別リクエストを送らないこと。
- instructions では state 内の項目を `user.mood` のようなバッククォート付きパスで参照できる。
- 料金は入力100万トークンあたり0.042ドル、出力無料。応答は70〜500ms。米国ホスティング。
- 日本語は英語より精度が落ちる可能性がある。評価ケースで必ず実測する。
- 実装前に https://docs.typesafe.ai/llms.txt から最新のAPI仕様を確認すること。
  SDKの有無・エンドポイント・パラメータ名は推測しない。
- APIキーは環境変数で渡し、コード・ログ・コミットに含めない。
- 【要注意】APIキーは https://console.typesafe.ai/keys で発行する。似た名前の別ドメイン
  （`jevtypesafeai.com`）でもダッシュボードらしき画面が表示されるが、そこで発行したキーは
  `api.typesafe.ai`（ドキュメント記載の正規エンドポイント）では認証できなかった。
  ドメインが1文字でも違うものは正規の発行元として扱わないこと。

## 技術スタック
- TypeScript / pnpm / zod / Vitest
- Web: Next.js（App Router）。スマホ前提のUI、将来PWA化。UIは週末5まで作らない
- 後で追加: Supabase（ログ）、Vercel（デプロイ）、Open-Meteo（天気）、LINE Messaging API

## ロードマップ（1週末 = 6〜8時間）
- [x] 週末1: リポジトリ初期化、カタログのスキーマ、候補100件の作成と偏りの集計
- [x] 週末2: Jev で日本語の採点を10ケース試し、使いどころと重みの初期値を決める
- [x] 週末3: 推薦エンジン（UIなし。CLIで回答を渡すと3件出る）
- [x] 週末4: 「違うな」による再ランキング、評価ケース（`eval/cases.json`）と回帰テスト
- [ ] 週末5: スマホ前提のWeb画面（質問 → 提案 → 違うな）
- [ ] 週末6: pitch / first_step の見直し、カタログを200件へ拡充
- [ ] 週末7: ログ保存、デプロイ（天気連携は余力があれば）
- [ ] 週末8: 友人5〜10人に使ってもらい、ログと感想から次の改善を決める

## 作業ルール
- 会話・コメント・UI文言は日本語。
- 作業に着手する前に計画を短く提示し、開発者の確認を取る。
- セッションの終わりには必ず動く状態にしてコミットし、ロードマップのチェックと下の進捗メモを更新する。
- 新しい依存ライブラリの追加や大きな設計変更は、実施前に提案して確認を取る。

## 進捗メモ
（セッションごとに日付と内容を追記）

### 2026-09-21 週末1
- `pnpm create next-app`（TypeScript / App Router / `src/`ディレクトリ）でリポジトリを初期化。UIはデフォルトのまま（週末5まで着手しない）。zod・vitest・tsxを追加。
- `src/engine/catalog.ts` に `ActivitySchema`（zod）を定義。フィールドの列挙値は仕様の例と質問フローから以下のように命名（次回以降のエンジン実装が依存するので変更時は要注意）:
  - `with`: solo / partner / friends / family
  - `energy`: low / medium / high
  - `budget`: free / under3000 / unlimited
  - `weather_ok`: sunny / cloudy / rainy
  - `seasons`: spring / summer / autumn / winter / all
- `data/activities.json` に候補100件を作成（`scripts/generate-catalog.ts` で生成、zodで検証済み）。9カテゴリ全てを含み、restは12件で他より1件多め。
- 偏りの集計（`scripts/catalog:analyze`）: category はほぼ均等（11〜12件/カテゴリ）。with は solo 67% > partner 57% > friends 43% > family 34%（延べ数）。energy は low 56% に偏り、high は10%と少なめ。budget は under3000 53%・free 43%・unlimited 4%と少額寄り。indoor が72%で屋内寄り。
  → 週末2以降でJevのスコアリングや足切りルールを設計する際、energy=highとbudget=unlimitedの候補が少ない点は意識する。
- `data/activities.csv` にレビュー用CSVを書き出し（`scripts/catalog:csv`）。
- `src/engine/catalog.test.ts` を追加（100件読み込み・id重複なし・全カテゴリ網羅・link常にnullを検証）。`pnpm test` / `pnpm build` / `pnpm lint` / `tsc --noEmit` すべて通過。

### 2026-09-21 週末2
- **Node.js を20(EOL済)から24へアップグレード**（別件で発生、開発者の依頼）。
  - `package.json` に `engines.node: ">=24"` と `volta.node: "24.21.0"` を追加（このプロジェクトのみに適用、他プロジェクトへの影響なし）。
  - 【ハマりどころ】`pnpm exec`/`pnpm run` は子プロセスへのPATHから `.volta/bin` を除外するため、Voltaのピンだけでは `pnpm test`/`pnpm build` 等に反映されない。`.npmrc` に `use-node-version=24.21.0` を追加して、pnpm自身のNode管理機能で確実に固定した。今後Node バージョンを上げる際はこの2箇所（`package.json`の`volta`と`.npmrc`の`use-node-version`）を両方揃えること。
- **Jevの10ケース探索**（`@typesafe-ai/sdk`を追加、`eval/jev-explore.ts`、結果は`eval/jev-explore-results.md`）。
  - score型6ケース（候補適合度、1state+複数候補を1リクエストにfan-out）、choice型4ケース（却下理由の自由記述分類）で実施。全10ケース成功。
  - **choiceでの却下理由分類**: 4ケース全てconfidence 1.00で正しいカテゴリに分類。日本語の明確な短文であれば精度は高い。週末4の実装はこの方式で問題なさそう。
  - **scoreでの候補適合度**: 期待通りの傾向が出た（例: fit_02「疲れているが家にこもりきりも嫌」で"散歩"が"ゴロゴロ"より高スコア、fit_06「ワイワイしたい」でカラオケ/ゲーム会が高くアロマ読書が低い、など自由記述のニュアンスを拾えている）。ただしconfidenceは0.19〜0.90とばらつきが大きく、候補同士が僅差/moodが曖昧なケースほど低い。
  - **初期重みの提案**: `最終スコア = 0.5 * ルール一致度 + 0.5 * (Jevスコア / 4)` を週末3の初期値とする。Jevは自由記述の解釈で確実に価値を出しているが本番未検証のため五分五分から開始し、週末8の実利用フィードバックで調整する。confidenceによる動的重み付けは今回は見送り（スコープを広げないため）、必要になれば週末4以降で再検討。
  - **コスト・速度**: 10ケース合計 input 7,831 tokens（$0.042/1M換算で1円未満）。レイテンシは初回1941ms、以降188〜470ms。4タップ30秒以内の目標に対して十分速い。
  - **エラーハンドリング**: SDKの例外はすべて`TypeSafeError`基底クラスを継承しているため、`catch (err) { if (err instanceof TypeSafeError) {...} }` の単一catchでJevの障害を一括検知できる。週末3の`Judge`インターフェースのフォールバック実装で採用予定。
  - 【重要・ハマりどころ】APIキーは https://console.typesafe.ai/keys で発行すること。似た名前の別ドメイン（`jevtypesafeai.com`）でも本物そっくりのダッシュボードが表示されたが、そこで発行したキーは正規エンドポイント（`api.typesafe.ai`）では認証エラーになった。ドキュメント記載のドメインと1文字でも違うものは信用しない。
- `pnpm test` / `pnpm build` / `pnpm lint` / `tsc --noEmit` すべてNode24環境で通過。

### 2026-09-21 週末3
- 推薦エンジンを実装（`src/engine/`）。処理の流れはCLAUDE.md記載のアーキテクチャ通り: State→ルール足切り→Jev一括採点→重み付け→上位3件。
  - `types.ts`: `State`(zodスキーマ)と`Suggestion`型。`time`の選択肢(`within_2h`/`half_day`/`full_day`)を新設(候補の`minutes`と比較するための分数変換は`rules.ts`)。`season`はユーザーに聞かず現在日から自動算出(CLIの`currentSeason()`)。
  - `rules.ts`: 足切り(人数・時間・予算・天気・却下済み)。**energyは足切り対象に含めていない**(CLAUDE.mdの足切り一覧に無いため)。ルール一致度はenergyの近さのみで算出(完全一致1.0/1段差0.5/2段差0.0)。季節・気分などの自由記述ニュアンスはJev側の役割として切り分けた。
  - `judge.ts`: `Judge`インターフェースと`JevJudge`。週末2で検証済みのfan-out(1state+複数候補→1リクエスト)をそのまま採用。`TypeSafeError`を`catch`して`null`を返し、失敗時はルールスコアのみにフォールバックすることを実機(不正なAPIキー)で確認済み。
  - `recommend.ts`: `recommend(state, judge, catalog?, topN=3)`。`finalScore = jevScoreがnullならruleScoreそのまま、そうでなければ RULE_WEIGHT*ruleScore + JEV_WEIGHT*jevScore`(重みは`weights.ts`に集約)。
  - `reason.ts`: 理由文テンプレート。CLAUDE.md記載の例文「一人で、雨でも、2時間以内にできるので」をテストで再現済み。
  - `scripts/recommend-cli.ts`: `pnpm run recommend -- --with=solo --energy=medium --time=within_2h --budget=under3000 [--mood=... --weather=... --season=... --rejected=act_001]`。入力はzodで検証しエラーメッセージを表示。
    - 【ハマりどころ】`pnpm run <script> -- --foo=bar`は、pnpmが`--`自体を子プロセスへの引数として渡してくる。Node標準の`parseArgs`は素の`--`を「オプション終端」とみなし以降を全部位置引数にしてしまうため、`process.argv`から`--`トークンを事前に除去してから`parseArgs`に渡す必要があった。
  - テスト22件追加(`rules.test.ts`/`reason.test.ts`/`recommend.test.ts`)。`recommend.test.ts`はFake Judgeを使い、実APIを叩かずにフィルタ・重み付け・フォールバックを検証。実APIでの動作確認はCLIを2回手動実行(正常系・不正キーでのフォールバック)して確認済み。
- `pnpm test`(22件全通過) / `pnpm build` / `pnpm lint` / `tsc --noEmit` すべて通過。

### 2026-09-21 週末4
- 「違うな」の再ランキングを実装（`src/engine/rejection.ts`）。CLAUDE.mdの理由テーブル通りにStateを更新する`applyRejection(state, activity, reason)`を追加。
  - **設計判断（要確認）**: テーブルでは「その候補を除外」は`been_there`のみの記載だが、**どの理由で却下してもその候補id自体はrejectedIdsに積む**ようにした(同じ案を出し続けるのは不自然なため)。違和感があれば`rejection.ts`の`applyRejection`を直せばよい。
  - `money`→予算1段下げ、`hassle`→`excludeNeedsPrep`を立てて`energy`1段下げ、`been_there`→除外のみ、`not_in_mood`→`penalizedCategories`に累積、`stay_home`→`penalizeOutdoor`を立てる。予算/気力は最低段階(free/low)でそれ以上下がらない。
  - `rules.ts`の`ruleMatchScore`に「同じカテゴリ」「屋外」の**50%減衰(乗算・重ね掛け可)**を追加。強さは仮決め、実利用で要調整。
  - `judge.ts`の`Judge`に`classifyReason(freeText)`を追加。週末2で検証済みのchoice分類パターンをそのまま使用。CLIの`--reject-text`で実際に試し、「今日は走る気分じゃないかな」→`not_in_mood`に正しく分類されることを確認。
- `scripts/recommend-cli.ts`に`--reject-id`+`--reject-reason`（または`--reject-text`でJev分類）を追加。却下前後の提案を並べて表示し、カテゴリ減点が実際のスコアに反映されることを手動確認済み(例: sportsを気分じゃないで却下→残りのsports候補のrule scoreが1.00→0.50に低下)。
- `eval/cases.json`にwith/energy/time/budget/weather/seasonの組み合わせが異なる実カタログでの評価ケース10件を作成。`eval/cases.test.ts`で各ケースにつき「初回提案の足切り・降順ソート」と「5つの却下理由それぞれで再提案が正しく反映される」ことを検証する回帰テストを実装（60件、Jevは呼ばず決定的に実行）。
  - 「その他（自由記述）」のJev分類は実API依存のため回帰テストには含めず、CLIでの手動確認(上記)に留めた。
- テスト92件追加/更新、全通過。`pnpm test` / `pnpm build` / `pnpm lint` / `tsc --noEmit` すべて通過。
