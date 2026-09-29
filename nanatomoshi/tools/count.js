// 文字数計測: node tools/count.js [id ...]
// 本文と選択肢の文字数を数える（空白・改行・▷ は数えない）
'use strict';
const path = require('path');
const fs = require('fs');
const N = require('../js/core.js');

const dataDir = path.join(__dirname, '..', 'data');
const RANGE = {
  ch: [5950, 8050],
  ed1: [2975, 4025], ed2: [2975, 4025], ed3: [2975, 4025],
  ed4: [2000, 2500], ed5: [2000, 2500], ed6: [2000, 2500],
  ed7: [4250, 5750]
};

const want = process.argv.slice(2);
const ids = N.FILES.filter(function (id) {
  return fs.existsSync(path.join(dataDir, id + '.js')) && (!want.length || want.indexOf(id) >= 0);
});
ids.forEach(function (id) { require(path.join(dataDir, id + '.js')); });
const sc = N.scripts();

let bad = 0;
ids.forEach(function (id) {
  const n = N.countScript(sc[id]);
  const r = RANGE[id] || RANGE.ch;
  const ok = n >= r[0] && n <= r[1];
  if (!ok) bad++;
  console.log(id + '\t' + n + '\t' + (ok ? 'OK' : 'NG (' + r[0] + '-' + r[1] + ')'));
});
process.exitCode = bad ? 1 : 0;
