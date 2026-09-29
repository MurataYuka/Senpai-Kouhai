#!/usr/bin/env node
/* 本文の文字数を数える。  node tests/count.js
 * - 章ごと：その章のファイルに書かれた表示文（地の文・台詞・選択肢の文言）の合計。
 *   記号の書式（先頭の ! ~ @、[[ ]]）・改行・空白・区切りの '---' は数えない。{n} は既定の名前で数える。
 * - 結末：routes.json のモデルルートを流し、最後の分岐（q18 / q19）を選んだ直後から終わりまでに表示される文。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SCN = path.join(ROOT, 'js', 'scenario');
const ctx = { console };
vm.createContext(ctx);
const chs = fs.readdirSync(SCN).filter((f) => /^ch\d\d\.js$/.test(f)).sort();
['js/core.js', 'js/scenario/meta.js'].concat(chs.map((f) => 'js/scenario/' + f))
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const { Core, SZ } = ctx;
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'secret', 'routes.json'), 'utf8'));

function len(s) {
  if (s === '---') return 0;
  const p = Core.parseLine(s);
  const t = String(p.s).replace(/\{n\}/g, SZ.meta.defName).replace(/\[\[|\]\]/g, '').replace(/\s/g, '');
  return Array.from(t).length;
}

// 章ごとの合計（その章に属するシーン＝ id が chNN_ で始まるもの）
const per = {};
for (const id of Object.keys(SZ.sc)) {
  const ch = id.slice(0, 4);
  per[ch] = per[ch] || 0;
  for (const c of SZ.sc[id]) {
    if (typeof c === 'string') per[ch] += len(c);
    else if (c && c.q) per[ch] += c.opts.reduce((a, o) => a + len(o.t), 0);
  }
}
const ids = Object.keys(per).sort();
const avg = ids.reduce((a, k) => a + per[k], 0) / ids.length;
ids.forEach((k) => console.log(k + ' ' + per[k]));
console.log('avg ' + Math.round(avg));

// 結末の長さ（モデルルート上）
const base = +process.argv[2] || avg;
for (const r of spec.routes) {
  if (!/^end_0[156]$/.test(r.expect)) continue;
  const picks = Object.assign({}, spec.defaults);
  r.picks.split(/\s+/).forEach((t) => (picks[t.slice(0, 3)] = t[3]));
  const st = Core.fresh(SZ.meta.defName);
  let on = false, n = 0;
  for (let g = 0; g < 50000; g++) {
    const ev = Core.step(st);
    if (ev.t === 'q') {
      const o = ev.opts.find((x) => x.k === (picks[ev.id] || 'a'));
      const label = Core.choose(st, o.n);
      if (on) n += len(label);
      if (ev.id === 'q18' || ev.id === 'q19') on = true;
      continue;
    }
    if (ev.t === 'ln' && on) n += len(ev.k === 'b' ? ev.s : (ev.k === 'c' ? '!' : ev.k === 'd' ? '~' : ev.k === 'e' ? '@ ' : '') + ev.s);
    if (ev.t === 'end' || ev.t === 'dead' || ev.t === 'miss' || ev.t === 'err') break;
  }
  console.log(r.expect + ' ' + n + ' (' + (n / base * 100).toFixed(1) + '%)');
}
