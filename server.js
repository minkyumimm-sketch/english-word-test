/**
 * 依存パッケージ不要の簡易静的サーバー。
 * 使い方: node server.js  →  http://localhost:5500/ を開く
 *
 * index.html を file:// で直接開いても動作しますが、
 * ブラウザによっては一部機能が制限される場合があるため、
 * 環境に応じてこちらのサーバー経由での起動も利用できます。
 *
 * Ver2.3で index.html / css / js / lib をリポジトリ直下へ移動したため、
 * ROOTはプロジェクトルート（__dirname）になった。ただし、同じ階層にある
 * Data/（単語データExcel）・docs/・.git 等まで誤って配信しないよう、
 * 配信を許可するトップレベルの項目を明示的に絞っている。
 */
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = process.env.PORT || 5500;
var ROOT = __dirname;

// このアプリ本体を構成するファイル/フォルダのみ配信する（Data/・docs/・.git等は配信しない）。
var ALLOWED_TOP_LEVEL_ENTRIES = ["index.html", "css", "js", "lib"];

var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

var server = http.createServer(function (req, res) {
  var requestPath = decodeURIComponent(req.url.split("?")[0]);
  if (requestPath === "/") requestPath = "/index.html";

  var topLevelEntry = requestPath.split("/")[1];
  if (ALLOWED_TOP_LEVEL_ENTRIES.indexOf(topLevelEntry) === -1) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found: " + requestPath);
    return;
  }

  var filePath = path.join(ROOT, requestPath);

  // ROOT配下から外れるパスは拒否する
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, function (err, content) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found: " + requestPath);
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, function () {
  console.log("英単語テスト作成アプリを起動しました: http://localhost:" + PORT + "/");
});
