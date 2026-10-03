/* 文字数（空白を除く）と目標との比較。
   使い方：node tools/count.js [ファイル名…] [--main 7000] [--ending 3500] [--extra 6000] [--gameover 1500] [--tolerance 0.15]
   目標値の初期値は game/config.js の tools.targets。本文の行と選択肢の文面を数える（{name} は 2 字）。
   ゲームオーバー（任意機能）のファイルは、版Aと版Bを別々に報告する */
'use strict';
const { Core, loaded, TOOLS, args, output } = require('./load');
const { pos, opt } = args();
const out = output(opt);
const T = Object.assign({}, TOOLS.targets);
for (const k of ['main', 'ending', 'extra', 'gameover', 'tolerance']) if (opt[k] !== undefined) T[k] = Number(opt[k]);
const LABEL = { main: '本編', ending: 'エンディング', extra: '追加エンディング', gameover: 'ゲームオーバー' };

let bad = 0, total = 0;
const goSum = { a: { n: 0, c: 0, bad: 0 }, b: { n: 0, c: 0, bad: 0 } };
for (const n of loaded) {
  if (pos.length && !pos.includes(n)) continue;
  const kind = Core.kind(n);
  const go = kind === 'gameover' ? Core.overOf(n) : null;
  const c = Core.countText(n), t = T[kind];
  const lo = Math.round(t * (1 - T.tolerance)), hi = Math.round(t * (1 + T.tolerance));
  const ok = c >= lo && c <= hi;
  if (!ok) bad++;
  total += c;
  if (go) { goSum[go.ver].n++; goSum[go.ver].c += c; if (!ok) goSum[go.ver].bad++; }
  const label = go ? LABEL[kind] + ' ' + go.id + ' 版' + go.ver.toUpperCase() : LABEL[kind];
  out.log(`${n}\t${label}\t${c}字\t目標${t}（${lo}〜${hi}）\t${ok ? 'OK' : (c < lo ? '不足 ' + (lo - c) + '字' : '超過 ' + (c - hi) + '字')}`);
}
for (const v of ['a', 'b']) {
  const s = goSum[v];
  if (s.n) out.log(`ゲームオーバー版${v.toUpperCase()}：${s.n}件　計 ${s.c}字　範囲外 ${s.bad}件`);
}
out.log(`合計 ${total}字　範囲外 ${bad}件`);
out.done();
process.exitCode = bad ? 1 : 0;
