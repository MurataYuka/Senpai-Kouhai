// 分岐から合流する継ぎ目を、選択肢ごとに「分岐の文→合流後の文」の順で書き出す。
// node tools/seams.js ch01 [合流後に出す行数]
const { C, loadData } = require('./lib');
const D = loadData();
const id = process.argv[2];
const after = parseInt(process.argv[3] || '6', 10);
const P = C.compile(D[id].src);

function condStr(c) {
  return c.map(x => x.k === 'p' ? x.v + x.op + x.n : (x.neg ? '!' : '') + x.v).join(' ');
}

let seams = 0;
P.ops.forEach((op, idx) => {
  if (op.t !== 'choice') return;
  console.log('\n==================== ' + id + ' ' + op.id + ' ====================');
  op.opts.forEach((o, k) => {
    seams++;
    console.log('\n--- [' + (k + 1) + '] ' + o.s);
    let pc = P.labels[o.to];
    let merged = false, count = 0, guard = 0;
    while (guard++ < 2000) {
      const x = P.ops[pc];
      if (!x) { console.log('  <<終端>>'); break; }
      if (x.t === 'go') {
        if (merged) break;
        console.log('  ======== 合流 → ' + x.to + ' ========');
        merged = true; pc = P.labels[x.to]; continue;
      }
      if (x.t === 'if') { console.log('  <<条件分岐 ' + condStr(x.cond) + ' → ' + x.to + '>>'); pc++; continue; }
      if (x.t === 'choice' || x.t === 'next' || x.t === 'ending' || x.t === 'fin') { console.log('  <<' + x.t + '>>'); break; }
      if (x.t === 'text') {
        console.log((merged ? '  合| ' : '  分| ') + (x.cond ? '[' + condStr(x.cond) + '] ' : '') + x.s);
        if (merged && ++count >= after) break;
      }
      if (x.t === 'page') console.log(merged ? '  合| ---' : '  分| ---');
      pc++;
    }
  });
});
console.log('\n継ぎ目 ' + seams + ' 箇所');
