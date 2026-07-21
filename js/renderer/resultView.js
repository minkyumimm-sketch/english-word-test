/**
 * 生成されたテスト結果（TestSet[]）の画面プレビューと印刷用DOMを構築する。
 * 名前空間: WordTestApp.resultView
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});
  var dom = WordTestApp.dom;
  var layoutRules = WordTestApp.layoutRules;
  var printFitting = WordTestApp.printFitting;

  var els = {};
  var currentTestSets = [];
  var activeSetId = null;
  var currentTitle = "";

  var DEFAULT_TITLE = "英単語テスト";
  var DIRECTION_LABEL = { "en-ja": "英語 → 日本語", "ja-en": "日本語 → 英語" };

  function cacheEls() {
    els.resultPanel = dom.qs("#resultPanel");
    els.tabList = dom.qs("#tabList");
    els.previewArea = dom.qs("#previewArea");
    els.printRoot = dom.qs("#printRoot");
    els.printModeSelect = dom.qs("#printMode");
    els.printButton = dom.qs("#printButton");
  }

  function getPreviewKind() {
    var checked = dom.qs('input[name="previewKind"]:checked');
    return checked ? checked.value : "problem";
  }

  /**
   * 与えられたlayout(--tp-*変数のもとになる値)で、1セット分のページ要素
   * (問題 or 解答)のDOMを組み立てる。印刷1ページ収まり調整(printFitting.js)が
   * 候補レイアウトを画面外で試作・計測する際にも同じ関数を使う
   * (計測結果と実際の表示がずれないようにするため)。
   */
  function buildPageDom(testSet, kind, layout) {
    var isAnswer = kind === "answer";
    var title = (currentTitle && currentTitle.trim()) || DEFAULT_TITLE;

    var itemsList = dom.el("div", { class: "item-list" });
    testSet.items.forEach(function (item) {
      var row = dom.el("div", { class: "item-row" }, [
        dom.el("span", { class: "item-no", text: item.no + "." }),
        dom.el("span", { class: "item-prompt", text: item.prompt }),
        isAnswer
          ? dom.el("span", { class: "item-answer", text: item.answer })
          : dom.el("span", { class: "item-blank" }),
      ]);
      itemsList.appendChild(row);
    });

    var header = dom.el("div", { class: "page-header" }, [
      dom.el("div", { class: "page-header-top" }, [
        dom.el("h3", { class: "page-title", text: title + (isAnswer ? "（解答）" : "") }),
        dom.el("span", { class: "page-direction", text: DIRECTION_LABEL[testSet.direction] }),
      ]),
      dom.el("div", { class: "page-meta", text: testSet.label + "　／　全" + testSet.items.length + "問" }),
      isAnswer
        ? null
        : dom.el("div", { class: "page-name-line" }, [
            dom.el("span", { class: "page-name" }, ["名前：＿＿＿＿＿＿＿＿＿＿＿＿"]),
            dom.el("span", { class: "page-score" }, ["点数：　　　／" + testSet.items.length]),
          ]),
    ]);

    var layoutStyle =
      "--tp-columns:" + layout.columns + ";" +
      "--tp-font-size:" + layout.fontSizePt + "pt;" +
      "--tp-line-height:" + layout.lineHeight + ";" +
      "--tp-padding:" + layout.paddingMm + "mm;" +
      "--tp-column-gap:" + layout.columnGapMm + "mm;" +
      "--tp-row-gap-factor:" + (layout.rowGapFactor != null ? layout.rowGapFactor : 1) + ";" +
      "--tp-section-gap-factor:" + (layout.sectionGapFactor != null ? layout.sectionGapFactor : 1) + ";";

    return dom.el(
      "div",
      { class: "test-page", dataset: { setId: testSet.id, kind: kind }, style: layoutStyle },
      [header, itemsList]
    );
  }

  /**
   * 1セット分のページ要素(問題 or 解答)を構築する。まず問題数段階ベースの
   * 基本レイアウト(layoutRules.computeLayout)を求め、印刷1ページ収まり調整
   * (printFitting.fit)で実測しながら「はみ出す場合のみ・必要最小限」だけ縮小する。
   * 問題ページ・解答ページは内容(空欄 or 実際の解答文字列)が異なり高さも変わり得るため、
   * それぞれ個別に計測・調整する（呼び出しごとに1ページ分だけを対象にしているため、
   * 自然に問題/解答が別々に扱われる）。
   */
  function buildPageElement(testSet, kind) {
    var baseLayout = layoutRules.computeLayout(testSet.items);
    var fitResult = printFitting.fit(testSet, baseLayout, function (layout) {
      return buildPageDom(testSet, kind, layout);
    });

    var pageEl = buildPageDom(testSet, kind, fitResult.layout);
    pageEl.dataset.fitScaled = String(fitResult.scaled);
    pageEl.dataset.fitWithinOnePage = String(fitResult.fitsOnePage);
    pageEl.dataset.fitHeightMm = String(Math.round(fitResult.heightMm * 10) / 10);
    pageEl.dataset.fitColumnsAdjusted = String(!!fitResult.columnsAdjusted);
    return pageEl;
  }

  function renderTabs() {
    dom.clear(els.tabList);
    currentTestSets.forEach(function (testSet) {
      var isActive = testSet.id === activeSetId;
      var tabButton = dom.el(
        "button",
        {
          type: "button",
          class: "tab-button" + (isActive ? " tab-button-active" : ""),
          onClick: function () {
            activeSetId = testSet.id;
            renderTabs();
            renderPreview();
          },
        },
        [testSet.label]
      );
      els.tabList.appendChild(tabButton);
    });
  }

  function renderPreview() {
    dom.clear(els.previewArea);
    var testSet = currentTestSets.filter(function (s) {
      return s.id === activeSetId;
    })[0];
    if (!testSet) return;
    els.previewArea.appendChild(buildPageElement(testSet, getPreviewKind()));
  }

  function renderPrintRoot() {
    dom.clear(els.printRoot);
    currentTestSets.forEach(function (testSet) {
      els.printRoot.appendChild(buildPageElement(testSet, "problem"));
      els.printRoot.appendChild(buildPageElement(testSet, "answer"));
    });
  }

  /**
   * テスト結果一式を受け取り、タブ・プレビュー・印刷用DOMをすべて再構築する。
   * @param {Array} testSets
   * @param {string} [title] 印刷ページ見出しに使うタイトル（未指定/空なら既定タイトル）
   */
  function render(testSets, title) {
    currentTestSets = testSets || [];
    currentTitle = title || "";
    activeSetId = currentTestSets.length > 0 ? currentTestSets[0].id : null;
    els.resultPanel.hidden = currentTestSets.length === 0;

    renderTabs();
    renderPreview();
    renderPrintRoot();
  }

  function getPrintMode() {
    return els.printModeSelect.value;
  }

  function setPrintMode(mode) {
    if (mode !== "problem" && mode !== "answer" && mode !== "both") return;
    els.printModeSelect.value = mode;
    document.body.setAttribute("data-print-mode", mode);
  }

  function init(handlers) {
    cacheEls();
    handlers = handlers || {};

    dom.qsa('input[name="previewKind"]').forEach(function (radio) {
      radio.addEventListener("change", renderPreview);
    });

    els.printModeSelect.addEventListener("change", function () {
      document.body.setAttribute("data-print-mode", els.printModeSelect.value);
      if (handlers.onPrintModeChange) handlers.onPrintModeChange(els.printModeSelect.value);
    });
    document.body.setAttribute("data-print-mode", els.printModeSelect.value);

    els.printButton.addEventListener("click", function () {
      window.print();
    });
  }

  WordTestApp.resultView = {
    init: init,
    render: render,
    getPrintMode: getPrintMode,
    setPrintMode: setPrintMode,
  };
})();
