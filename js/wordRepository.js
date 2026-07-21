/**
 * 読み込んだ単語データに対する検索・絞り込み処理。
 * 名前空間: WordTestApp.wordRepository
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});

  /**
   * 順位範囲で絞り込む（両端含む）。
   */
  function filterByRange(words, startRank, endRank) {
    return words.filter(function (w) {
      return w.rank >= startRank && w.rank <= endRank;
    });
  }

  /**
   * レベル文字列の部分一致で絞り込む。空文字なら絞り込みなし。
   */
  function filterByLevel(words, levelFilter) {
    if (!levelFilter) return words;
    return words.filter(function (w) {
      return w.level.indexOf(levelFilter) !== -1;
    });
  }

  /**
   * 範囲・レベルの組み合わせで絞り込む。
   */
  function query(words, options) {
    var result = filterByRange(words, options.startRank, options.endRank);
    if (options.levelFilter) {
      result = filterByLevel(result, options.levelFilter);
    }
    return result;
  }

  WordTestApp.wordRepository = {
    filterByRange: filterByRange,
    filterByLevel: filterByLevel,
    query: query,
  };
})();
