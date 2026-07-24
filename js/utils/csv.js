/**
 * 依存なしの簡易CSVパーサー（RFC4180相当: ダブルクォート囲み・エスケープ・改行混在に対応）。
 * 名前空間: WordTestApp.csv
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});

  /**
   * CSV文字列を行×列の配列に変換する。
   * @param {string} text
   * @returns {Array<Array<string>>}
   */
  function parse(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var str = String(text == null ? "" : text);
    var len = str.length;

    function pushField() {
      row.push(field);
      field = "";
    }
    function pushRow() {
      pushField();
      rows.push(row);
      row = [];
    }

    var i = 0;
    while (i < len) {
      var ch = str.charAt(i);

      if (inQuotes) {
        if (ch === '"') {
          if (str.charAt(i + 1) === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        pushField();
        i++;
        continue;
      }
      if (ch === "\r") {
        i++;
        continue;
      }
      if (ch === "\n") {
        pushRow();
        i++;
        continue;
      }
      field += ch;
      i++;
    }

    // 末尾に改行が無い最終行を回収する
    if (field.length > 0 || row.length > 0) {
      pushRow();
    }

    return rows;
  }

  var NEEDS_QUOTING = /[",\r\n]/;

  function stringifyField(field) {
    var str = field == null ? "" : String(field);
    if (NEEDS_QUOTING.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * 行×列の配列をCSV文字列に変換する（parseの逆）。改行はExcel互換のCRLFにする。
   * @param {Array<Array<*>>} rows
   * @returns {string}
   */
  function stringify(rows) {
    return rows
      .map(function (row) {
        return row.map(stringifyField).join(",");
      })
      .join("\r\n");
  }

  var INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
  var KNOWN_MATERIAL_EXTENSIONS = /\.(xlsx|xlsm|xls|csv)$/i;
  var DEFAULT_FILE_BASE = "単語データ";

  /**
   * 教材名（Excelファイル名やGoogleスプレッドシートのタイトル）から、既知の拡張子
   * （.xlsx/.xlsm/.xls/.csv、大文字小文字を無視）だけを取り除いた名前を返す。
   * CSVファイル名の組み立て（buildFileName）・「単語テスト名」の算出
   * （state.getCurrentTestName()）の両方から共通で呼ばれる、拡張子除去の唯一の実装
   * （重複実装を避けるため、拡張子リストはここにしか持たない）。
   * @param {string} name
   * @returns {string}
   */
  function stripKnownExtension(name) {
    return String(name || "").replace(KNOWN_MATERIAL_EXTENSIONS, "").trim();
  }

  /**
   * 教材名（Excelファイル名やGoogleスプレッドシートのタイトル）から、CSV書き出し用の
   * ファイル名を組み立てる。元の拡張子は取り除き、Windowsで使用できない文字
   * （\/:*?"<>|）は除去した上で .csv を付与する。
   * @param {string} materialName 例: "ターゲット1900.xlsm"
   * @returns {string} 例: "ターゲット1900.csv"
   */
  function buildFileName(materialName) {
    var base = stripKnownExtension(materialName).replace(INVALID_FILENAME_CHARS, "").trim();
    if (!base) base = DEFAULT_FILE_BASE;
    return base + ".csv";
  }

  WordTestApp.csv = {
    parse: parse,
    stringify: stringify,
    stripKnownExtension: stripKnownExtension,
    buildFileName: buildFileName,
  };
})();
