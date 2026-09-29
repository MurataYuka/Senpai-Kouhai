/* 継ぎ目の書き出し：選択肢と条件分岐ごとに「分岐の文 → 合流後の文」を並べる */
'use strict';
const { Core } = require('./load');
const name = process.argv[2];
const AFTER = Number(process.argv[3] || 4), BEFORE = Number(process.argv[4] || 3);
const F = Core.files[name];
if (!F) { console.error('no file', name); process.exit(1); }
const code = F.code;

function walk(pc) {
  const seq = [];
  for (let g = 0; g < 2000; g++) {
    const ins = code[pc];
    if (!ins) break;
    seq.push(pc);
    if (ins.t === 'jmp') { pc = ins.to; continue; }
    if (ins.t === 'jf') { pc = pc + 1; continue; }
    if (ins.t === 'choice') break;
    if (ins.t === 'cmd' && ins.cmd === 'next') break;
    if (ins.t === 'cmd' && ins.cmd === 'goto') {
      let r;
      try { r = Core.resolve(ins.arg, name); } catch (e) { break; }
      if (r.file !== name) break;
      pc = r.pc; continue;
    }
    if (ins.t === 'cmd' && (ins.cmd === 'end' || ins.cmd === 'eof')) break;
    pc++;
  }
  return seq;
}
function show(pc) {
  const ins = code[pc];
  if (ins.t === 'text') return (ins.tint ? '~' : '') + ins.s;
  if (ins.t === 'choice') return '[選択肢 ' + ins.id + ']';
  if (ins.t === 'cmd' && (ins.cmd === 'goto' || ins.cmd === 'next')) return '[→ ' + ins.arg + ']';
  if (ins.t === 'cmd' && ins.cmd === 'end') return '[END ' + ins.arg + ']';
  return null;
}
function seam(label, starts, names) {
  const walks = starts.map(walk);
  let join = -1;
  for (const pc of walks[0]) if (walks.every(w => w.includes(pc))) { join = pc; break; }
  console.log('==== ' + label + '  合流: ' + (join < 0 ? 'なし' : 'pc' + join));
  walks.forEach((w, i) => {
    console.log('--- ' + names[i]);
    const cut = join < 0 ? w.length : w.indexOf(join);
    const pre = w.slice(0, cut).map(show).filter(Boolean);
    const post = join < 0 ? [] : w.slice(cut).map(show).filter(Boolean);
    pre.slice(-BEFORE).forEach(s => console.log('  | ' + s));
    console.log('  ==合流==');
    post.slice(0, AFTER).forEach(s => console.log('  > ' + s));
  });
  return 1;
}
let n = 0;
code.forEach((ins, pc) => {
  if (ins.t === 'choice') {
    n += seam(ins.id, ins.opts.map(o => Core.resolve(o.target, name).pc), ins.opts.map(o => o.text + ' {' + o.eff.map(e => e.v + e.op + e.n).join(',') + '}'));
  } else if (ins.t === 'jf') {
    n += seam('@if ' + ins.cond + ' (行' + ins.line + ')', [pc + 1, ins.to], ['真', '偽']);
  }
});
console.log('\n継ぎ目 ' + n + ' 箇所');
