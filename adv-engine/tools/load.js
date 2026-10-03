/* node 用：設定・エンジン・シナリオを読み込む（点検スクリプトとテストの共通部品） */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
globalThis.window = globalThis;

function fail(msg) {
  console.error('読み込みエラー: ' + msg);
  process.exit(2);
}

try {
  require(path.join(ROOT, 'game', 'config.js'));
} catch (e) { fail('game/config.js: ' + e.message); }
const Core = require(path.join(ROOT, 'engine', 'core.js'));
const errs = Core.checkConfig();
if (errs.length) fail(errs.join(' / '));

const CFG = globalThis.ADV_CONFIG;
const loaded = [];
for (const n of CFG.files) {
  const f = path.join(ROOT, 'game', 'scenario', n + '.js');
  if (!fs.existsSync(f)) fail('ファイルがありません: game/scenario/' + n + '.js');
  try { require(f); } catch (e) { fail(n + ': ' + e.message); }
  if (!Core.files[n]) fail(n + '.js の中で ADV.add(\'' + n + '\', ...) が呼ばれていません');
  // 行番号をファイルの行番号に合わせる（ADV.add の前に行があっても合うように）
  const off = fs.readFileSync(f, 'utf8').split(/\r?\n/).findIndex(l => l.includes('ADV.add('));
  if (off > 0) Core.files[n].code.forEach(ins => { if (ins.line) ins.line += off; });
  loaded.push(n);
}
const recFile = path.join(ROOT, 'game', 'scenario', ((CFG.records && CFG.records.file) || 'records') + '.js');
if (fs.existsSync(recFile)) { try { require(recFile); } catch (e) { fail('records: ' + e.message); } }

const TOOLS = Object.assign({ targets: {}, toneWords: [], similar: 0.5, maxStates: 200000 }, CFG.tools || {});
TOOLS.targets = Object.assign({ main: 7000, ending: 3500, extra: 6000, tolerance: 0.15 }, TOOLS.targets);

/* 引数の解析：--out ファイル で結果を UTF-8 で書き出す。それ以外は位置引数 */
function args() {
  const a = process.argv.slice(2), pos = [], opt = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      if (i + 1 < a.length && !a[i + 1].startsWith('--')) opt[k] = a[++i]; else opt[k] = true;
    } else pos.push(a[i]);
  }
  return { pos, opt };
}

function output(opt) {
  const buf = [];
  return {
    log: (s = '') => { buf.push(s); if (!opt.out) console.log(s); },
    done: () => { if (opt.out) { fs.writeFileSync(opt.out, buf.join('\n') + '\n', 'utf8'); console.log('書き出し: ' + opt.out + '（' + buf.length + ' 行）'); } }
  };
}

/* 本文の行を集める：[{ f, line, s, pc }] */
function texts(names) {
  const out = [];
  for (const n of names || loaded) {
    Core.files[n].code.forEach((ins, pc) => { if (ins.t === 'text') out.push({ f: n, pc, line: ins.line, s: ins.s }); });
  }
  return out;
}

module.exports = { Core, CFG, TOOLS, ROOT, loaded, args, output, texts };
