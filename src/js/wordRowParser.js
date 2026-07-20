/**
 * 「1行目ヘッダー・2行目以降データ」の2次元配列（行×列の文字列配列）から
 * 単語データ(WordEntry[])を組み立てる、データソース非依存の共通ロジック。
 * 名前空間: WordTestApp.wordRowParser
 *
 * Excel(excelLoader.js)・Googleスプレッドシート(googleSheetLoader.js)は、
 * どちらも最終的にこの「行×列の配列」に変換したうえでこのモジュールに渡す。
 * 列判定・行の検証ロジックを二重実装しないための共通化。
 *
 * 想定ヘッダー構成:
 *   レベル / 順位 / 掲載ページ / 英語 / 訳 など
 * ヘッダー文字列からキーワード一致で列位置を自動判定し、
 * 見つからない場合は既定の列位置(A,B,C,D,E)にフォールバックする。
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});

  var HEADER_KEYWORDS = {
    level: ["レベル"],
    rank: ["順位"],
    page: ["ページ"],
    en: ["英語", "英単語"],
    ja: ["訳", "日本語", "意味"],
  };

  var DEFAULT_COLUMNS = { level: 0, rank: 1, page: 2, en: 3, ja: 4 };
  var MIN_HEADER_COLUMNS = 2; // 最低限、順位・英語（または訳）に相当する列数

  function detectColumns(headerRow) {
    var found = {};
    headerRow.forEach(function (cell, index) {
      var text = (cell || "").toString();
      Object.keys(HEADER_KEYWORDS).forEach(function (key) {
        if (found[key] !== undefined) return;
        var keywords = HEADER_KEYWORDS[key];
        for (var i = 0; i < keywords.length; i++) {
          if (text.indexOf(keywords[i]) !== -1) {
            found[key] = index;
            break;
          }
        }
      });
    });

    var columns = {};
    Object.keys(DEFAULT_COLUMNS).forEach(function (key) {
      columns[key] = found[key] !== undefined ? found[key] : DEFAULT_COLUMNS[key];
    });
    return columns;
  }

  /**
   * 行×列の配列（rows[0]=ヘッダー、rows[1..]=データ）から単語データを抽出する。
   * @param {Array<Array<string>>} rows
   * @returns {{ words: Array, levels: Array<string>, skippedRows: number }}
   */
  function parseRows(rows) {
    if (!rows || rows.length < 2) {
      throw new Error("単語データの行が見つかりませんでした。1行目はヘッダー、2行目以降にデータが必要です。");
    }

    var headerRow = rows[0];
    if (!headerRow || headerRow.length < MIN_HEADER_COLUMNS) {
      throw new Error("ヘッダー行の列数が不足しています（順位・英語・訳などの列が必要です）。");
    }

    var columns = detectColumns(headerRow);
    var words = [];
    var skippedRows = 0;
    var levelSet = {};
    var levelOrder = [];

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i] || [];
      var rankRaw = row[columns.rank];
      var en = (row[columns.en] || "").toString().trim();
      var ja = (row[columns.ja] || "").toString().trim();
      var level = (row[columns.level] || "").toString().trim();
      var page = (row[columns.page] || "").toString().trim();
      var rank = parseInt(rankRaw, 10);

      if (!en || !ja || isNaN(rank)) {
        skippedRows++;
        continue;
      }

      if (level && !levelSet[level]) {
        levelSet[level] = true;
        levelOrder.push(level);
      }

      words.push({ rank: rank, en: en, ja: ja, level: level, page: page });
    }

    if (words.length === 0) {
      throw new Error("有効な単語データが1件も読み込めませんでした。列構成（順位・英語・訳）をご確認ください。");
    }

    words.sort(function (a, b) {
      return a.rank - b.rank;
    });

    return {
      words: words,
      levels: levelOrder,
      skippedRows: skippedRows,
    };
  }

  WordTestApp.wordRowParser = {
    detectColumns: detectColumns,
    parseRows: parseRows,
  };
})();
