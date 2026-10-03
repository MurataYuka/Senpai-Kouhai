/* 締めの文の一覧：node tools/closers.js [--n 2]
   ゲームオーバー・エンディング・各章の最後の文（@over / @end / @next の直前の n 行）と、
   山場（@vis pov s の場面の最後）の文を並べ、締めに使われた言い回しの重なりを数える。 */
'use strict';
const { Core, loaded, args, output } = require('./load');
const { opt } = args();
const out = output(opt);
const N = Number(opt.n || 2);

const rows = [];
for (const n of loaded) {
  const code = Core.files[n].code;
  const texts = [];
  for (let i = 0; i < code.length; i++) {
    const ins = code[i];
    if (ins.t === 'text') texts.push(ins.s);
    const cmd = ins.t === 'cmd' ? ins.cmd : '';
    const end = cmd === 'over' || cmd === 'end' || cmd === 'next' || (cmd === 'goto' && /^ed/.test(ins.arg));
    const povOff = cmd === 'vis' && /^pov\s+off/.test(ins.arg) && texts.length;
    if ((end || povOff) && texts.length) {
      rows.push({ n, kind: end ? '締め' : '目線の場面の締め', lines: texts.slice(-N) });
    }
    if (ins.t === 'choice' || end || povOff) texts.length = 0;
  }
}
for (const r of rows) {
  out.log(`--- ${r.n}（${r.kind}）`);
  for (const l of r.lines) out.log('  ' + l);
}
// 言い回しの重なり：締めの文の末尾 8 文字
const tail = {};
for (const r of rows) for (const l of r.lines) {
  const k = l.replace(/[。、」』\s]/g, '').slice(-8);
  (tail[k] = tail[k] || []).push(r.n);
}
out.log('--- 締めの文の末尾が重なっているもの');
let dup = 0;
for (const k in tail) if (tail[k].length > 1) { dup++; out.log(`  …${k}　${tail[k].join(', ')}`); }
out.log(`締めの文 ${rows.length} 箇所、末尾の重なり ${dup} 組`);
out.done();
