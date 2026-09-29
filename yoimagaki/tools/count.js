// 本文の文字数を数える。node tools/count.js [id...]
const { C, loadData, textLen } = require('./lib');
const D = loadData();
const ids = process.argv.slice(2).length ? process.argv.slice(2) : C.ORDER.concat(C.ENDS);
let total = 0;
for (const id of ids) {
  if (!D[id]) { console.log(id + '\t(未作成)'); continue; }
  const P = C.compile(D[id].src);
  let n = 0;
  for (const op of P.ops) {
    if (op.t === 'text') n += textLen(op.s);
    if (op.t === 'choice') op.opts.forEach(o => { n += textLen(o.s); });
  }
  const target = (id === 'ed8' || id === 'ed9') ? 6000 : (id.startsWith('ed') ? 3500 : 7000);
  const lo = Math.round(target * 0.85), hi = Math.round(target * 1.15);
  const ok = n >= lo && n <= hi;
  total += n;
  console.log(`${id}\t${n}字\t目標${lo}〜${hi}\t${ok ? 'OK' : (n < lo ? '不足' : '超過')}`);
}
console.log('合計\t' + total + '字');
