/* tests/route_*.js をすべて実行して結果をまとめる：node tests/run_all.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { Core } = require('./lib');

const files = fs.readdirSync(__dirname).filter(f => /^route_.+\.js$/.test(f)).sort();
let pass = 0;
for (const f of files) {
  try { if (require(path.join(__dirname, f))()) pass++; }
  catch (e) { console.log('失敗  ' + f + '  ' + e.message); }
}
// ルートの無いエンディングも知らせる
const covered = new Set(files.map(f => f.replace(/^route_|\.js$/g, '')));
const lack = Core.allEnds().filter(e => !covered.has(e));
if (lack.length) console.log('ルートの無いエンディング：' + lack.join(', '));
console.log(`到達テスト：${pass}/${files.length} 通過`);
process.exitCode = (pass === files.length && !lack.length) ? 0 : 1;
