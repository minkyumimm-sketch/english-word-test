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
- Excel解析は SheetJS（`src/lib/xlsx.full.min.js`）をオフラインでvendor済み。CDN依存にしない。
- **ES modules は使わない。** `<script type="module">` はChrome/Edgeで`file://`経由だと
  CORSエラーになり、ダブルクリックで開く運用が壊れるため。代わりに`window.WordTestApp`
  というグローバル名前空間にIIFEで機能を吊るす「名前空間パターン」を使う。
  `src/index.html`の`<script>`読み込み順（utils(dom/validators/csv) → state →
  wordRowParser → excelLoader → googleSheetLoader → wordRepository →
  testGenerator → layoutRules → renderer → main）が依存関係の順序なので、
  ファイルを追加した場合はこの順序を崩さないこと。
- `node server.js`（追加パッケージ不要の素朴な静的サーバー、`src/`配下を配信）でも起動可能。
  `file://`で直接開く運用と両方をサポートする。

## フォルダ構成

```
.github/workflows/deploy-pages.yml  GitHub Pagesへ src/ を自動公開するワークフロー（Ver1.3）
Data/                 先生が編集する単語データExcel（既存資産。原則触らない）
docs/DESIGN.md         詳細設計（データモデル・モジュール責務・拡張ポイント）
src/index.html         画面エントリーポイント
src/css/style.css      画面用スタイル
src/css/print.css      印刷専用スタイル（@media print）
src/lib/xlsx.full.min.js  SheetJS（vendor済み、CDNから取得しない）
src/js/state.js         アプリ状態（単語データ・生成結果・前回設定・読込方式）の保持
src/js/wordRowParser.js 列判定・行検証の共通ロジック（Excel/Sheets共通、Ver2.0）
src/js/excelLoader.js   Excel(.xlsm/.xlsx) → 行データへの変換
src/js/googleSheetLoader.js Googleスプレッドシート → CSV取得・行データへの変換（Ver2.0）
src/js/wordRepository.js 単語データの検索・絞り込み
src/js/testGenerator.js  出題セット(TestSet)の生成ロジック
src/js/layoutRules.js    問題数・文字数に応じた印刷レイアウト自動決定（Ver1.1）
src/js/renderer/formView.js  設定フォーム・現在の教材パネルのDOM操作
src/js/renderer/resultView.js プレビュー・印刷用DOMの構築
src/js/main.js           上記モジュールの配線（エントリーポイント）
src/js/utils/            dom.js（DOMヘルパー）, validators.js（入力検証）, csv.js（CSVパーサー）
server.js                依存なしの簡易静的サーバー
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
  プレビューと印刷を共通化している（`resultView.js`の`buildPageElement`）。
  レイアウトを変える場合はプレビューと印刷の見た目がずれないようこの共通化を維持する。
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
- GitHub Pages公開（Ver1.3）は `src/` フォルダをそのまま公開対象にする方式
  （`.github/workflows/deploy-pages.yml`）。公開用に`docs/`へコピーする方式や
  リポジトリ直下への移動は採用していない（`src/`構成・ローカル起動方法を変更したくない
  ため）。この前提上、`src/index.html`および配下のCSS/JSでは`/`始まりの絶対パスを
  使わないこと（GitHub Pagesのプロジェクトサイトはサブパス配下で配信されるため、
  絶対パスを使うとパスが壊れる）。詳細は `docs/DESIGN.md` の「8. GitHub Pagesでの
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