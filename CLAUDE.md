# CLAUDE.md

## プロジェクト概要

このプロジェクトは、英単語テストを自動生成・印刷するWebアプリです。

目的は、既存のExcel資産を活用しながら、先生・生徒ともにブラウザから簡単に英単語テストを作成・印刷できることです。

まずはVer1を完成させることを最優先とします。

---

# 開発方針

- 長期運用を前提とする。
- 既存機能を壊さないことを最優先とする。
- 保守性・可読性・拡張性を重視する。
- シンプルで理解しやすい設計を優先する。
- 一つのファイルを肥大化させず責務を分離する。
- 「まず動くもの」を完成させ、改善は段階的に行う。

---

# Excelの扱い

Excelは単語データの管理専用とする。

Webアプリは

- データ読込
- 問題生成
- 解答生成
- 印刷

のみ担当する。

VBAには依存しない。

---

# Ver1の対象機能

- Excel読込
- 英語→日本語
- 日本語→英語
- 出題範囲指定
- 問題数指定
- 順番・ランダム出題
- 複数日分の一括生成
- 問題ページ
- 解答ページ
- ブラウザ印刷

---

# Ver1では実装しない

- 生徒管理
- ログイン
- 成績管理
- スペル問題
- 4択問題
- 穴埋め問題
- 他教科対応

---

# Claude Codeへの指示

作業開始時には必ずプロジェクト全体を確認し、現在の構成を理解してから実装すること。

## 自律的に進める

途中で細かな確認は行わない。

合理的に判断できる内容は自律的に実装する。

数時間規模の作業でも、途中で何度も停止せず最後まで進める。

以下は確認不要で実施してよい。

- フォルダ作成
- ファイル作成
- ファイル分割
- README更新
- docs作成
- 設計書作成
- UI改善
- CSS整理
- リファクタリング
- 共通処理化
- 命名改善
- コメント追加
- エラーハンドリング追加
- 保守性向上
- 印刷レイアウト改善

より良い設計を見つけた場合は、自律的に採用してよい。

不明点は合理的な仮定を置いて実装を継続し、その内容を最後に報告すること。

## 確認が必要な場合

以下の場合のみ確認すること。

- 既存データを削除する
- 既存仕様を変更する
- ユーザーが仕様を選択する必要がある
- 有料サービスを利用する
- 外部サービスへ公開する
- 取り返しのつかない変更

それ以外は確認不要。

---

# 判断基準

判断に迷った場合は次の優先順位で決定する。

1. 既存機能を壊さない
2. 保守性
3. 拡張性
4. シンプルさ
5. 現場での使いやすさ

---

# 作業完了時の報告

途中経過は不要。

作業完了後に以下のみ報告する。

- 実装内容
- 変更したファイル一覧
- 動作確認方法
- 今後の改善案（TODO）
- 実装時に置いた仮定

---

# アーキテクチャ・実装メモ（Ver1実装時点）

以後の作業で参照する技術的な決定事項。変更する場合は「既存仕様の変更」に該当するため確認すること。

## 技術スタック

- ビルドツールなしの静的HTML/CSS/JS。フレームワーク不使用。
- Excel解析は SheetJS（`lib/xlsx.full.min.js`）をオフラインでvendor済み。CDN依存にしない。
- **ES modules は使わない。** `<script type="module">` はChrome/Edgeで`file://`経由だと
  CORSエラーになり、ダブルクリックで開く運用が壊れるため。代わりに`window.WordTestApp`
  というグローバル名前空間にIIFEで機能を吊るす「名前空間パターン」を使う。
  `index.html`の`<script>`読み込み順（utils(dom/validators/csv) → state →
  wordRowParser → excelLoader → googleSheetLoader → wordRepository →
  testGenerator → layoutRules → printFitting → renderer → main）が依存関係の
  順序なので、ファイルを追加した場合はこの順序を崩さないこと。
- `node server.js`（追加パッケージ不要の素朴な静的サーバー、リポジトリ直下を配信。
  ただし配信を許可するトップレベル項目は`index.html`/`css`/`js`/`lib`のみに限定して
  おり、`Data/`・`docs/`・`.git`等は配信しない）でも起動可能。`file://`で直接開く運用と
  両方をサポートする。
- **アプリ本体（`index.html`/`css`/`js`/`lib`）はリポジトリ直下に配置する（Ver2.3）。**
  以前は`src/`フォルダにまとめていたが、GitHub PagesのSourceが「Deploy from a branch」
  （リポジトリ直下にindex.htmlが無いとJekyllがREADME.mdを代わりに表示してしまう）の
  場合に対応するため、直下配置に変更した。詳細は`docs/DESIGN.md`の「8. GitHub Pagesでの
  公開」を参照。

## フォルダ構成

```
.github/workflows/deploy-pages.yml  GitHub Pagesへ本体一式を自動公開するワークフロー（Ver1.3、Ver2.3で構成変更）
.nojekyll             GitHub PagesのJekyll処理を無効化する空ファイル（Ver2.3）
index.html             画面エントリーポイント
css/style.css          画面用スタイル
css/print.css          印刷専用スタイル（@media print）
lib/xlsx.full.min.js   SheetJS（vendor済み、CDNから取得しない）
js/state.js            アプリ状態（単語データ・生成結果・前回設定・読込方式）の保持
js/wordRowParser.js    列判定・行検証の共通ロジック（Excel/Sheets共通、Ver2.0）
js/excelLoader.js      Excel(.xlsm/.xlsx) → 行データへの変換
js/googleSheetLoader.js Googleスプレッドシート → CSV取得・行データへの変換（Ver2.0）
js/wordRepository.js   単語データの検索・絞り込み
js/testGenerator.js    出題セット(TestSet)の生成ロジック
js/layoutRules.js      問題数・文字数に応じた印刷レイアウト自動決定（Ver1.1）
js/printFitting.js     印刷1ページ収まり調整（DOM計測して必要最小限だけ自動縮小、Ver2.4）
js/renderer/formView.js  設定フォーム・現在の教材パネルのDOM操作
js/renderer/resultView.js プレビュー・印刷用DOMの構築
js/main.js             上記モジュールの配線（エントリーポイント）
js/utils/              dom.js（DOMヘルパー）, validators.js（入力検証）, csv.js（CSVパーサー）
Data/                  先生が編集する単語データExcel（既存資産。原則触らない。Gitでは`.gitignore`により非追跡）
docs/DESIGN.md          詳細設計（データモデル・モジュール責務・拡張ポイント）
server.js               依存なしの簡易静的サーバー
```

## データモデル

Excelの「Sheet1」相当（1行目ヘッダー、2行目以降データ）から読み込む単語データ:

```
WordEntry = { rank: number, level: string, page: string, en: string, ja: string }
```

列位置はヘッダー文字列のキーワード一致（レベル/順位/ページ/英語/訳）で自動判定し、
見つからない場合は既定列(A,B,C,D,E)にフォールバックする（`wordRowParser.js`、Ver2.0で
`excelLoader.js`から切り出し・共通化。`googleSheetLoader.js`も同じロジックを使う）。
Excelの列順が多少変わっても壊れないようにするための設計。

出題セット:

```
TestSet = { id, label, direction: 'en-ja'|'ja-en', rangeLabel, availableCount,
            items: [{ no, prompt, answer, rank }] }
```

`generateBatch`が生成するTestSetには、上記に加えて`dayNumber` / `startRank` /
`nominalEndRank` / `actualEndRank` / `isShort`も付与される（Ver2.1、生成予定
プレビューの表示に使用。詳細は`docs/DESIGN.md`の「4. 出題生成」参照）。

## localStorageキー

| キー | 内容 | 保存元 |
|---|---|---|
| `wordTestApp.lastWords.v1` | 直近に読み込んだ単語データ・レベル一覧・データ元の名称 | Excel/Googleスプレッドシート読込成功時（`main.js`） |
| `wordTestApp.lastSettings.v1` | 最後に使用したテスト条件一式（`formView.readRawSettings()`と同形状 + `printMode`） | テスト生成成功時・印刷対象変更時（`main.js`の`saveCurrentSettings()`） |
| `wordTestApp.lastLoadMethod.v1` | 最後に使用したデータ読込方式(`excel`/`googleSheet`)とGoogleスプレッドシートURL | Excel/Googleスプレッドシート読込成功時（`main.js`の`saveLoadMethod()`、Ver2.0） |

いずれも`state.js`が読み書きを担当し、他のモジュールは直接`localStorage`に触れない。

## 保守・拡張の指針

- 1ファイル1責務を維持する。UIイベント配線(main.js) / DOM構築(renderer/*) /
  ビジネスロジック(testGenerator.js, wordRepository.js) /
  データ変換(excelLoader.js, googleSheetLoader.js, wordRowParser.js)
  を混在させない。
- `[hidden]`属性でDOMを隠す箇所には、`display`を上書きするクラスを併用しない
  （併用するとCSSカスケードの都合で`hidden`が無効化される）。`style.css`の
  `[hidden]{display:none!important}`が全体の保険になっているので、新規要素にも
  この前提で問題ない。
- 印刷レイアウトは `.test-page` / `.item-list` / `.item-row` のクラス構造で
  プレビューと印刷を共通化している（`resultView.js`の`buildPageDom`。
  `buildPageElement`はこれに加えて`printFitting.fit`による1ページ収まり調整を
  呼び出すラッパー、Ver2.4）。レイアウトを変える場合はプレビューと印刷の見た目が
  ずれないようこの共通化を維持する。
- 新しい出題形式（4択・穴埋め等）を将来追加する場合は、`testGenerator.js`に
  生成関数を追加し、`resultView.js`のページ構築を出題形式ごとに分岐できる形に
  拡張する想定（Ver1では未実装）。
- 印刷レイアウト（文字サイズ・行間・列数・余白）は `layoutRules.js` が問題数・
  文字数から自動計算し、`.test-page` に CSS変数（`--tp-*`）として設定する
  （Ver1.1）。数値を調整したい場合は `layoutRules.js` の `COUNT_TIERS` テーブルを
  編集する。`@page` の物理的な用紙余白（`print.css`）は固定のままにし、
  問題数に応じた余白の演出は `.test-page` の padding で行う設計を維持すること。
  詳細は `docs/DESIGN.md` の「6. 印刷レイアウトの自動最適化」を参照。
- 前回設定の自動保存・復元（Ver1.2）は「テスト生成成功時」と「印刷対象セレクトの変更時」
  にのみ保存する。入力欄の変更ごと（キー入力毎）には保存しない
  （ノイズが多く、バリデーション前の中途半端な値を保存してしまうため）。
  データ消去ボタン（`読み込んだデータを消去`）は単語データのみを消去し、
  保存済みのテスト条件は消さない（単語データと条件設定は別の関心事という設計判断）。
  詳細は `docs/DESIGN.md` の「7. 前回設定の自動保存・復元」を参照。
- GitHub Pages公開はVer1.3で`src/`フォルダをそのまま公開対象にする方式を採用したが、
  GitHub PagesのSourceが「Deploy from a branch」の場合にリポジトリ直下へindex.htmlが
  無いとJekyllが`README.md`をホームページとして表示してしまう問題が判明したため、
  Ver2.3でアプリ本体（`index.html`/`css`/`js`/`lib`）を**リポジトリ直下**へ移動した。
  `.github/workflows/deploy-pages.yml`（GitHub Actionsで公開する場合の経路）も、
  リポジトリ直下の該当フォルダのみを一時ディレクトリへステージングしてから公開する形に
  更新済み（`Data/`・`docs/`等はステージング対象に含めないため公開されない）。
  リポジトリ直下・配下のCSS/JSでは`/`始まりの絶対パスを使わないこと（GitHub Pagesの
  プロジェクトサイトはサブパス配下で配信されるため、絶対パスを使うとパスが壊れる。
  この前提はVer1.3から変更なし）。詳細は `docs/DESIGN.md` の「8. GitHub Pagesでの
  公開」、公開手順は `README.md` の「12. GitHub Pagesでの公開（管理者向け）」を参照。
- データ読込はExcel/Googleスプレッドシートの二本立て（Ver2.0）。列判定・行検証の
  ロジックは`wordRowParser.js`に一本化してあり、`excelLoader.js`・
  `googleSheetLoader.js`はどちらも「データソース→行×列の配列」までを担当し、
  そこから先は`wordRowParser.parseRows()`を呼ぶだけにすること。新しいデータソース
  （例: 別のクラウド表計算サービス等）を追加する場合も、同じパターンで
  `xxxLoader.js`を追加し`wordRowParser.js`を再利用する。
  Googleスプレッドシート読込は、`docs.google.com`の「ウェブに公開」CSVエンドポイントへ
  ブラウザから直接`fetch()`する設計で、サーバー側プロキシは持たない
  （GitHub Pages上の静的サイトのみで完結させるため）。データ読込方式・
  GoogleスプレッドシートURLの保存は`wordTestApp.lastLoadMethod.v1`に分離しており、
  テスト条件（`wordTestApp.lastSettings.v1`）とは別に「データ読込成功時」に保存する。
  詳細は `docs/DESIGN.md` の「3. データ読込（Excel／Googleスプレッドシート）」
  「9. データ読込方式の保存・復元」を参照。
- 複数日一括生成（Ver2.1）は「終了順位」ではなく「作成日数」（`dayCount`）で範囲を
  決める。終了順位入力欄（`#endRankField`）は単発モードのみで表示し、複数日モードでは
  非表示にする（`formView.applyModeVisibility()`）。バリデーション
  （`validators.validateSettings`）でも、`endRank < startRank`のチェックは
  複数日モード（`batchEnabled`）のときはスキップすること
  （非表示の入力欄の古い値でエラーにしないため）。
  「生成予定」プレビュー（`formView.renderGenerationPreview()`）は、実際の生成
  （`testGenerator.generateBatch()`）と同じ関数をそのまま呼び出して描画する設計にして
  あり、プレビュー専用の見積もりロジックを別に持たないこと（件数のズレを防ぐため）。
  詳細は `docs/DESIGN.md` の「4. 出題生成」「4.1 生成予定プレビュー」を参照。
- 「現在の教材」パネル（Ver2.2）は、新しいlocalStorageキーを増やさず、既存の
  `wordTestApp.lastWords.v1`が持つ`sourceFileName`（`state.getSourceFileName()` /
  `updateSourceFileName()`）を単一の情報源として使う。Googleスプレッドシートの教材名は
  「URL由来の即時フォールバック → ベストエフォートのタイトル取得（`/pubhtml`を追加fetchし
  `<title>`を解析）→ 既定ラベル」の3段階。タイトル取得は非同期・失敗しても無害な設計とし、
  データ読込の成功可否やその完了タイミングには一切影響させないこと
  （`googleSheetLoader.fetchTitleBestEffort()`は例外を投げずnullを返す）。
  `<input type="file">`は同じファイルを連続選択すると`change`が発火しないブラウザの仕様が
  あるため、`formView.js`の`change`リスナーで処理後に`fileInput.value = ""`へリセットして
  いる（この対策を消さないこと）。詳細は `docs/DESIGN.md` の「10. 現在の教材表示」を参照。
- 印刷1ページ収まり調整（Ver2.4、Ver2.5・Ver2.6で拡張）は`layoutRules.js`（問題数段階ベースの
  基本レイアウト、DOM非依存）とは別ファイル`printFitting.js`に実装している。DOM計測
  （画面外サンドボックス`#printFitSandbox`に実際の`.test-page`を組み立てて
  `getBoundingClientRect()`で高さを実測する）を伴うため、`layoutRules.js`の
  「DOM操作をしない純粋関数」という設計原則を壊さないよう意図的に分離した。
  優先順位は「①読みやすさ ②可能なら1ページ ③見た目」で、調整レバーは
  **①問題ページのヘッダー印刷専用横並び化（常時適用、`print.css`）→
  ②1列になっているページの2列復帰（`printFitting.tryTwoColumns`、Ver2.5）→
  ③余白(`paddingMm`)→④セクション間隔(`--tp-section-gap-factor`)→
  ⑤問題間隔(`--tp-row-gap-factor`)→⑥行間(`lineHeight`)→
  ⑦フォントサイズ(`fontSizePt`)**の順に1段ずつ試しながら再計測する（文字を
  縮めずに済むレイアウト改善(①②)を、数値的な縮小(③〜⑦)より必ず先に試す設計。
  読みやすさに影響しないレバーから先に使い切り、文字そのものに関わるレバーは
  最後の手段にする）。フォントサイズ・行間の下限は`layoutRules.js`の
  `MIN_FONT_SIZE`/`MIN_LINE_HEIGHT`をexportして共有し、二重基準にならないように
  している。全レバーを下限まで使っても収まらない場合は無理に縮小せず複数ページを
  許容する（`fitsOnePage:false`）。`--tp-row-gap-factor`/`--tp-section-gap-factor`は、
  既存の`--tp-line-height`/`--tp-padding`由来のcalc()に掛け算する形で追加した
  （factor=1のとき既存の見た目と完全に一致するため、「収まっているものは変更しない」
  という要件を自然に満たす）。`.test-page`の列数(`columns`)は、`layoutRules.js`の
  段階別ティア・安全側補正で決めた値を出発点としつつ、Ver2.5からは②のレバーとして
  `printFitting.js`側でも「1列→2列に戻せないか」を試すようになった（`layoutRules.js`の
  幅計算式`estimateColumnCapacityUnits`/`computeColumnGap`/`computeMaxItemWidth`を
  exportして再利用し、二重基準にならないようにしている）。ただし2列から1列へ
  落とす側の判定（6.2の長文安全策そのもの）は引き続き`layoutRules.js`の責務のまま。
  **注意（ヘッダー横並び化とサンドボックス計測の整合性）**: ①のヘッダー横並び化は
  `print.css`の`@media print`にのみ書くと、`#printFitSandbox`での計測は通常の画面用
  CSS（`style.css`）で行われるため、実際に印刷した時より高い（3段ヘッダーのままの）
  高さで計測されてしまい、不要な過剰縮小を招く。そのため`style.css`側に
  `#printFitSandbox .test-page[data-kind="problem"] .page-header`という、
  `print.css`の該当ルールと全く同じ内容のルールを複製している。CSSのメディア
  クエリは要素単位で「印刷時だけ」を再現できないための対策であり、ヘッダー関連の
  CSSを変更する場合は両ファイルを必ず揃えること。計測サンドボックスの幅は印刷可能幅
  190mm（`layoutRules.PRINTABLE_WIDTH_MM`と同じ）に固定しており、画面プレビューの
  表示幅とは独立している（プレビューと印刷のWYSIWYGを保つため、常に印刷時と同じ
  折り返しで計測する）。バッチ生成時、`printFitting.fit()`は`testSet×kind`の呼び出し
  ごとに独立して実行され状態を共有しないため、日によって単語の長さが異なれば
  列数・縮小率が日ごとに異なる結果になることがある（各日を独立に最適化した結果であり、
  バグではない）。
- 長文の補足部分（丸括弧書き）の印刷時縮小（Ver2.6）は、②2列復帰の実効性を高めるための
  追加改善で、`layoutRules.splitSupplementSegments(text)`が丸括弧（全角`（）`・半角`()`）
  で囲まれた部分を「補足」、それ以外を「本文」に分割する（DOM非依存の純粋関数）。
  `resultView.js`の`buildSupplementNodes()`が、分割結果をもとに補足部分だけ
  `<span class="item-supplement">`でラップする（`item-prompt`・`item-answer`の両方に
  適用）。**文字列そのものは変更しない**（truncate・省略は行わない。解答の正確性を
  損なわないため、要件で明示的に「省略ではなく縮小」の方式が選ばれている）。
  `.item-supplement`のフォントサイズ縮小(`font-size:0.8em`)は`print.css`にのみ書き、
  `style.css`（画面プレビュー）には書かない。比率は`layoutRules.js`の
  `SUPPLEMENT_WIDTH_RATIO`（0.8、ブラウザ標準の`<small>`相当）で定義し、
  `estimateDisplayWidthWithSupplement`/`computeMaxItemWidthPrintAware`という
  「補足部分の幅をこの比率で割り引いた」版の幅推定を追加した。`printFitting.
  tryTwoColumns()`は、通常の`computeMaxItemWidth`ではなくこちらを使うことで、
  2列復帰の可否判定に縮小効果を織り込んでいる（`layoutRules.computeLayout()`自体、
  screen/print共通の基本判定は変更していない）。ヘッダー横並び化と同じ理由で、
  `style.css`に`#printFitSandbox .item-supplement { font-size: 0.8em; }`という
  `print.css`と全く同じ内容のルールを複製している（サンドボックスでの高さ実測にも
  反映させるため）。丸括弧で囲まれていない付随文字列（読みが直接連結された訳文等、
  `docs/DESIGN.md`11章に既知の制約として記載）は対象外で、引き続き縮小できない
  ケースが残り得る。
- ランダム出題時の列数・文字サイズの安定化（`poolItems`, Ver2.7）: 「出題順＝ランダム」
  かつ出題範囲に対して出題数が少ない場合、`testGenerator.js`の`shuffle()`
  （`Math.random()`使用）が生成のたびに異なる単語を抽選するため、②の幅安全チェック
  （`layoutRules.computeLayout`/`printFitting.tryTwoColumns`）が「実際に抽選された
  単語」だけを見て列数を決めていると、生成のたびに列数・フォントサイズが変わって
  しまう不具合があった（fit()自体・計測サンドボックス・非同期処理には問題が無いことを
  実測で確認済み。詳細な調査手順は`docs/DESIGN.md`6.4章に記録）。対策として、
  `testGenerator.js`の各TestSetに`poolItems`（その出題範囲に存在する全単語、抽選前）を
  追加し、`layoutRules.computeLayout(items, widthSourceItems)`・
  `printFitting.tryTwoColumns(widthSourceItems, baseLayout)`の幅安全判定を
  `items`（実際の出題）ではなく`poolItems`（出題範囲の全単語）基準に変更した。
  行数に基づく段階（COUNT_TIERS）の判定は引き続き`items.length`のまま
  （表示される問題数自体は変わらないため）。これにより、単語の抽選自体のランダム性は
  維持したまま、印刷レイアウト（列数・フォントサイズ）は同じ設定なら常に同じ結果になる
  （抽選結果によっては安全側に倒れて余白が多少増えることを許容するトレードオフ、
  ユーザー確認済み）。単発モード（`generateSingle`）にも同じ仕組みを適用している。