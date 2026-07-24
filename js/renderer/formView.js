/**
 * データ読込パネル・設定フォームのDOM操作とイベント配線。
 * 名前空間: WordTestApp.formView
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});
  var dom = WordTestApp.dom;
  var googleSheetLoader = WordTestApp.googleSheetLoader;

  var els = {};

  function cacheEls() {
    els.excelLoadFields = dom.qs("#excelLoadFields");
    els.dropzone = dom.qs("#dropzone");
    els.fileInput = dom.qs("#fileInput");
    els.googleSheetLoadFields = dom.qs("#googleSheetLoadFields");
    els.sheetUrl = dom.qs("#sheetUrl");
    els.sheetUrlHint = dom.qs("#sheetUrlHint");
    els.loadSheetButton = dom.qs("#loadSheetButton");
    els.loadStatus = dom.qs("#loadStatus");
    els.loadActions = dom.qs("#loadActions");
    els.exportCsvButton = dom.qs("#exportCsvButton");
    els.clearDataButton = dom.qs("#clearDataButton");
    els.materialInfo = dom.qs("#materialInfo");

    els.settingsPanel = dom.qs("#settingsPanel");
    els.settingsForm = dom.qs("#settingsForm");
    els.testTitle = dom.qs("#testTitle");
    els.startRank = dom.qs("#startRank");
    els.endRankField = dom.qs("#endRankField");
    els.endRank = dom.qs("#endRank");
    els.levelFilter = dom.qs("#levelFilter");
    els.questionCount = dom.qs("#questionCount");
    els.chunkSize = dom.qs("#chunkSize");
    els.dayCount = dom.qs("#dayCount");
    els.questionsPerChunk = dom.qs("#questionsPerChunk");
    els.singleModeFields = dom.qs("#singleModeFields");
    els.batchModeFields = dom.qs("#batchModeFields");
    els.generationPreview = dom.qs("#generationPreview");
    els.formError = dom.qs("#formError");
  }

  function init(handlers) {
    cacheEls();

    els.fileInput.addEventListener("change", function () {
      var file = els.fileInput.files && els.fileInput.files[0];
      if (file) handlers.onFileSelected(file);
      // 選択直後に値をリセットしておく。ブラウザは同じファイルを連続で選択した場合
      // input.valueが変化しないとchangeイベントを発火しないため、次回も確実に
      // 発火させるための対策（Excelを編集・再選択する運用で起こりうる）。
      els.fileInput.value = "";
    });

    ["dragenter", "dragover"].forEach(function (evtName) {
      els.dropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        els.dropzone.classList.add("dropzone-active");
      });
    });
    ["dragleave", "drop"].forEach(function (evtName) {
      els.dropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        els.dropzone.classList.remove("dropzone-active");
      });
    });
    els.dropzone.addEventListener("drop", function (e) {
      var file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handlers.onFileSelected(file);
    });

    els.clearDataButton.addEventListener("click", function () {
      handlers.onClearData();
    });

    els.exportCsvButton.addEventListener("click", function () {
      handlers.onExportCsv();
    });

    dom.qsa('input[name="loadMethod"]').forEach(function (radio) {
      radio.addEventListener("change", applyLoadMethodVisibility);
    });

    els.sheetUrl.addEventListener("input", updateSheetUrlHint);

    els.loadSheetButton.addEventListener("click", function () {
      handlers.onLoadSheet(els.sheetUrl.value);
    });
    els.sheetUrl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        handlers.onLoadSheet(els.sheetUrl.value);
      }
    });

    dom.qsa('input[name="mode"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        applyModeVisibility();
        notifyPreviewInputsChanged(handlers);
      });
    });

    if (handlers.onPreviewInputsChanged) {
      [els.startRank, els.chunkSize, els.dayCount, els.questionsPerChunk, els.levelFilter].forEach(function (el) {
        el.addEventListener("input", function () {
          notifyPreviewInputsChanged(handlers);
        });
        el.addEventListener("change", function () {
          notifyPreviewInputsChanged(handlers);
        });
      });
    }

    els.settingsForm.addEventListener("submit", function (e) {
      e.preventDefault();
      handlers.onGenerate(readRawSettings());
    });
  }

  function notifyPreviewInputsChanged(handlers) {
    if (handlers.onPreviewInputsChanged) handlers.onPreviewInputsChanged();
  }

  function getLoadMethod() {
    var checked = dom.qs('input[name="loadMethod"]:checked');
    return checked ? checked.value : "excel";
  }

  function setLoadMethod(method) {
    if (method !== "excel" && method !== "googleSheet") return;
    var radio = dom.qs('input[name="loadMethod"][value="' + method + '"]');
    if (radio) radio.checked = true;
    applyLoadMethodVisibility();
  }

  function applyLoadMethodVisibility() {
    var isGoogleSheet = getLoadMethod() === "googleSheet";
    els.excelLoadFields.hidden = isGoogleSheet;
    els.googleSheetLoadFields.hidden = !isGoogleSheet;
  }

  function getSheetUrl() {
    return els.sheetUrl.value;
  }

  function setSheetUrl(url) {
    els.sheetUrl.value = url || "";
    updateSheetUrlHint();
  }

  function updateSheetUrlHint() {
    var raw = els.sheetUrl.value.trim();
    if (!raw || !googleSheetLoader) {
      els.sheetUrlHint.hidden = true;
      els.sheetUrlHint.textContent = "";
      return;
    }
    var csvUrl = googleSheetLoader.toCsvUrl(raw);
    if (!csvUrl || csvUrl === raw) {
      els.sheetUrlHint.hidden = true;
      els.sheetUrlHint.textContent = "";
      return;
    }
    els.sheetUrlHint.hidden = false;
    els.sheetUrlHint.textContent = "→ 変換後のCSV URL: " + csvUrl;
  }

  function getMode() {
    var checked = dom.qs('input[name="mode"]:checked');
    return checked ? checked.value : "single";
  }

  function applyModeVisibility() {
    var isBatch = getMode() === "batch";
    els.singleModeFields.hidden = isBatch;
    els.batchModeFields.hidden = !isBatch;
    // 複数日モードでは終了順位を使わない（作成日数で範囲が決まるため）。
    els.endRankField.hidden = isBatch;
    if (!isBatch) clearGenerationPreview();
  }

  function readRawSettings() {
    var direction = dom.qs('input[name="direction"]:checked').value;
    var order = dom.qs('input[name="order"]:checked').value;
    var mode = getMode();

    return {
      testTitle: els.testTitle.value,
      startRank: els.startRank.value,
      endRank: els.endRank.value,
      levelFilter: els.levelFilter.value,
      direction: direction,
      order: order,
      questionCount: els.questionCount.value,
      batchEnabled: mode === "batch",
      chunkSize: els.chunkSize.value,
      dayCount: els.dayCount.value,
      questionsPerChunk: els.questionsPerChunk.value,
    };
  }

  function setRadioValue(name, value) {
    if (!value) return;
    var radio = dom.qs('input[name="' + name + '"][value="' + value + '"]');
    if (radio) radio.checked = true;
  }

  /**
   * 前回保存された設定（readRawSettings()と同じ形状）をフォームへ反映する。
   * レベル指定は、現在読み込まれているデータに該当する選択肢がある場合のみ復元する
   * （Excelが差し替わって選択肢が変わっているケースを考慮）。
   */
  function setFormValues(settings) {
    if (!settings) return;

    if (settings.testTitle !== undefined) els.testTitle.value = settings.testTitle;
    if (settings.startRank !== undefined) els.startRank.value = settings.startRank;
    if (settings.endRank !== undefined) els.endRank.value = settings.endRank;
    if (settings.questionCount !== undefined) els.questionCount.value = settings.questionCount;
    if (settings.chunkSize !== undefined) els.chunkSize.value = settings.chunkSize;
    if (settings.dayCount !== undefined) els.dayCount.value = settings.dayCount;
    if (settings.questionsPerChunk !== undefined) els.questionsPerChunk.value = settings.questionsPerChunk;

    if (settings.levelFilter) {
      var hasOption = dom.qsa("option", els.levelFilter).some(function (opt) {
        return opt.value === settings.levelFilter;
      });
      if (hasOption) els.levelFilter.value = settings.levelFilter;
    }

    setRadioValue("direction", settings.direction);
    setRadioValue("order", settings.order);
    if (settings.batchEnabled !== undefined) {
      setRadioValue("mode", settings.batchEnabled ? "batch" : "single");
      applyModeVisibility();
    }
  }

  function clearGenerationPreview() {
    els.generationPreview.hidden = true;
    dom.clear(els.generationPreview);
  }

  /**
   * 複数日モードの「生成予定」を表示する。testSets は
   * testGenerator.generateBatch() の戻り値をそのまま渡す想定
   * （実際の生成と全く同じロジックで見積もるため、件数のズレが起きない）。
   */
  function renderGenerationPreview(testSets) {
    dom.clear(els.generationPreview);

    if (!testSets || testSets.length === 0) {
      els.generationPreview.hidden = false;
      els.generationPreview.appendChild(
        dom.el("p", { class: "generation-preview-empty", text: "条件に合う単語がないため、生成予定を表示できません。" })
      );
      return;
    }

    var list = dom.el("ul", { class: "generation-preview-list" });
    var shortNotes = [];
    var totalAvailable = 0;
    var totalItems = 0;

    testSets.forEach(function (testSet) {
      list.appendChild(
        dom.el("li", { text: testSet.label + "（" + testSet.items.length + "問）" })
      );
      totalAvailable += testSet.availableCount;
      totalItems += testSet.items.length;
      if (testSet.isShort) {
        shortNotes.push(
          testSet.dayNumber + "日目は順位" + testSet.startRank + "〜" + testSet.actualEndRank + "が対象です"
        );
      }
    });

    els.generationPreview.hidden = false;
    els.generationPreview.appendChild(dom.el("p", { class: "generation-preview-heading", text: "生成予定" }));
    els.generationPreview.appendChild(list);

    shortNotes.forEach(function (note) {
      els.generationPreview.appendChild(dom.el("p", { class: "generation-preview-note", text: note }));
    });

    els.generationPreview.appendChild(
      dom.el("div", { class: "generation-preview-total" }, [
        dom.el("p", { class: "generation-preview-total-heading", text: "合計" }),
        dom.el("p", { text: "対象語数：" + totalAvailable + "語" }),
        dom.el("p", { text: "総出題数：" + totalItems + "問" }),
      ])
    );
  }

  function setLevels(levels) {
    dom.clear(els.levelFilter);
    els.levelFilter.appendChild(dom.el("option", { value: "", text: "すべて" }));
    levels.forEach(function (level) {
      els.levelFilter.appendChild(dom.el("option", { value: level, text: level }));
    });
  }

  function setLoadStatus(message, kind) {
    els.loadStatus.textContent = message;
    els.loadStatus.className = "load-status" + (kind ? " load-status-" + kind : "");
  }

  var MATERIAL_METHOD_LABEL = { excel: "Excelファイル", googleSheet: "Googleスプレッドシート" };
  var MATERIAL_METHOD_ICON = { excel: "📄", googleSheet: "☁️" };

  /**
   * 「現在の教材」パネルを更新する。
   * @param {{name: string, method: 'excel'|'googleSheet'}|null} material 未読込の場合は null
   */
  function renderMaterialInfo(material) {
    dom.clear(els.materialInfo);

    if (!material || !material.name) {
      els.materialInfo.appendChild(dom.el("p", { class: "material-empty", text: "教材未読込" }));
      return;
    }

    var method = material.method === "googleSheet" ? "googleSheet" : "excel";
    els.materialInfo.appendChild(
      dom.el("p", { class: "material-name" }, [
        dom.el("span", { class: "material-icon", text: MATERIAL_METHOD_ICON[method] }),
        " " + material.name,
      ])
    );
    els.materialInfo.appendChild(
      dom.el("p", { class: "material-method", text: "読込方法：" + MATERIAL_METHOD_LABEL[method] })
    );
  }

  function setLoadActionsVisible(visible) {
    els.loadActions.hidden = !visible;
  }

  function setSettingsPanelVisible(visible) {
    els.settingsPanel.hidden = !visible;
  }

  function showFormError(message) {
    if (!message) {
      els.formError.hidden = true;
      els.formError.textContent = "";
      return;
    }
    els.formError.hidden = false;
    els.formError.textContent = message;
  }

  function setDefaultRankRange(maxRank) {
    els.endRank.value = Math.min(100, maxRank);
    els.endRank.max = maxRank;
    els.startRank.max = maxRank;
  }

  /**
   * タイトル欄の値を直接設定する（教材読込時の初期値自動入力用）。
   * @param {string} title
   */
  function setTestTitle(title) {
    els.testTitle.value = title || "";
  }

  WordTestApp.formView = {
    init: init,
    setLevels: setLevels,
    setLoadStatus: setLoadStatus,
    setLoadActionsVisible: setLoadActionsVisible,
    setSettingsPanelVisible: setSettingsPanelVisible,
    showFormError: showFormError,
    setDefaultRankRange: setDefaultRankRange,
    setTestTitle: setTestTitle,
    getRawSettings: readRawSettings,
    setFormValues: setFormValues,
    getLoadMethod: getLoadMethod,
    setLoadMethod: setLoadMethod,
    getSheetUrl: getSheetUrl,
    setSheetUrl: setSheetUrl,
    renderGenerationPreview: renderGenerationPreview,
    clearGenerationPreview: clearGenerationPreview,
    renderMaterialInfo: renderMaterialInfo,
  };
})();
