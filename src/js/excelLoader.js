/**
 * Excel(.xlsm/.xlsx)ファイルを読み込み、単語データ配列に変換する。
 * 依存: lib/xlsx.full.min.js (SheetJS), wordRowParser.js（列判定・行検証の共通ロジック）
 * 名前空間: WordTestApp.excelLoader
 *
 * このモジュールの責務は「Excelファイル → 行×列の配列」までの変換のみ。
 * 列判定・行の検証（順位/英語/訳の抽出、スキップ判定等）は wordRowParser.js に
 * 委譲している（Googleスプレッドシート読込(googleSheetLoader.js)と共通のロジック）。
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});
  var wordRowParser = WordTestApp.wordRowParser;

  function pickDataSheet(workbook) {
    // "Sheet1" 相当（単語データ）を優先。無ければ先頭シートを使用。
    var preferredNames = ["Sheet1", "単語", "単語データ", "データ"];
    for (var i = 0; i < preferredNames.length; i++) {
      if (workbook.SheetNames.indexOf(preferredNames[i]) !== -1) {
        return workbook.Sheets[preferredNames[i]];
      }
    }
    return workbook.Sheets[workbook.SheetNames[0]];
  }

  /**
   * ArrayBuffer から単語データを抽出する。
   * @returns {{ words: Array, levels: Array<string>, sheetName: string, skippedRows: number }}
   */
  function parseWorkbook(arrayBuffer) {
    if (typeof XLSX === "undefined") {
      throw new Error("Excel読み込みライブラリ(SheetJS)が読み込まれていません。");
    }

    var workbook = XLSX.read(arrayBuffer, { type: "array" });
    var sheet = pickDataSheet(workbook);
    if (!sheet) {
      throw new Error("Excel内にシートが見つかりませんでした。");
    }

    var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    var parsed = wordRowParser.parseRows(rows);

    var sheetName = workbook.SheetNames.filter(function (name) {
      return workbook.Sheets[name] === sheet;
    })[0] || "";

    return {
      words: parsed.words,
      levels: parsed.levels,
      sheetName: sheetName,
      skippedRows: parsed.skippedRows,
    };
  }

  /**
   * File オブジェクトから単語データを読み込む。
   * @param {File} file
   * @returns {Promise<{words:Array, levels:Array, skippedRows:number, fileName:string}>}
   */
  function loadFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("ファイルが選択されていません。"));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("ファイルの読み込みに失敗しました。"));
      };
      reader.onload = function (event) {
        try {
          var result = parseWorkbook(event.target.result);
          result.fileName = file.name;
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  WordTestApp.excelLoader = {
    loadFromFile: loadFromFile,
    parseWorkbook: parseWorkbook,
  };
})();
