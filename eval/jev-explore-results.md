# Jev探索結果 (週末2)

実行日時: 2026-09-21T10:57:51.902Z

## score型: 候補適合度スコアリング (6ケース)

### [fit_01] 友人と体を動かしたい気分
- profile: `{"with":"friends","energy":"high","time":"2h","budget":"under3000","season":"autumn","weather":"sunny"}`
- mood: "体を動かしたい気分"
- latency: 1941ms / tokens(in/out): 1000/49

| 候補 | score(0-4) | confidence |
|---|---|---|
| ジョギングで近所を軽く走る | 3.48 | 0.56 |
| 湯船にゆっくり浸かって半身浴をする | 0.44 | 0.64 |
| ボードゲームカフェで新作ゲームを遊ぶ | 1.25 | 0.74 |

### [fit_02] ひとりで疲れていて何もしたくないが家にこもりきりも嫌
- profile: `{"with":"solo","energy":"low","time":"half_day","budget":"free","season":"winter","weather":"cloudy"}`
- mood: "何もしたくないけど、家にずっといるのもな"
- latency: 470ms / tokens(in/out): 1005/49

| 候補 | score(0-4) | confidence |
|---|---|---|
| 何も予定を入れずに家でゴロゴロして過ごす | 1.89 | 0.19 |
| 河原や海辺を散歩して景色を眺める | 3.00 | 0.74 |
| カラオケで好きな曲を歌いまくる | 0.77 | 0.75 |

### [fit_03] 子ども連れの家族、晴れた半日
- profile: `{"with":"family","energy":"medium","time":"half_day","budget":"under3000","season":"spring","weather":"sunny"}`
- mood: ""
- latency: 223ms / tokens(in/out): 986/49

| 候補 | score(0-4) | confidence |
|---|---|---|
| 子どもと一緒に公園で遊具遊びをする | 3.89 | 0.90 |
| 博物館や科学館で展示をじっくり見る | 2.12 | 0.56 |
| ボウリングでスコアを競う | 2.52 | 0.56 |

### [fit_04] パートナーと雨の日、気持ちは揺れている
- profile: `{"with":"partner","energy":"medium","time":"2h","budget":"under3000","season":"summer","weather":"rainy"}`
- mood: "雨だから家系じゃなくて外に出たい気分だけど、雨だし迷う"
- latency: 204ms / tokens(in/out): 1023/49

| 候補 | score(0-4) | confidence |
|---|---|---|
| 美術館で企画展をじっくり見て回る | 2.01 | 0.41 |
| ボードゲームカフェで新作ゲームを遊ぶ | 2.91 | 0.61 |
| 湯船にゆっくり浸かって半身浴をする | 1.14 | 0.63 |

### [fit_05] ひとりで非日常を味わいたい、予算気にしない
- profile: `{"with":"solo","energy":"high","time":"full_day","budget":"unlimited","season":"autumn","weather":"sunny"}`
- mood: "非日常を味わいたい"
- latency: 188ms / tokens(in/out): 1002/49

| 候補 | score(0-4) | confidence |
|---|---|---|
| 陶芸体験用の粘土で器を1つ成形する | 2.45 | 0.49 |
| 気になっていた映画を映画館で観る | 1.56 | 0.50 |
| ライブハウスやコンサートで生演奏を聴く | 2.58 | 0.51 |

### [fit_06] 友人グループでワイワイしたい、雨、短時間
- profile: `{"with":"friends","energy":"medium","time":"2h","budget":"under3000","season":"winter","weather":"rainy"}`
- mood: "みんなでワイワイしたい"
- latency: 205ms / tokens(in/out): 1001/49

| 候補 | score(0-4) | confidence |
|---|---|---|
| カラオケで好きな曲を歌いまくる | 3.07 | 0.60 |
| アロマを焚いてソファで読みかけの本を眺める | 0.76 | 0.76 |
| 友人を家に呼んでゲーム会をする | 3.58 | 0.65 |

## choice型: 自由記述の却下理由分類 (4ケース)

| ケース | 発言 | 分類結果 | confidence | 確率分布 |
|---|---|---|---|---|
| reason_01 | うーん、これ結構お金かかりそうだからパス | money | 1.00 | {"money":1,"hassle":0,"not_in_mood":0,"been_there":0,"stay_home":0} |
| reason_02 | 準備するもの多くて面倒くさそう | hassle | 1.00 | {"money":0,"not_in_mood":0,"been_there":0,"stay_home":0,"hassle":1} |
| reason_03 | これもう何回もやったことあるんだよね | been_there | 1.00 | {"money":0,"not_in_mood":0,"hassle":0,"been_there":1,"stay_home":0} |
| reason_04 | なんか今日はそんな気分じゃないかな、別の感じがいい | not_in_mood | 1.00 | {"stay_home":0,"been_there":0,"hassle":0,"not_in_mood":1,"money":0} |

## 集計
- 成功呼び出し数: 10 / 10
- 平均レイテンシ: 425ms
- 合計 input tokens: 7831

