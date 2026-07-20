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

  WordTestApp.csv = {
    parse: parse,
  };
})();
