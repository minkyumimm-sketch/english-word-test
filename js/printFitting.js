/**
 * 印刷時、問題ページ・解答ページをそれぞれ「できる限り1ページに収める」ための
 * 自動縮小ロジック。DOM計測を伴うため、DOM非依存のlayoutRules.jsとはファイルを分離する。
 * 名前空間: WordTestApp.printFitting
 *
 * 設計方針（優先順位: ①読みやすさ ②可能なら1ページ ③見た目の美しさ）:
 * - layoutRules.computeLayout() が出す「問題数段階ベースのレイアウト」を出発点として使う。
 * - 実際に.test-page要素を画面外サンドボックス(#printFitSandbox)へ組み立てて
 *   getBoundingClientRect()で高さを実測する。文字幅の概算(layoutRules側)と違い、
 *   高さは実際のフォントメトリクス・折り返しに左右されるため、実測が最も確実。
 * - 1ページに収まっていれば何もしない（要件どおり、収まっているものは変更しない）。
 * - 収まらない場合、次の優先順位で1段ずつ調整して再計測する（Ver2.5）。
 *   1. 2列レイアウトへの復帰（`tryTwoColumns`）: 問題数段階の判定やlayoutRulesの
 *      長文安全策により1列になっているページは、文字を縮めるより先に2列へ戻せないか
 *      試す（2列は1列よりおおよそ半分の高さで済み、可読性を犠牲にしないため）。
 *      layoutRulesと同じ幅の安全計算を再利用し、必要なら文字サイズだけ少し
 *      下げて2列分の幅を確保する。2列にした方が実測で低くなる場合のみ採用する。
 *   2. 余白 → セクション間隔 → 問題間隔 → 行間 → 文字サイズ の順に1段ずつ縮小
 *      （読みやすさに影響しないレバーから先に使い切る設計）。フォントサイズ・行間は
 *      可読性に直結するため最後の手段とし、かつ下限(MIN_FONT_SIZE / MIN_LINE_HEIGHT。
 *      layoutRules.jsと共通)を下回らない。
 * - 全レバーを下限まで使っても収まらない場合は、無理に縮小せず複数ページを許容する
 *   （要件: 「読めなくなるなら縮小しない」）。
 * - 問題ページ・解答ページはこの関数の呼び出し単位（testSet×kindごと）で独立して
 *   実行されるため、列数・縮小率は常にページごとに個別計算される。複数日分の
 *   バッチ生成でも、日ごとの単語の長さの違いによって列数・縮小結果が日によって
 *   異なることは起こり得るが、それは各ページを独立に最適化した結果である。
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});
  var layoutRules = WordTestApp.layoutRules;

  var SANDBOX_ID = "printFitSandbox";

  // A4縦・@page margin(print.cssで10mm固定)を前提にした印刷可能領域の高さ。
  // 幅側の定数(PRINTABLE_WIDTH_MM等)はlayoutRules.jsと共有し、ここでは
  // 高さ計算に必要な分だけを追加する。
  var PAGE_HEIGHT_MM = 297;
  var PAGE_MARGIN_MM = layoutRules.PAGE_MARGIN_MM; // print.cssの@page marginと一致させること
  var PRINTABLE_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2; // 277

  // 画面計測と実際の印刷ラスタライズの間の微小な誤差(フォントヒンティング等)を
  // 吸収するための安全マージン。ここを大きくしすぎると不要な縮小が増えるため、
  // 「収まっているのに縮小してしまう」誤判定を避けられる最小限の値にする。
  var FIT_SAFETY_MARGIN_MM = 3;
  var TARGET_HEIGHT_MM = PRINTABLE_HEIGHT_MM - FIT_SAFETY_MARGIN_MM;

  // 可読性を維持するための下限値。フォントサイズ・行間はlayoutRules.jsの
  // 下限（COUNT_TIERSの自動縮小でも守っている値）とそろえ、二重基準にならないようにする。
  var MIN_FONT_SIZE = layoutRules.MIN_FONT_SIZE; // 9pt
  var MIN_LINE_HEIGHT = layoutRules.MIN_LINE_HEIGHT; // 1.4
  var MIN_PADDING_MM = 6; // 余白(ページ内padding)の下限。COUNT_TIERS最小値(8mm)よりさらに少し縮められる余地
  var MIN_ROW_GAP_FACTOR = 0.3; // 問題間隔（行間由来のpadding）を最大7割まで縮小可
  var MIN_SECTION_GAP_FACTOR = 0.4; // セクション間隔（見出し〜問題リスト間）を最大6割まで縮小可

  var FONT_STEP = 0.5;
  var LINE_HEIGHT_STEP = 0.05;
  var PADDING_STEP = 1;
  var ROW_GAP_STEP = 0.1;
  var SECTION_GAP_STEP = 0.1;

  var PX_PER_MM = 96 / 25.4;

  function round1(value) {
    return Math.round(value * 10) / 10;
  }
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function getSandbox() {
    var sandbox = document.getElementById(SANDBOX_ID);
    return sandbox || null;
  }

  function layoutStyleText(layout) {
    return (
      "--tp-columns:" + layout.columns + ";" +
      "--tp-font-size:" + layout.fontSizePt + "pt;" +
      "--tp-line-height:" + layout.lineHeight + ";" +
      "--tp-padding:" + layout.paddingMm + "mm;" +
      "--tp-column-gap:" + layout.columnGapMm + "mm;" +
      "--tp-row-gap-factor:" + layout.rowGapFactor + ";" +
      "--tp-section-gap-factor:" + layout.sectionGapFactor + ";"
    );
  }

  /**
   * buildElementFnで実際の.test-page要素を組み立て、画面外サンドボックスに
   * 一時的に配置して実測の高さ(mm)を返す。計測後はサンドボックスを空にする。
   */
  function measureHeightMm(layout, buildElementFn) {
    var sandbox = getSandbox();
    if (!sandbox) return 0; // サンドボックスが無い環境(未対応の呼び出し元)では計測をスキップ

    while (sandbox.firstChild) sandbox.removeChild(sandbox.firstChild);

    var el = buildElementFn(layout);
    sandbox.appendChild(el);
    var heightPx = el.getBoundingClientRect().height;

    while (sandbox.firstChild) sandbox.removeChild(sandbox.firstChild);

    return heightPx / PX_PER_MM;
  }

  function baseFittableLayout(layout) {
    return {
      columns: layout.columns,
      fontSizePt: layout.fontSizePt,
      lineHeight: layout.lineHeight,
      paddingMm: layout.paddingMm,
      columnGapMm: layout.columnGapMm,
      rowGapFactor: 1,
      sectionGapFactor: 1,
    };
  }

  /**
   * 縮小レバーを優先順位どおりに1段ずつ並べた手順列を作る。
   * 前半（余白・セクション間隔・問題間隔）は可読性に影響しないレバー、
   * 後半（行間・文字サイズ）は可読性に直結するレバーとして最後に回す。
   */
  function buildStepSequence(baseLayout) {
    var steps = [];
    var v;

    for (v = baseLayout.paddingMm - PADDING_STEP; v >= MIN_PADDING_MM - 1e-9; v -= PADDING_STEP) {
      steps.push({ field: "paddingMm", value: Math.max(MIN_PADDING_MM, round1(v)) });
    }
    for (v = 1 - SECTION_GAP_STEP; v >= MIN_SECTION_GAP_FACTOR - 1e-9; v -= SECTION_GAP_STEP) {
      steps.push({ field: "sectionGapFactor", value: Math.max(MIN_SECTION_GAP_FACTOR, round2(v)) });
    }
    for (v = 1 - ROW_GAP_STEP; v >= MIN_ROW_GAP_FACTOR - 1e-9; v -= ROW_GAP_STEP) {
      steps.push({ field: "rowGapFactor", value: Math.max(MIN_ROW_GAP_FACTOR, round2(v)) });
    }
    for (v = baseLayout.lineHeight - LINE_HEIGHT_STEP; v >= MIN_LINE_HEIGHT - 1e-9; v -= LINE_HEIGHT_STEP) {
      steps.push({ field: "lineHeight", value: Math.max(MIN_LINE_HEIGHT, round2(v)) });
    }
    for (v = baseLayout.fontSizePt - FONT_STEP; v >= MIN_FONT_SIZE - 1e-9; v -= FONT_STEP) {
      steps.push({ field: "fontSizePt", value: Math.max(MIN_FONT_SIZE, round1(v)) });
    }

    return steps;
  }

  /**
   * 1列になっているレイアウトを2列に戻せないか試す。layoutRules.jsの長文安全策
   * （estimateColumnCapacityUnits）と同じ計算式で、現在の文字サイズから
   * 必要なら1段ずつ下げながら「2列でも幅が収まる」組み合わせを探す。
   * 見つからない場合（下限まで下げても幅が収まらない極端に長い項目がある場合）はnullを返す。
   */
  function tryTwoColumns(items, baseLayout) {
    // 幅の判定には印刷時の補足部分縮小(Ver2.6)を織り込んだ見積もりを使う。
    // 実際に印刷される見た目（.item-supplementが小さいフォントで表示される）に
    // 合わせて2列化の可否を判定するため。
    var maxWidth = layoutRules.computeMaxItemWidthPrintAware(items);
    var padding = baseLayout.paddingMm;
    var columnGap = layoutRules.computeColumnGap(2, padding);
    var fontSize = baseLayout.fontSizePt;

    while (fontSize >= MIN_FONT_SIZE - 1e-9) {
      var capacity = layoutRules.estimateColumnCapacityUnits(fontSize, 2, padding, columnGap);
      if (maxWidth <= capacity) {
        return {
          columns: 2,
          fontSizePt: fontSize,
          lineHeight: baseLayout.lineHeight,
          paddingMm: padding,
          columnGapMm: columnGap,
        };
      }
      fontSize = round1(fontSize - FONT_STEP);
    }
    return null;
  }

  function cloneLayout(layout) {
    return {
      columns: layout.columns,
      fontSizePt: layout.fontSizePt,
      lineHeight: layout.lineHeight,
      paddingMm: layout.paddingMm,
      columnGapMm: layout.columnGapMm,
      rowGapFactor: layout.rowGapFactor,
      sectionGapFactor: layout.sectionGapFactor,
    };
  }

  /**
   * 問題ページ・解答ページを個別に1ページへ収める調整を試みる。
   * @param {{items: Array}} testSet
   * @param {Object} baseLayout - layoutRules.computeLayout()の結果
   * @param {function(layout): Element} buildElementFn - 与えたlayoutで実際の.test-page要素を組み立てる関数
   * @returns {{layout: Object, scaled: boolean, heightMm: number, fitsOnePage: boolean}}
   */
  function fit(testSet, baseLayout, buildElementFn) {
    var current = baseFittableLayout(baseLayout);
    var heightMm = measureHeightMm(current, buildElementFn);

    if (heightMm <= TARGET_HEIGHT_MM) {
      return { layout: current, scaled: false, heightMm: heightMm, fitsOnePage: true, columnsAdjusted: false };
    }

    var scaled = false;
    var columnsAdjusted = false;
    var workingLayout = baseLayout;

    // ①のヘッダー横並び化はCSS側(print.css)で常時適用済み。ここでは②の
    // 「2列レイアウトへの復帰」を、③〜⑤の数値的な縮小より先に試す。
    if (workingLayout.columns === 1) {
      var twoColLayout = tryTwoColumns(testSet.items, workingLayout);
      if (twoColLayout) {
        var twoColBase = baseFittableLayout(twoColLayout);
        var twoColHeight = measureHeightMm(twoColBase, buildElementFn);
        if (twoColHeight < heightMm) {
          workingLayout = twoColLayout;
          current = twoColBase;
          heightMm = twoColHeight;
          scaled = true;
          columnsAdjusted = true;

          if (heightMm <= TARGET_HEIGHT_MM) {
            return { layout: current, scaled: true, heightMm: heightMm, fitsOnePage: true, columnsAdjusted: true };
          }
        }
      }
    }

    var steps = buildStepSequence(workingLayout);

    for (var i = 0; i < steps.length; i++) {
      var candidate = cloneLayout(current);
      candidate[steps[i].field] = steps[i].value;
      heightMm = measureHeightMm(candidate, buildElementFn);
      current = candidate;
      scaled = true;

      if (heightMm <= TARGET_HEIGHT_MM) {
        return { layout: current, scaled: true, heightMm: heightMm, fitsOnePage: true, columnsAdjusted: columnsAdjusted };
      }
    }

    // 可読性を守れる下限まで縮小しても収まらない場合は、無理をせず複数ページを許容する。
    return { layout: current, scaled: scaled, heightMm: heightMm, fitsOnePage: false, columnsAdjusted: columnsAdjusted };
  }

  WordTestApp.printFitting = {
    fit: fit,
    TARGET_HEIGHT_MM: TARGET_HEIGHT_MM,
    PRINTABLE_HEIGHT_MM: PRINTABLE_HEIGHT_MM,
    MIN_FONT_SIZE: MIN_FONT_SIZE,
    MIN_LINE_HEIGHT: MIN_LINE_HEIGHT,
    MIN_PADDING_MM: MIN_PADDING_MM,
    MIN_ROW_GAP_FACTOR: MIN_ROW_GAP_FACTOR,
    MIN_SECTION_GAP_FACTOR: MIN_SECTION_GAP_FACTOR,
  };
})();
