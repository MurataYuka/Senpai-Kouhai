// 全章の選択肢を一覧に書き出し、並び順の偏りと文面の被りを調べる。node tools/choices.js
const { C, loadData, mainParam } = require('./lib');
const D = loadData();
const all = [];
const posCount = { p1: [0, 0, 0], p2: [0, 0, 0], p3: [0, 0, 0] };
const seq = [];
for (const id of C.ORDER) {
  if (!D[id]) continue;
  const P = C.compile(D[id].src);
  for (const op of P.ops) {
    if (op.t !== 'choice') continue;
    console.log('\n[' + id + ' ' + op.id + ']');
    const order = [];
    op.opts.forEach((o, k) => {
      const m = mainParam(o);
      order.push(m);
      if (posCount[m]) posCount[m][k]++;
      const eff = Object.keys(o.eff.p).map(x => x + '+' + o.eff.p[x]).concat(o.eff.f).join(' ');
      console.log('  ' + (k + 1) + '. ' + o.s + '　〔' + eff + '〕');
      all.push({ id, cid: op.id, s: o.s });
    });
    seq.push(order.join(' '));
  }
}

console.log('\n■ 並び順：各パラメータが何番目に出たか（1番目,2番目,3番目）');
for (const k of Object.keys(posCount)) console.log('  ' + k + ': ' + posCount[k].join(', '));
let run = 0, maxRun = 0;
for (let i = 1; i < seq.length; i++) { run = seq[i] === seq[i - 1] ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
console.log('  同じ並びの連続：最大 ' + (maxRun + 1) + ' 回');

// 文面の被り：文字の2-gram の重なり（別の章同士）
function grams(s) {
  s = s.replace(/[▷、。…「」『』・\s　]/g, '').replace(/\{name\}/g, '');
  const g = new Set();
  for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
  return g;
}
const G = all.map(a => grams(a.s));
const hits = [];
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    if (all[i].id === all[j].id) continue;
    let inter = 0;
    G[i].forEach(x => { if (G[j].has(x)) inter++; });
    const sim = inter / Math.min(G[i].size, G[j].size || 1);
    if (sim >= 0.34) hits.push({ sim, a: all[i], b: all[j] });
  }
}
hits.sort((x, y) => y.sim - x.sim);
console.log('\n■ 文面の近い組（別の章同士、重なり34%以上）：' + hits.length + '組');
hits.slice(0, 40).forEach(h => console.log('  ' + h.sim.toFixed(2) + '  ' + h.a.id + ' ' + h.a.s + '\n        ' + h.b.id + ' ' + h.b.s));
