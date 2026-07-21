/**
 * アプリ全体の状態を保持するシンプルなストア。
 * 名前空間: WordTestApp.state
 *
 * 複雑なフレームワークは使わず、必要最小限の getter/setter のみ。
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});

  var WORDS_STORAGE_KEY = "wordTestApp.lastWords.v1";
  var SETTINGS_STORAGE_KEY = "wordTestApp.lastSettings.v1";
  var LOAD_METHOD_STORAGE_KEY = "wordTestApp.lastLoadMethod.v1";

  var data = {
    words: [],
    levels: [],
    sourceFileName: "",
    testSets: [],
  };

  function setWords(words, levels, fileName) {
    data.words = words;
    data.levels = levels;
    data.sourceFileName = fileName || "";
  }

  function getWords() {
    return data.words;
  }

  function getLevels() {
    return data.levels;
  }

  function getSourceFileName() {
    return data.sourceFileName;
  }

  /**
   * 単語データ自体は変更せず、教材名（現在の教材表示・localStorage保存用）だけを更新する。
   * Googleスプレッドシートのタイトルをベストエフォートで後から取得できた際に、
   * 読込直後に表示した仮の名称を差し替えるために使う（main.jsから呼ばれる）。
   */
  function updateSourceFileName(fileName) {
    data.sourceFileName = fileName || "";
  }

  function hasWords() {
    return data.words.length > 0;
  }

  function setTestSets(testSets) {
    data.testSets = testSets;
  }

  function getTestSets() {
    return data.testSets;
  }

  /** 単語データをブラウザに保存し、次回起動時の再アップロードを省略できるようにする。 */
  function persistWordsToLocalStorage() {
    try {
      var payload = JSON.stringify({
        words: data.words,
        levels: data.levels,
        sourceFileName: data.sourceFileName,
        savedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(WORDS_STORAGE_KEY, payload);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** 保存済みデータを読み込む。無ければ null。 */
  function loadWordsFromLocalStorage() {
    try {
      var raw = window.localStorage.getItem(WORDS_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.words) || parsed.words.length === 0) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function clearPersistedWords() {
    try {
      window.localStorage.removeItem(WORDS_STORAGE_KEY);
    } catch (err) {
      /* no-op */
    }
  }

  /**
   * 最後に使用したテスト条件（フォーム入力値一式）をブラウザに保存する。
   * 保存タイミングは main.js 側で制御する（テスト生成成功時・印刷対象変更時）。
   */
  function persistSettingsToLocalStorage(settings) {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch (err) {
      return false;
    }
  }

  /** 保存済みのテスト条件を読み込む。無ければ null。 */
  function loadSettingsFromLocalStorage() {
    try {
      var raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  /**
   * 最後に使用したデータ読込方式（Excel/Googleスプレッドシート）とURLを保存する。
   * @param {{method: 'excel'|'googleSheet', sheetUrl: string}} loadMethod
   */
  function persistLoadMethodToLocalStorage(loadMethod) {
    try {
      window.localStorage.setItem(LOAD_METHOD_STORAGE_KEY, JSON.stringify(loadMethod));
      return true;
    } catch (err) {
      return false;
    }
  }

  /** 保存済みの読込方式・URLを読み込む。無ければ null。 */
  function loadLoadMethodFromLocalStorage() {
    try {
      var raw = window.localStorage.getItem(LOAD_METHOD_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  WordTestApp.state = {
    setWords: setWords,
    getWords: getWords,
    getLevels: getLevels,
    getSourceFileName: getSourceFileName,
    updateSourceFileName: updateSourceFileName,
    hasWords: hasWords,
    setTestSets: setTestSets,
    getTestSets: getTestSets,
    persistWordsToLocalStorage: persistWordsToLocalStorage,
    loadWordsFromLocalStorage: loadWordsFromLocalStorage,
    clearPersistedWords: clearPersistedWords,
    persistSettingsToLocalStorage: persistSettingsToLocalStorage,
    loadSettingsFromLocalStorage: loadSettingsFromLocalStorage,
    persistLoadMethodToLocalStorage: persistLoadMethodToLocalStorage,
    loadLoadMethodFromLocalStorage: loadLoadMethodFromLocalStorage,
  };
})();
