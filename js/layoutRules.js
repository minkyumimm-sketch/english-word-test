/**
 * 問題数・文字数に応じて印刷レイアウト（文字サイズ・行間・余白・列数）を
 * 自動決定するルールベースの計算モジュール。DOM操作は行わない（純粋関数）。
 * 名前空間: WordTestApp.layoutRules
 *
 * 設計方針:
 * - 「問題数の段階」を表形式(COUNT_TIERS)で管理する。閾値や数値を変えたい場合は
 *   このテーブルを編集するだけでよく、ロジック本体を読む必要がないようにする。
 * - 実際の印刷用紙サイズ(@page)は固定のまま変更しない。ブラウザ間の互換性が
 *   最も高い「.test-page 要素のpadding」で余白の広さを表現する
 *   （@page marginを要素ごとに動的化するCSS機能は対応状況にばらつきがあり、
 *   印刷崩れのリスクを避けるため採用しない）。
 * - 英単語・日本語訳の文字幅を概算し、想定より長い項目が含まれる場合は
 *   列数・文字サイズを安全側に補正する。全角文字は半角文字の2倍の幅として扱う。
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});

  /**
   * 問題数の段階ごとの基本レイアウト。maxCount以下の最初の行が採用される（昇順で判定）。
   * columns: 列数 / fontSize: 単位pt / lineHeight: 行の高さ(倍率) / padding: ページ内余白(mm)
   */
  var COUNT_TIERS = [
    { maxCount: 20, fontSize: 15, lineHeight: 2.3, padding: 16, columns: 1 },
    { maxCount: 40, fontSize: 13, lineHeight: 2.0, padding: 13, columns: 1 },
    { maxCount: 50, fontSize: 12, lineHeight: 1.8, padding: 11, columns: 1 },
    { maxCount: 60, fontSize: 12, lineHeight: 1.8, padding: 11, columns: 2 },
    { maxCount: 90, fontSize: 10.5, lineHeight: 1.6, padding: 9, columns: 2 },
    { maxCount: Infinity, fontSize: 9.5, lineHeight: 1.45, padding: 8, columns: 2 },
  ];

  var MIN_FONT_SIZE = 9; // どれだけ問題数が多くても、これより小さくはしない（読みやすさ優先）
  var MIN_LINE_HEIGHT = 1.4;

  // A4縦・@page margin(印刷用CSS側で10mm固定)を前提にした、印刷可能領域の幅。
  var PAGE_WIDTH_MM = 210;
  var PAGE_MARGIN_MM = 10; // print.cssの@page marginと一致させること
  var PRINTABLE_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;

  // 半角1文字相当(width単位=1)のおおよその幅を、フォントサイズ(pt)からmm換算する係数。
  // 全角文字はほぼ正方形(1em四方)になるフォントが多いため、全角=1em・半角=0.5emとして
  // 概算する（width単位は半角=1・全角=2で数えているため、係数は共通でよい）。
  var MM_PER_PT = 0.3528;
  var WIDTH_UNIT_EM = 0.5;

  // 1行の中で、長文側（prompt/answerのどちらか長い方）以外に必要な余白分。
  // 番号("12.")・短い方の単語・列内の左右gap(8px)などのおおよその目安。
  var RESERVED_WIDTH_UNITS = 10;

  /**
   * 指定した列数・文字サイズ・ページ内余白のとき、1列あたりに収まる
   * 概算の文字幅（width単位）を返す。長文が収まるかどうかの判定に使う。
   */
  function estimateColumnCapacityUnits(fontSize, columns, padding, columnGap) {
    var printableWidth = PRINTABLE_WIDTH_MM - padding * 2;
    var perColumnWidth = columns === 2 ? (printableWidth - columnGap) / 2 : printableWidth;
    var mmPerUnit = fontSize * MM_PER_PT * WIDTH_UNIT_EM;
    var capacity = perColumnWidth / mmPerUnit - RESERVED_WIDTH_UNITS;
    return Math.max(10, capacity);
  }

  function computeColumnGap(columns, padding) {
    return columns === 2 ? Math.max(8, Math.round(padding * 0.8)) : 0;
  }

  /**
   * 文字列の概算表示幅を返す。全角相当の文字は2、半角相当は1としてカウントする。
   */
  function estimateDisplayWidth(text) {
    var width = 0;
    var str = String(text == null ? "" : text);
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i);
      var isWide =
        (code >= 0x1100 && code <= 0x115f) ||
        code === 0x2329 ||
        code === 0x232a ||
        (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6);
      width += isWide ? 2 : 1;
      if (code > 0xffff) i++; // サロゲートペア対応
    }
    return width;
  }

  function pickCountTier(count) {
    for (var i = 0; i < COUNT_TIERS.length; i++) {
      if (count <= COUNT_TIERS[i].maxCount) return COUNT_TIERS[i];
    }
    return COUNT_TIERS[COUNT_TIERS.length - 1];
  }

  function computeMaxItemWidth(items) {
    var max = 0;
    for (var i = 0; i < items.length; i++) {
      max = Math.max(max, estimateDisplayWidth(items[i].prompt), estimateDisplayWidth(items[i].answer));
    }
    return max;
  }

  /**
   * 出題セットの items から、印刷・プレビュー両方に適用するレイアウトパラメータを算出する。
   * 問題ページ・解答ページとも同じ items から算出した同一の値を使うため、
   * 見た目（文字サイズ・列数）が一致する。
   * @param {Array<{prompt:string, answer:string}>} items
   * @returns {{columns:number, fontSizePt:number, lineHeight:number, paddingMm:number, columnGapMm:number}}
   */
  function computeLayout(items) {
    var count = (items && items.length) || 1;
    var tier = pickCountTier(count);
    var maxWidth = items && items.length ? computeMaxItemWidth(items) : 0;

    var columns = tier.columns;
    var fontSize = tier.fontSize;
    var lineHeight = tier.lineHeight;
    var padding = tier.padding;
    var columnGap = computeColumnGap(columns, padding);

    // 段階の列数のままで長文が収まるかを確認し、収まらなければ安全側に補正する。
    // 固定の閾値ではなく、実際のフォントサイズ・列数・余白から逆算した
    // 「収容可能な文字幅」と比較するため、COUNT_TIERSの数値を変更しても
    // 追従して判定される。
    if (columns === 2 && maxWidth > estimateColumnCapacityUnits(fontSize, 2, padding, columnGap)) {
      columns = 1;
      columnGap = computeColumnGap(columns, padding);
    }
    if (maxWidth > estimateColumnCapacityUnits(fontSize, columns, padding, columnGap)) {
      // 1列に切り替えてもなお収まらない極端に長い項目がある場合は、
      // 文字サイズを1段階下げて再度余裕を作る（下限は下回らない）。
      fontSize = Math.max(MIN_FONT_SIZE, fontSize - 1);
    }

    fontSize = Math.max(MIN_FONT_SIZE, fontSize);
    lineHeight = Math.max(MIN_LINE_HEIGHT, lineHeight);

    return {
      columns: columns,
      fontSizePt: fontSize,
      lineHeight: lineHeight,
      paddingMm: padding,
      columnGapMm: columnGap,
    };
  }

  WordTestApp.layoutRules = {
    estimateDisplayWidth: estimateDisplayWidth,
    computeLayout: computeLayout,
    // 印刷1ページ収まり調整(printFitting.js)が、このファイルと矛盾しない
    // 定数(用紙サイズ・可読性下限)を再利用するために公開する。
    PAGE_WIDTH_MM: PAGE_WIDTH_MM,
    PAGE_MARGIN_MM: PAGE_MARGIN_MM,
    PRINTABLE_WIDTH_MM: PRINTABLE_WIDTH_MM,
    MIN_FONT_SIZE: MIN_FONT_SIZE,
    MIN_LINE_HEIGHT: MIN_LINE_HEIGHT,
  };
})();
