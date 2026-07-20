/**
 * Googleスプレッドシート（「ウェブに公開」したCSV、または公開範囲が
 * 「リンクを知っている全員が閲覧可」の通常URL）から単語データを読み込む。
 * 依存: utils/csv.js（CSVパース）, wordRowParser.js（列判定・行検証の共通ロジック）
 * 名前空間: WordTestApp.googleSheetLoader
 *
 * このモジュールの責務は「GoogleスプレッドシートのURL → CSV取得 → 行×列の配列」
 * までの変換のみ。列判定・行の検証は excelLoader.js と同じ wordRowParser.js に委譲する
 * （データ形式はExcelと完全互換）。
 */
(function () {
  "use strict";

  var WordTestApp = (window.WordTestApp = window.WordTestApp || {});
  var csv = WordTestApp.csv;
  var wordRowParser = WordTestApp.wordRowParser;

  function extractSpreadsheetId(url) {
    var m = url.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  function extractGid(url) {
    var m = url.match(/[?&#]gid=([0-9]+)/);
    return m ? m[1] : null;
  }

  function isPublishedUrl(url) {
    return /\/spreadsheets\/d\/e\//.test(url);
  }

  function looksLikeCsvUrl(url) {
    return /[?&]output=csv\b/.test(url) || /[?&]format=csv\b/.test(url) || /\/gviz\/tq\b.*out:csv/.test(url);
  }

  /**
   * 通常のGoogleスプレッドシートURL（編集画面のURL・「ウェブに公開」のURL等）から、
   * CSVとして取得できるURLへ変換する。Googleスプレッドシート以外のURLは
   * 「既に公開CSVのURL」とみなしそのまま返す。
   * @param {string} rawUrl
   * @returns {string}
   */
  function toCsvUrl(rawUrl) {
    var url = (rawUrl || "").trim();
    if (!url) return "";

    if (looksLikeCsvUrl(url)) {
      return url;
    }

    if (!/docs\.google\.com\/spreadsheets/.test(url)) {
      // Googleスプレッドシート以外のURL（既に公開CSVのURL等）はそのまま利用する
      return url;
    }

    var gid = extractGid(url);

    if (isPublishedUrl(url)) {
      // 「ファイル > 共有 > ウェブに公開」で発行されたURL（/d/e/{publishedId}/...）
      var publishedId = extractSpreadsheetId(url);
      if (!publishedId) return url;
      var pubBase = "https://docs.google.com/spreadsheets/d/e/" + publishedId + "/pub?output=csv";
      return gid ? pubBase + "&gid=" + gid : pubBase;
    }

    // 通常の編集URL等（/d/{id}/edit...）
    var id = extractSpreadsheetId(url);
    if (!id) return url;
    var exportBase = "https://docs.google.com/spreadsheets/d/" + id + "/export?format=csv";
    return gid ? exportBase + "&gid=" + gid : exportBase;
  }

  function isHtmlResponse(text) {
    return /^\s*<(!doctype html|html)/i.test(text);
  }

  /**
   * 「ウェブに公開」されたURL（/d/e/{publishedId}/...）の場合のみ、公開HTMLビューの
   * URLを組み立てる。タイトル取得（fetchTitleBestEffort）専用。それ以外のURLではnull。
   */
  function buildPubHtmlUrl(rawUrl) {
    var url = (rawUrl || "").trim();
    if (!/docs\.google\.com\/spreadsheets/.test(url) || !isPublishedUrl(url)) return null;
    var publishedId = extractSpreadsheetId(url);
    if (!publishedId) return null;
    var gid = extractGid(url);
    var base = "https://docs.google.com/spreadsheets/d/e/" + publishedId + "/pubhtml";
    return gid ? base + "?gid=" + gid + "&single=true" : base;
  }

  /**
   * HTMLの<title>からスプレッドシートのタイトルを取り出す。
   * Googleは「シート名 - Google スプレッドシート」のような形式で返すことが多いため、
   * 末尾の定型部分は取り除く。
   */
  function extractTitleFromHtml(html) {
    var m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return null;
    var title = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    title = title.replace(/\s*[-–—]\s*Google\s*(Sheets|スプレッドシート)\s*$/i, "").trim();
    return title || null;
  }

  /**
   * URLの末尾（ファイル名相当の部分）を取り出す。Googleスプレッドシート以外の
   * 汎用CSV URL（例: https://example.com/data/words.csv）向けのフォールバック名に使う。
   */
  function extractFileNameFromUrl(url) {
    try {
      var withoutQuery = (url || "").split(/[?#]/)[0];
      var segments = withoutQuery.split("/").filter(Boolean);
      var last = segments[segments.length - 1];
      return last ? decodeURIComponent(last) : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * URLだけから、分かりやすい教材名を推測する（通信なし・同期）。
   * Googleスプレッドシートの通常URL・公開URLはID等しか含まれず名称にならないためnullを返す
   * （呼び出し側で「Googleスプレッドシート」のような既定ラベルにフォールバックする想定）。
   * Google以外の汎用CSV URLは、URLの末尾（ファイル名相当）を返す。
   * @param {string} rawUrl
   * @returns {string|null}
   */
  function deriveFallbackName(rawUrl) {
    var url = (rawUrl || "").trim();
    if (!url) return null;
    if (/docs\.google\.com\/spreadsheets/.test(url)) return null;
    return extractFileNameFromUrl(url);
  }

  /**
   * 可能であればスプレッドシートの実際のタイトルを取得する（ベストエフォート）。
   * 「ウェブに公開」されたURLの場合のみ、公開HTMLビューを取得してtitleを解析する。
   * 取得できない・失敗した場合は例外を投げず null を返す
   * （データ読込の成否には影響させない、表示名の付加情報のための処理のため）。
   * @param {string} rawUrl
   * @returns {Promise<string|null>}
   */
  function fetchTitleBestEffort(rawUrl) {
    var pubHtmlUrl = buildPubHtmlUrl(rawUrl);
    if (!pubHtmlUrl) return Promise.resolve(null);

    return fetch(pubHtmlUrl, { credentials: "omit", cache: "no-store" })
      .then(function (res) {
        return res.ok ? res.text() : null;
      })
      .then(function (html) {
        return html ? extractTitleFromHtml(html) : null;
      })
      .catch(function () {
        return null;
      });
  }

  /**
   * GoogleスプレッドシートのURL（または公開CSVのURL）から単語データを読み込む。
   * @param {string} rawUrl
   * @returns {Promise<{words:Array, levels:Array, skippedRows:number, csvUrl:string}>}
   */
  function loadFromUrl(rawUrl) {
    return new Promise(function (resolve, reject) {
      var trimmed = (rawUrl || "").trim();
      if (!trimmed) {
        reject(new Error("GoogleスプレッドシートのURL、または公開CSVのURLを入力してください。"));
        return;
      }

      var csvUrl = toCsvUrl(trimmed);
      if (!/^https?:\/\//i.test(csvUrl)) {
        reject(new Error("URLの形式が正しくありません。httpまたはhttpsで始まるURLを指定してください。"));
        return;
      }

      fetch(csvUrl, { credentials: "omit", cache: "no-store" })
        .then(function (res) {
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              throw new Error(
                "アクセスが拒否されました（HTTP " + res.status + "）。スプレッドシートが「ウェブに公開」されているかご確認ください。"
              );
            }
            if (res.status === 404) {
              throw new Error("シートが見つかりませんでした（HTTP 404）。URLが正しいかご確認ください。");
            }
            throw new Error("CSVの取得に失敗しました（HTTP " + res.status + "）。");
          }
          return res.text();
        })
        .then(function (text) {
          if (isHtmlResponse(text)) {
            // 未公開のシートにアクセスすると、Googleのログイン/権限エラーページ(HTML)が
            // 200 OKで返ってくることがあるための追加チェック。
            throw new Error(
              "CSVを取得できませんでした。スプレッドシートが「ウェブに公開」されていない可能性があります。共有設定をご確認ください。"
            );
          }
          var rows = csv.parse(text);
          var parsed = wordRowParser.parseRows(rows);
          resolve({
            words: parsed.words,
            levels: parsed.levels,
            skippedRows: parsed.skippedRows,
            csvUrl: csvUrl,
          });
        })
        .catch(function (err) {
          if (err instanceof TypeError) {
            // fetch自体が失敗した場合（ネットワーク遮断・CORSブロック・名前解決失敗等）。
            // ブラウザの仕様上、原因の詳細は取得できないため代表的な原因を案内する。
            reject(
              new Error(
                "通信エラーが発生しました。ネットワーク接続、URLの間違い、またはスプレッドシートが「ウェブに公開」されていないことが原因の可能性があります。"
              )
            );
            return;
          }
          reject(err);
        });
    });
  }

  WordTestApp.googleSheetLoader = {
    toCsvUrl: toCsvUrl,
    loadFromUrl: loadFromUrl,
    deriveFallbackName: deriveFallbackName,
    fetchTitleBestEffort: fetchTitleBestEffort,
    extractTitleFromHtml: extractTitleFromHtml,
  };
})();
