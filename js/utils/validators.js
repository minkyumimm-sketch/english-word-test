/**
 * 入力値の検証・正規化ヘルパー。
 * 名前空間: WordTestApp.validators
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});

  /**
   * 整数値を min〜max の範囲に丸め込む。数値化できない場合は fallback を返す。
   */
  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /**
   * テスト生成設定を検証し、{ ok, errors, settings } を返す。
   * settings は正規化済みの値が入る（ok=false のときは参考値）。
   */
  function validateSettings(raw) {
    var errors = [];
    var batchEnabled = !!raw.batchEnabled;

    var startRank = clampInt(raw.startRank, 1, 1000000, 1);
    var endRank = clampInt(raw.endRank, 1, 1000000, startRank);

    // 終了順位は単発モードのみで使う値。複数日モードでは「作成日数」で範囲が決まるため、
    // 表示されていない終了順位の古い入力値でバリデーションエラーにしない。
    if (!batchEnabled && endRank < startRank) {
      errors.push("終了順位は開始順位以上にしてください。");
    }

    var direction = raw.direction === "ja-en" ? "ja-en" : "en-ja";
    var order = raw.order === "random" ? "random" : "rank";
    var levelFilter = (raw.levelFilter || "").trim();

    var settings = {
      startRank: startRank,
      endRank: endRank,
      direction: direction,
      order: order,
      levelFilter: levelFilter,
      batch: {
        enabled: batchEnabled,
        chunkSize: clampInt(raw.chunkSize, 1, 100000, 100),
        dayCount: clampInt(raw.dayCount, 1, 1000, 5),
        questionsPerChunk: clampInt(raw.questionsPerChunk, 1, 100000, 100),
      },
      questionCount: clampInt(raw.questionCount, 1, 100000, 50),
    };

    return { ok: errors.length === 0, errors: errors, settings: settings };
  }

  WordTestApp.validators = {
    clampInt: clampInt,
    validateSettings: validateSettings,
  };
})();
