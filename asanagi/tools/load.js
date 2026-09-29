/* node 用：本体とデータを読み込む */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const Core = require(path.join(ROOT, 'js', 'core.js'));
globalThis.ASANAGI = Core;
globalThis.window = globalThis.window || {};
const NAMES = [];
for (let i = 1; i <= 15; i++) NAMES.push('ch' + String(i).padStart(2, '0'));
for (let i = 1; i <= 8; i++) NAMES.push('ed' + String(i).padStart(2, '0'));
const loaded = [];
for (const n of NAMES) {
  const f = path.join(ROOT, 'data', n + '.js');
  if (fs.existsSync(f)) { require(f); loaded.push(n); }
}
module.exports = { Core, NAMES, loaded, ROOT };
