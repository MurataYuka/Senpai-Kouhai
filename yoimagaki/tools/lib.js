// 点検ツール共通：データファイルを読み込む
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('../js/core.js');

const ROOT = path.join(__dirname, '..');

function loadData() {
  const ctx = { YOI_DATA: {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  const dir = path.join(ROOT, 'data');
  fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });
  return ctx.YOI_DATA;
}

function textLen(s) {
  return s.replace(/\{name\}/g, 'あまね').replace(/[\s　]/g, '').length;
}

// 選択肢の主パラメータ（+2 のもの）
function mainParam(o) {
  let best = null, v = -1;
  for (const k of Object.keys(o.eff.p)) if (o.eff.p[k] > v) { v = o.eff.p[k]; best = k; }
  return best;
}

module.exports = { C, ROOT, loadData, textLen, mainParam };
