// 確認用の簡易サーバ: node tools/serve.js [port]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = +process.argv[2] || 8123;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

http.createServer(function (req, res) {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(root, p === '/' ? 'index.html' : p);
  if (!f.startsWith(root) || f.indexOf(path.join(root, 'docs')) === 0) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, function (err, buf) {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', function () { console.log('http://localhost:' + port); });
