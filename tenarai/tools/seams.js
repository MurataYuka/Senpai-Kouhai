/* 継ぎ目の書き出し：選択肢と条件分岐ごとに「分岐の文 → 合流後の文」を並べる。
   使い方：node tools/seams.js [ファイル名…] [--before 3] [--after 4] [--out seams.txt]
   ファイル名を省くと全ファイル。ファイルをまたぐ合流（両方が @next ch02 に行く等）も見つける。 */
'use strict';
const { Core, loaded, args, output } = require('./load');
const { pos, opt } = args();
const BEFORE = Number(opt.before || 3), AFTER = Number(opt.after || 4);
const out = output(opt);
const names = pos.length ? pos : loaded;
for (const n of names) if (!Core.files[n]) { console.error('ファイルがありません: ' + n); process.exit(1); }

const key = (f, pc) => f + ':' + pc;

/* 分岐の入口から、次の選択肢・エンディング・ゲームオーバー・行き止まりまでたどる（条件分岐は両方の可能性があるので真の側を代表にする） */
function walk(file, pc) {
  const seq = [];
  for (let g = 0; g < 3000; g++) {
    const ins = Core.files[file].code[pc];
    if (!ins) break;
    seq.push({ file, pc, k: key(file, pc) });
    if (ins.t === 'jmp') { pc = ins.to; continue; }
    if (ins.t === 'jf') { pc = pc + 1; continue; }
    if (ins.t === 'choice') break;
    if (ins.t === 'cmd' && (ins.cmd === 'goto' || ins.cmd === 'next')) {
      let r;
      try { r = Core.resolve(ins.arg, file); } catch (e) { break; }
      file = r.file; pc = r.pc; continue;
    }
    if (ins.t === 'cmd' && (ins.cmd === 'end' || ins.cmd === 'eof' || ins.cmd === 'gameover' || ins.cmd === 'over')) break;
    pc++;
  }
  return seq;
}

function show(p) {
  const ins = Core.files[p.file].code[p.pc];
  const at = p.file + ' 行' + ins.line;
  if (ins.t === 'text') return at + '  ' + ins.s;
  if (ins.t === 'choice') return at + '  [選択肢 ' + ins.id + ']';
  if (ins.t === 'cmd' && (ins.cmd === 'goto' || ins.cmd === 'next')) return at + '  [→ ' + ins.arg + ']';
  if (ins.t === 'cmd' && ins.cmd === 'end') return at + '  [エンディング ' + ins.arg + ']';
  if (ins.t === 'cmd' && ins.cmd === 'gameover') return at + '  [ゲームオーバー ' + ins.go + ' 版' + ins.ver.toUpperCase() + ']';
  if (ins.t === 'cmd' && ins.cmd === 'over') return at + '  [@over]';
  if (ins.t === 'cmd' && ins.cmd === 'altopen') return at + '  [@altopen]';
  if (ins.t === 'cmd' && ins.cmd === 'set') return at + '  [@set ' + ins.arg + ']';
  if (ins.t === 'jf') return at + '  [@if ' + ins.cond + ' … 別の継ぎ目として点検]';
  return null;
}

let count = 0, noJoin = 0;
function seam(label, starts, labels) {
  const walks = starts.map(s => walk(s.file, s.pc));
  let join = null;
  for (const p of walks[0]) if (walks.every(w => w.some(q => q.k === p.k))) { join = p.k; break; }
  count++;
  if (!join) noJoin++;
  const jp = join && walks[0].find(q => q.k === join);
  out.log('==== ' + label + '　合流: ' + (jp ? jp.file + ' 行' + Core.files[jp.file].code[jp.pc].line : 'なし（行き先が分かれたまま）'));
  walks.forEach((w, i) => {
    out.log('--- ' + labels[i]);
    const cut = join ? w.findIndex(q => q.k === join) : w.length;
    const pre = w.slice(0, cut).map(show).filter(Boolean);
    let post = join ? w.slice(cut).map(show).filter(Boolean) : [];
    // 合流後に次の条件分岐が来たら、その先は分岐ごとに違うので出さない
    const stop = post.findIndex(s => s.includes('[@if '));
    if (stop >= 0) post = post.slice(0, stop + 1);
    if (pre.length > BEFORE) out.log('  | …');
    pre.slice(-BEFORE).forEach(s => out.log('  | ' + s));
    if (!pre.length) out.log('  | （分岐の文なし）');
    if (join) {
      out.log('  ==合流==');
      post.slice(0, AFTER).forEach(s => out.log('  > ' + s));
    }
  });
  out.log('');
}

for (const n of names) {
  Core.files[n].code.forEach((ins, pc) => {
    if (ins.t === 'choice') {
      seam(ins.id + '（' + n + ' 行' + ins.line + '）',
        ins.opts.map(o => Core.resolve(o.target, n)),
        ins.opts.map((o, i) => (i + 1) + '. ' + o.text + '  {' + o.eff.map(e => e.v + e.op + e.n).concat(o.tags.map(t => '#' + t)).join(',') + '}'));
    } else if (ins.t === 'jf') {
      seam('@if ' + ins.cond + '（' + n + ' 行' + ins.line + '）', [{ file: n, pc: pc + 1 }, { file: n, pc: ins.to }], ['真', '偽']);
    }
  });
}
out.log('継ぎ目 ' + count + ' 箇所（うち合流しないもの ' + noJoin + ' 箇所）');
out.done();
