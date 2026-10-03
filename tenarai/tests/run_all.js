/* tests/route_*.js と tests/over_*.js をすべて実行して結果をまとめる：node tests/run_all.js
   ゲームオーバー機能がオフのときは、ゲームオーバーのテストは「省略」になる */
'use strict';
const fs = require('fs');
const path = require('path');
const { Core } = require('./lib');

const files = fs.readdirSync(__dirname).filter(f => /^(route|over)_.+\.js$/.test(f)).sort();
let pass = 0, skip = 0;
const goCovered = new Set();
for (const f of files) {
  try {
    const m = require(path.join(__dirname, f));
    const r = m();
    if (r === null) skip++;
    else if (r) pass++;
    if (r && m.spec && m.spec.go) goCovered.add(m.spec.go);
  } catch (e) { console.log('失敗  ' + f + '  ' + e.message); }
}
// ルートの無いエンディング・ゲームオーバーも知らせる
const covered = new Set(files.map(f => f.replace(/^route_|\.js$/g, '')));
const lack = Core.allEnds().filter(e => !covered.has(e));
if (lack.length) console.log('ルートの無いエンディング：' + lack.join(', '));
const goLack = Core.overIds().filter(id => !goCovered.has(id));
if (goLack.length) console.log('ルートの無いゲームオーバー：' + goLack.join(', '));
const run = files.length - skip;
console.log(`到達テスト：${pass}/${run} 通過${skip ? '（省略 ' + skip + '）' : ''}`);
process.exitCode = (pass === run && !lack.length && !goLack.length) ? 0 : 1;
