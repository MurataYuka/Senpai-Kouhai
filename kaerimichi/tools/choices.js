/* 全選択肢の文面を並べ、似ている組を一覧にする。
   使い方：node tools/choices.js [--similar 0.5] [--out choices.txt]
   似ている度合い：句読点などを除いた文面の 2 文字組の一致率（Dice 係数）。
   片方がもう片方を含む（4 字以上）ときも似ているとみなす。 */
'use strict';
const { Core, loaded, TOOLS, args, output } = require('./load');
const { opt } = args();
const out = output(opt);
const TH = opt.similar !== undefined ? Number(opt.similar) : TOOLS.similar;

const all = [];
for (const n of loaded) Core.files[n].code.forEach(ins => {
  if (ins.t === 'choice') ins.opts.forEach((o, i) => all.push({ file: n, id: ins.id, no: i + 1, line: ins.line, text: o.text, eff: o.eff, tags: o.tags }));
});

out.log('--- 選択肢一覧（' + all.length + ' 件）');
for (const c of all) {
  const eff = c.eff.map(e => e.v + e.op + e.n).concat(c.tags.map(t => '#' + t)).join(',') || '-';
  out.log(`${c.id}\t${c.no}\t${eff}\t${c.text}`);
}

const norm = s => s.replace(/\{name\}/g, '').replace(/[\s、。，．・…！？!?「」『』（）()▷―—]/g, '');
function bigrams(s) {
  const a = [...s], m = new Map();
  if (a.length < 2) { m.set(s, 1); return m; }
  for (let i = 0; i + 1 < a.length; i++) { const g = a[i] + a[i + 1]; m.set(g, (m.get(g) || 0) + 1); }
  return m;
}
function dice(a, b) {
  const A = bigrams(a), B = bigrams(b);
  let inter = 0, na = 0, nb = 0;
  for (const v of A.values()) na += v;
  for (const v of B.values()) nb += v;
  for (const [g, v] of A) if (B.has(g)) inter += Math.min(v, B.get(g));
  return na + nb ? 2 * inter / (na + nb) : 0;
}

const pairs = [];
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const a = norm(all[i].text), b = norm(all[j].text);
  if (!a || !b) continue;
  const d = dice(a, b);
  const contain = (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
  if (d >= TH || contain || a === b) pairs.push({ a: all[i], b: all[j], d, contain, same: a === b });
}
pairs.sort((x, y) => (y.same - x.same) || (y.d - x.d));
out.log('');
out.log('--- 似ている組（' + TH + ' 以上。' + pairs.length + ' 組）');
for (const p of pairs) {
  const where = p.a.id === p.b.id ? '同じ選択肢内' : p.a.file === p.b.file ? '同じ章' : '別の章';
  const why = p.same ? '同一' : p.contain ? '包含' : p.d.toFixed(2);
  out.log(`${why}\t${where}\t${p.a.id}#${p.a.no}「${p.a.text}」\t${p.b.id}#${p.b.no}「${p.b.text}」`);
}
out.log(`別の章どうしの組：${pairs.filter(p => p.a.file !== p.b.file).length} 組`);
out.done();
