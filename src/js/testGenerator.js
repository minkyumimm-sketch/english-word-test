/**
 * 単語データから出題セット(TestSet)を生成する。
 * 名前空間: WordTestApp.testGenerator
 *
 * TestSet の形式:
 *   {
 *     id: string,
 *     label: string,           // 表示用の見出し（例: "1〜100" "1日目（1〜100）"）
 *     direction: 'en-ja'|'ja-en',
 *     rangeLabel: string,      // "1〜100" のような順位範囲表記
 *     items: [{ no, prompt, answer }]
 *   }
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});
  var wordRepository = WordTestApp.wordRepository;

  /** Fisher-Yates シャッフル（元配列は変更しない） */
  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function pickWords(words, order, count) {
    var pool = order === "random" ? shuffle(words) : words.slice().sort(function (a, b) {
      return a.rank - b.rank;
    });
    return pool.slice(0, Math.min(count, pool.length));
  }

  function buildItems(words, direction) {
    return words.map(function (w, index) {
      var prompt = direction === "ja-en" ? w.ja : w.en;
      var answer = direction === "ja-en" ? w.en : w.ja;
      return { no: index + 1, prompt: prompt, answer: answer, rank: w.rank };
    });
  }

  function rangeLabel(start, end) {
    return start === end ? String(start) : start + "〜" + end;
  }

  /**
   * 単発テストを1セット生成する。
   */
  function generateSingle(words, settings) {
    var filtered = wordRepository.query(words, {
      startRank: settings.startRank,
      endRank: settings.endRank,
      levelFilter: settings.levelFilter,
    });
    var selected = pickWords(filtered, settings.order, settings.questionCount);

    return {
      id: "single",
      label: "順位 " + rangeLabel(settings.startRank, settings.endRank),
      direction: settings.direction,
      rangeLabel: rangeLabel(settings.startRank, settings.endRank),
      availableCount: filtered.length,
      items: buildItems(selected, settings.direction),
    };
  }

  /**
   * 複数日分の一括テストを生成する（Ver2.1）。
   * 「開始順位」から「1日あたりの順位幅」ごとに「作成日数」分だけ範囲を区切り、
   * 各範囲から questionsPerChunk 問を選び、1日分＝1セットとする。
   * 終了順位は使わない（単語データが尽きた最終日は、実際に存在する範囲だけを対象にする）。
   */
  function generateBatch(words, settings) {
    var chunkSize = settings.batch.chunkSize;
    var dayCount = settings.batch.dayCount;
    var questionsPerChunk = settings.batch.questionsPerChunk;
    var sets = [];

    for (var day = 1; day <= dayCount; day++) {
      var start = settings.startRank + (day - 1) * chunkSize;
      var nominalEnd = start + chunkSize - 1;
      var filtered = wordRepository.query(words, {
        startRank: start,
        endRank: nominalEnd,
        levelFilter: settings.levelFilter,
      });

      if (filtered.length === 0) continue;

      // 実際に存在する最大順位でラベルを作る（単語数が尽きた最終日は範囲が縮む）。
      var actualEnd = filtered.reduce(function (max, w) {
        return Math.max(max, w.rank);
      }, start);
      var isShort = actualEnd < nominalEnd;

      var selected = pickWords(filtered, settings.order, questionsPerChunk);

      sets.push({
        id: "day" + day,
        label: day + "日目（順位 " + rangeLabel(start, actualEnd) + "）",
        direction: settings.direction,
        rangeLabel: rangeLabel(start, actualEnd),
        availableCount: filtered.length,
        items: buildItems(selected, settings.direction),
        dayNumber: day,
        startRank: start,
        nominalEndRank: nominalEnd,
        actualEndRank: actualEnd,
        isShort: isShort,
      });
    }

    return sets;
  }

  /**
   * 設定に応じて単発 or 一括を生成し、常に TestSet の配列を返す。
   */
  function generate(words, settings) {
    if (settings.batch.enabled) {
      return generateBatch(words, settings);
    }
    return [generateSingle(words, settings)];
  }

  WordTestApp.testGenerator = {
    shuffle: shuffle,
    generateSingle: generateSingle,
    generateBatch: generateBatch,
    generate: generate,
  };
})();
