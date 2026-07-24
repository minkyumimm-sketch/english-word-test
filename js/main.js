/**
 * アプリのエントリーポイント。各モジュールを配線する。
 */
(function () {
  "use strict";

  var WordTestApp = window.WordTestApp || {};
  var state = WordTestApp.state;
  var csvUtil = WordTestApp.csv;
  var excelLoader = WordTestApp.excelLoader;
  var googleSheetLoader = WordTestApp.googleSheetLoader;
  var testGenerator = WordTestApp.testGenerator;
  var validators = WordTestApp.validators;
  var formView = WordTestApp.formView;
  var resultView = WordTestApp.resultView;

  var GOOGLE_SHEET_SOURCE_LABEL = "Googleスプレッドシート";

  /**
   * @param {'excel'|'googleSheet'} [method] 「現在の教材」パネルのアイコン・読込方法表示に使う
   */
  function applyLoadedWords(words, levels, fileName, statusMessage, method) {
    state.setWords(words, levels, fileName);
    formView.setLevels(levels);

    var maxRank = words.reduce(function (max, w) {
      return Math.max(max, w.rank);
    }, 1);
    formView.setDefaultRankRange(maxRank);

    formView.setLoadStatus(statusMessage, "success");
    formView.setLoadActionsVisible(true);
    formView.setSettingsPanelVisible(true);
    formView.renderMaterialInfo({ name: fileName, method: method });
    // タイトル欄の初期値を、読み込んだ教材の単語テスト名に更新する。教材読込時にのみ
    // 発生するイベントであり、それ以外（入力欄の変更・生成予定の再計算等）ではタイトル欄に
    // 一切触れないため、ユーザーが手動で書き換えたタイトルを途中で消してしまうことはない。
    // アプリ起動直後の復元フローでは、この直後にrestorePersistedSettings()が前回保存した
    // タイトルで上書きするため、最終的にはそちらが優先される。
    formView.setTestTitle(state.getCurrentTestName());
    updateGenerationPreview();
  }

  /**
   * 複数日モードの「生成予定」を再計算して表示する。単発モード、または単語データ未読込の
   * 場合は非表示にする。実際の生成（testGenerator.generateBatch）と全く同じロジックで
   * 見積もるため、生成予定と実際の生成結果の件数がズレることはない。
   */
  function updateGenerationPreview() {
    var rawSettings = formView.getRawSettings();
    if (!rawSettings.batchEnabled || !state.hasWords()) {
      formView.clearGenerationPreview();
      return;
    }
    var validation = validators.validateSettings(rawSettings);
    var testSets = testGenerator.generateBatch(state.getWords(), validation.settings);
    formView.renderGenerationPreview(testSets);
  }

  function handleFileSelected(file) {
    formView.setLoadStatus("読み込み中…", null);
    excelLoader
      .loadFromFile(file)
      .then(function (result) {
        var message =
          "「" + result.fileName + "」から " + result.words.length + " 件の単語を読み込みました。" +
          (result.skippedRows > 0 ? "（" + result.skippedRows + "行はスキップしました）" : "");
        applyLoadedWords(result.words, result.levels, result.fileName, message, "excel");
        state.persistWordsToLocalStorage();
        saveLoadMethod("excel");
      })
      .catch(function (err) {
        formView.setLoadStatus("読み込みに失敗しました: " + err.message, "error");
      });
  }

  function handleLoadSheet(url) {
    formView.setLoadStatus("読み込み中…", null);
    googleSheetLoader
      .loadFromUrl(url)
      .then(function (result) {
        // 教材名: まずURLから即座に分かる範囲の名称（またはそれも無理なら既定ラベル）を使う。
        // 実際のシートタイトルはこの後ベストエフォートで取得し、取れれば差し替える。
        var fallbackName = googleSheetLoader.deriveFallbackName(url) || GOOGLE_SHEET_SOURCE_LABEL;
        var message =
          "「" + fallbackName + "」から " + result.words.length + " 件の単語を読み込みました。" +
          (result.skippedRows > 0 ? "（" + result.skippedRows + "行はスキップしました）" : "");
        applyLoadedWords(result.words, result.levels, fallbackName, message, "googleSheet");
        state.persistWordsToLocalStorage();
        saveLoadMethod("googleSheet", url);

        upgradeGoogleSheetTitle(url, fallbackName);
      })
      .catch(function (err) {
        formView.setLoadStatus("読み込みに失敗しました: " + err.message, "error");
      });
  }

  /**
   * Googleスプレッドシートの実際のタイトルをベストエフォートで取得し、取得できた場合のみ
   * 「現在の教材」パネルの表示・保存済みデータ名を差し替える。取得は非同期・失敗しても無害
   * （データ読込自体は既に完了しているため、この処理は表示名の付加的な改善に過ぎない）。
   * @param {string} url
   * @param {string} fallbackName この時点で表示中の名称（タイトルと同じならupdate不要）
   */
  function upgradeGoogleSheetTitle(url, fallbackName) {
    googleSheetLoader.fetchTitleBestEffort(url).then(function (title) {
      if (!title || title === fallbackName) return;
      // 読込完了後にユーザーが別の教材を読み込み直していた場合は上書きしない。
      if (state.getSourceFileName() !== fallbackName) return;

      state.updateSourceFileName(title);
      formView.renderMaterialInfo({ name: title, method: "googleSheet" });
      formView.setTestTitle(state.getCurrentTestName());
      state.persistWordsToLocalStorage();
    });
  }

  /**
   * 最後に使用したデータ読込方式（Excel/Googleスプレッドシート）とURLを保存する。
   * @param {'excel'|'googleSheet'} method
   * @param {string} [sheetUrlOverride] 省略時はフォームに現在入力されているURLを使う
   *   （Excel読込時にも、既に入力済みのGoogleスプレッドシートURLを消さずに残すため）。
   */
  function saveLoadMethod(method, sheetUrlOverride) {
    state.persistLoadMethodToLocalStorage({
      method: method,
      sheetUrl: sheetUrlOverride !== undefined ? sheetUrlOverride : formView.getSheetUrl(),
    });
  }

  /**
   * 読み込んだ単語データ一覧をCSVファイルとしてダウンロードする。
   * ファイル名の初期値は現在の単語テスト名（state.getCurrentTestName()）から組み立てる
   * （教材を読み込み直せば、次回のダウンロード時には新しい名前が使われる）。
   * sourceFileNameへは直接依存させず、必ずgetCurrentTestName()経由にすること
   * （教材名とテスト名が将来分離しても、この関数を変更せずに済むようにするため）。
   * 保存ダイアログでの名称変更はブラウザの標準機能に委ねる。
   */
  function handleExportCsv() {
    var words = state.getWords();
    if (!words.length) return;

    var rows = [["順位", "レベル", "ページ", "英語", "訳"]];
    words.forEach(function (w) {
      rows.push([w.rank, w.level, w.page, w.en, w.ja]);
    });

    // 先頭にBOMを付与し、Excelで開いた際に文字化けしないようにする。
    var BOM = String.fromCharCode(0xfeff);
    var blob = new Blob([BOM + csvUtil.stringify(rows)], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = csvUtil.buildFileName(state.getCurrentTestName());
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleClearData() {
    state.setWords([], [], "");
    state.setTestSets([]);
    state.clearPersistedWords();
    formView.setLoadStatus("", null);
    formView.setLoadActionsVisible(false);
    formView.setSettingsPanelVisible(false);
    formView.clearGenerationPreview();
    formView.renderMaterialInfo(null);
    resultView.render([]);
  }

  function handleGenerate(rawSettings) {
    var validation = validators.validateSettings(rawSettings);
    if (!validation.ok) {
      formView.showFormError(validation.errors.join(" "));
      return;
    }
    formView.showFormError(null);

    var testSets = testGenerator.generate(state.getWords(), validation.settings);
    var totalItems = testSets.reduce(function (sum, s) {
      return sum + s.items.length;
    }, 0);

    if (totalItems === 0) {
      formView.showFormError("指定した条件に合う単語が見つかりませんでした。順位範囲やレベル指定を見直してください。");
      resultView.render([]);
      return;
    }

    state.setTestSets(testSets);
    resultView.render(testSets, rawSettings.testTitle);
    saveCurrentSettings(rawSettings);

    var resultPanel = document.getElementById("resultPanel");
    if (resultPanel) resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * 現在のフォーム設定＋印刷対象を、最後に使用した設定としてlocalStorageへ保存する。
   * @param {Object} [rawSettings] 呼び出し元で既に取得済みのフォーム値があれば渡す（二重取得を避ける）
   * @param {string} [printModeOverride] 印刷対象セレクトの変更イベントから呼ばれた場合の新しい値
   */
  function saveCurrentSettings(rawSettings, printModeOverride) {
    var settings = rawSettings || formView.getRawSettings();
    settings.printMode = printModeOverride !== undefined ? printModeOverride : resultView.getPrintMode();
    state.persistSettingsToLocalStorage(settings);
  }

  /**
   * @param {'excel'|'googleSheet'} [loadMethod] 復元メッセージの案内文を読込方式に合わせるためのヒント
   */
  function restorePersistedWords(loadMethod) {
    var saved = state.loadWordsFromLocalStorage();
    if (!saved) return;
    var savedAtLabel = saved.savedAt ? new Date(saved.savedAt).toLocaleString("ja-JP") : "";
    var updateHint =
      loadMethod === "googleSheet"
        ? "スプレッドシートを更新した場合は「読み込む」を押し直してください。"
        : "Excelを更新した場合は再度ファイルを選択してください。";
    var message =
      "前回読み込んだデータ（" + (saved.sourceFileName || "不明なファイル") + "／" + saved.words.length + "件" +
      (savedAtLabel ? "／" + savedAtLabel + "時点" : "") +
      "）を復元しました。" + updateHint;
    applyLoadedWords(saved.words, saved.levels, saved.sourceFileName, message, loadMethod);
  }

  /**
   * 前回使用したデータ読込方式（Excel/Googleスプレッドシート）とURLをフォームへ反映する。
   * 単語データそのものは restorePersistedWords() が別途復元するため、ここではURLの
   * 自動再取得（ネットワークアクセス）は行わない（Excel読込が自動でファイルを
   * 再読込しないのと同じ考え方）。
   */
  function restorePersistedLoadMethod(saved) {
    if (!saved) return;
    formView.setLoadMethod(saved.method);
    formView.setSheetUrl(saved.sheetUrl);
  }

  /**
   * 前回使用したテスト条件（フォーム入力・印刷対象）を復元する。
   * レベル指定の選択肢はExcelデータ側に依存するため、必ず restorePersistedWords() の
   * 後に呼び出すこと（呼び出し順は index.html のデータ構造に依らずここで保証する）。
   */
  function restorePersistedSettings() {
    var saved = state.loadSettingsFromLocalStorage();
    if (!saved) return;
    formView.setFormValues(saved);
    if (saved.printMode) resultView.setPrintMode(saved.printMode);
  }

  document.addEventListener("DOMContentLoaded", function () {
    formView.init({
      onFileSelected: handleFileSelected,
      onClearData: handleClearData,
      onExportCsv: handleExportCsv,
      onGenerate: handleGenerate,
      onLoadSheet: handleLoadSheet,
      onPreviewInputsChanged: updateGenerationPreview,
    });
    resultView.init({
      onPrintModeChange: function (printMode) {
        saveCurrentSettings(null, printMode);
      },
    });

    formView.renderMaterialInfo(null); // 既定は「教材未読込」。復元があれば直後に上書きされる。

    var savedLoadMethod = state.loadLoadMethodFromLocalStorage();
    restorePersistedWords(savedLoadMethod && savedLoadMethod.method);
    restorePersistedSettings();
    restorePersistedLoadMethod(savedLoadMethod);
    updateGenerationPreview();
  });
})();
