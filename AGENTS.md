# AGENTS.md

都道府県リレー：出発の県から、となりの県だけを通って目的の県へ、いちばん少ない県の数で着く1日3問の地図パズル。`index.html` と `gen.js`（問題の作り方）・`map.js`（県の形ととなり）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # となりの県のデータ（接する・接しない県の見本）・問題の作り方（4種類×3000問、最短の数を別の数え方で）・3問の組み方（1年分）・進む/戻る/ヒント・続きから・上級（地図なし）・県帳・スマホ幅・PWA（CI の QA と同じ）
```

## このリポジトリの決まり

- `map.js` は `python3 tools/make-data.py <japan.geojson>` で作る（手で直さない）。japan.geojson は https://github.com/dataofjapan/land のもの（国土数値情報の行政区域から）。リポジトリには入れない。となりは県境の点を3つ以上共有しているかで決める。
- 海をこえるつながりは `LINKS` の5か所だけ（青函トンネル・関門トンネル・明石海峡大橋と大鳴門橋・瀬戸大橋・しまなみ海道）。フェリーは入れない。沖縄県は入れない（遊び方と README に理由を書く）。足すときは、一次資料（運営会社の公式サイトなど）で車か鉄道で渡れることを確かめる。
- 問題は `gen.js` の `make` が種から作る：近場（最短3〜4回）・遠出（5〜7回）・通行止め（最短の道の途中の県を1つふさぎ、1〜3県の遠回り）・地図なし（6〜9回）。`gen.js` や `map.js` を変えると過去の日の問題も変わるので、変えた PR に一言書く。
- 今日の3問・上級は日本時間の日付から作る種（`seedOf`）で決まり、だれでも同じ。`Math.random()` は練習の問題の種だけ（QA が数を見る）。
- ★は進んだ回数で決める（最短で★3・2回まで遠回りで★2・それ以上★1）。ヒント（目的に近づくとなりの県を光らせる）1回ごとに★を1つ減らす（最低★1、2回まで）。「ひとつ戻る」で戻っても進んだ回数は減らさない。上級は地図を隠し、ヒントなし。時間制限は付けない。
- 今日の3問・上級は1日1回で、途中で閉じても通った道とヒントのまま続きから。保存してあった道は、出発から・となりへ・通行止めを通らないかを確かめてから使う（`valid`）。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`・`runs.p`）、練習で今日・上級の途中を消さない。答えを入れる前に、保存した進み具合が画面と同じ問題か確かめる。記録は保存の前に読み直す。保存に失敗したあとは、途中経過を時刻でなく進み具合で選び、県帳の数は多いほうを残す（shared-workflows `incidents/2026-11-04-daily-game-save-gaps.md`）。
- 問題の画面に最短の回数（目安）を出し、こえたら進んだ回数の色を変える。着いたら道を引き直して見せ、最短でなければ最短の道の例（`T.path`）を緑の点線で重ねる。
- 実績（`ACH`）は今の記録から毎回数える（新しく残すものは無い。回を始めたときの一覧 `a0` と比べて、結果に「🏅 実績：」を出す）。腕前・集める・続けるを混ぜ、まだのものは進み具合を出す。カレンダーは今日の3問の日を★で、あとから遊んだ日を ↺ で出し、連続の日は1以上のときだけ出す。結果の画面には、まだの実績のうち目標にいちばん近いもの1つを「🎯 次の実績」で出す（`nextAch`。shared-workflows `routines/game-dev.md` 研究の要点 12）。
- 取りこぼした日（`lateDays`：過去7日・始めた日より後）は、その日の今日の3問と同じ問題であとから遊べる。記録は `adays`、途中経過は日付ごとの `runs["a:日付"]`（別の日を始めても前の日の途中を消さない）。連続の日・今日の記録・シェア・Ko-fi には数えない（県帳・着いた旅・実績には数える）。
- 地図は出発・目的・通った県・となりの県が全部入るように寄せる。幅320pxでも県名は9px以上（QA が1年分の問題で見る）。小さな県も押せるように、となりの県は下のボタンでも選べる。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に県の名前（答え）を出さない（🟩最短・🟨2回まで遠回り・🟧もっと遠回り・💡ヒント）。
- 文字は少なめ・一画面一問。お笑いの言葉は入れない（QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の3問・上級を初めて終えて全部最短（ヒントなし）のときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 同じ日はどの端末でも同じ問題にする：乱数は `sort` の比較の中で引かない（QA が見る）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。
- 押せる所は高さ44px以上（QA が見る）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何千回も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の問題を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
