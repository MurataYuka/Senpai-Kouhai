// 到達可能性の計算と、全エンディングのモデルルート自動テスト。node tools/test.js
const { C, loadData, mainParam } = require('./lib');
const D = loadData();
let fail = 0;
const ng = (m) => { fail++; console.log('  NG: ' + m); };

// ---------- 構造の点検 ----------
console.log('■ 構造');
const choiceList = [];
for (const id of C.ORDER.concat(C.ENDS)) {
  if (!D[id]) { ng(id + ' がありません'); continue; }
  const P = C.compile(D[id].src);
  const ch = P.ops.filter(o => o.t === 'choice');
  const want = id === 'ch15' ? 3 : (id.startsWith('ch') ? 2 : 0);
  if (ch.length !== want) ng(id + ' の選択肢が ' + ch.length + ' か所（想定 ' + want + '）');
  ch.forEach(op => {
    if (op.opts.length !== 3) ng(id + ' ' + op.id + ' が三択でない');
    if (id === 'ch15' && op.id === 'c3') {
      // 最終選択は加点なし。行き先 fa / fb / fc が揃っていること
      if (op.opts.map(o => o.to).sort().join() !== 'fa,fb,fc') ng('ch15 c3 の行き先が fa/fb/fc でない');
      op.opts.forEach(o => { if (Object.keys(o.eff.p).length) ng('ch15 c3 に加点がある'); });
      return;
    }
    const mains = op.opts.map(mainParam).sort().join();
    if (mains !== 'p1,p2,p3') ng(id + ' ' + op.id + ' の主パラメータが揃っていない：' + mains);
    op.opts.forEach(o => {
      if (!(o.to in P.labels)) ng(id + ' ' + op.id + ' 行き先なし ' + o.to);
      if (o.eff.p[mainParam(o)] !== 2) ng(id + ' ' + op.id + ' 主が+2でない');
    });
    choiceList.push({ id, op });
  });
  P.ops.forEach(o => {
    if ((o.t === 'go' || o.t === 'if') && !(o.to in P.labels)) ng(id + ' ラベルなし ' + o.to);
    if (o.t === 'ending' && (o.v === 'ed7' || o.v === 'ed8' || o.v === 'ed9')) ng('本編から ' + o.v + ' へ行く道がある');
  });
  if (!P.ops.some(o => o.t === 'title')) ng(id + ' に @title がない');
  if (id.startsWith('ed') && !P.ops.some(o => o.t === 'fin')) ng(id + ' に @fin がない');
}

// ---------- 各章時点での最大・最小 ----------
console.log('\n■ 各章末の最大・最小（p1 / p2 / p3）');
const acc = { p1: [0, 0], p2: [0, 0], p3: [0, 0] };
for (const id of C.ORDER) {
  choiceList.filter(c => c.id === id && !(id === 'ch15' && c.op.id === 'c3')).forEach(({ op }) => {
    for (const k of ['p1', 'p2', 'p3']) {
      const vals = op.opts.map(o => o.eff.p[k] || 0);
      acc[k][0] += Math.min(...vals); acc[k][1] += Math.max(...vals);
    }
  });
  console.log('  ' + id + '  p1 ' + acc.p1[0] + '〜' + acc.p1[1] + '  p2 ' + acc.p2[0] + '〜' + acc.p2[1] + '  p3 ' + acc.p3[0] + '〜' + acc.p3[1]);
}

// ---------- モデルルート ----------
function strat(order, over) {
  over = over || {};
  return (op, st) => {
    const key = st.cur + '.' + op.id;
    const want = over[key];
    if (want) {
      let k = op.opts.findIndex(o => o.to === want);
      if (k < 0) k = op.opts.findIndex(o => mainParam(o) === want);
      if (k >= 0) return k;
    }
    const pref = typeof order === 'function' ? order(st) : order;
    for (const p of pref) { const k = op.opts.findIndex(o => mainParam(o) === p); if (k >= 0) return k; }
    return 0;
  };
}
let rot = 0;
const routes = [
  { name: 'ED1 p1優先、最終 fa', want: 'ed1', pick: strat(['p1'], { 'ch15.c3': 'fa' }) },
  { name: 'ED2 p2優先、ch14c1 は p3、最終 fb', want: 'ed2', pick: strat(['p2'], { 'ch14.c1': 'p3', 'ch15.c3': 'fb' }) },
  { name: 'ED3 p3優先、ch10c1 は p2、最終 fc', want: 'ed3', pick: strat(['p3'], { 'ch10.c1': 'p2', 'ch15.c3': 'fc' }) },
  { name: 'ED4 p2優先、ch10c1 は p3', want: 'ed4', pick: strat(['p2'], { 'ch10.c1': 'p3' }) },
  { name: 'ED5 p1優先、最終 fb', want: 'ed5', pick: strat(['p1'], { 'ch15.c3': 'fb' }) },
  { name: 'ED6 p2優先、ch14c1 は p2', want: 'ed6', pick: strat(['p2'], { 'ch14.c1': 'p2' }) },
  { name: 'ED1 p1→p2→p3 の順に均等、最終 fa', want: 'ed1', pick: (op, st) => op.id === 'c3' && st.cur === 'ch15' ? op.opts.findIndex(o => o.to === 'fa') : strat([['p1', 'p2', 'p3'][rot++ % 3]], { 'ch14.c1': 'p1' })(op, st) },
];
console.log('\n■ モデルルート');
for (const r of routes) {
  rot = 0;
  try {
    const res = C.runHeadless(D, r.pick);
    const ok = res.ending === r.want;
    if (!ok) fail++;
    console.log('  ' + (ok ? 'OK' : 'NG') + '  ' + r.name + ' → ' + res.ending + '  (p1 ' + res.state.p.p1 + ', p2 ' + res.state.p.p2 + ', p3 ' + res.state.p.p3 + ', f1 ' + (res.state.f.f1 ? 1 : 0) + ')');
    console.log('      選び方: ' + res.trace.map(t => t.cur.slice(2) + t.id + '=' + (t.k + 1)).join(' '));
  } catch (e) { ng(r.name + ' : ' + e.message); }
}

// ---------- 無作為プレイ ----------
console.log('\n■ 無作為プレイ 20000 回の到達分布');
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const dist = {};
for (let i = 0; i < 20000; i++) {
  const res = C.runHeadless(D, (op) => Math.floor(rnd() * op.opts.length));
  dist[res.ending] = (dist[res.ending] || 0) + 1;
}
for (const k of C.ENDS) console.log('  ' + k + ': ' + (dist[k] || 0));

// ---------- 一覧の解放条件 ----------
console.log('\n■ エンディング一覧の解放条件');
function openOf(ends, id) { return C.galleryState(ends).find(g => g.id === id).open; }
function endsOf(list) { const e = {}; list.forEach(k => { e[k] = 1; }); return e; }
const six = ['ed1', 'ed2', 'ed3', 'ed4', 'ed5', 'ed6'];
const seven = six.concat(['ed7']);
const cases = [
  ['何も回収していない：ed7・ed8・ed9 とも未解放', endsOf([]), { ed7: false, ed8: false, ed9: false }],
  ['ed1〜ed6 回収：ed7 解放・ed8・ed9 未解放', endsOf(six), { ed7: true, ed8: false, ed9: false }],
  ['ed1〜ed7 回収：ed8・ed9 解放', endsOf(seven), { ed7: true, ed8: true, ed9: true }],
  ['ed8 を見ていなくても ed1〜ed7 回収なら ed9 解放', endsOf(seven), { ed9: true }],
];
seven.forEach(k => cases.push(['ed1〜ed7 のうち ' + k + ' だけ未回収：ed8・ed9 未解放', endsOf(seven.filter(x => x !== k)), { ed8: false, ed9: false }]));
cases.forEach(([name, e, want]) => {
  const ok = Object.keys(want).every(k => openOf(e, k) === want[k]);
  if (!ok) fail++;
  console.log('  ' + (ok ? 'OK' : 'NG') + '  ' + name);
});
const gs = C.galleryState({});
const listOk = gs.length === 9 && gs.map(g => g.id).join() === C.ENDS.join() && gs.every(g => !g.open);
if (!listOk) fail++;
console.log('  ' + (listOk ? 'OK' : 'NG') + '  一覧は ed1〜ed9 の9行で（ed9 は ed8 の下）、未解放はすべて「？？？」表示（open=false）');

// ---------- ご褒美 ----------
console.log('\n■ ed7・ed8・ed9：本編の判定に絡まない（上の構造点検で本編からの道がないことを確認）');
['ed7', 'ed8', 'ed9'].forEach(k => { try { C.compile(D[k].src); console.log('  ' + k + ' の読み込み OK'); } catch (e) { ng(k + ' ' + e.message); } });

console.log(fail ? '\n失敗 ' + fail + ' 件' : '\nすべて OK');
process.exitCode = fail ? 1 : 0;
