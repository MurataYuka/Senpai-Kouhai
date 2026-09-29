// 到達テスト・並び順の確認・シミュレーション。node tools/test.js [回数]
const { load } = require('./lib');
const SN = load();
let ALL = 0;
SN.glob = () => ({ all: ALL });

// 表示順（データ順）の、設計書での呼び名
const ORDER = {
  c0101: ['C', 'A', 'B'], c0102: ['R', 'B', 'A'], c0201: ['A', 'C', 'B'], c0202: ['C', 'B', 'A'],
  c0301: ['R', 'N1', 'N2'], c0302: ['A', 'C', 'B'], c0401: ['C', 'B', 'A'], c0402: ['N', 'A', 'C'],
  c0501: ['B', 'C', 'R'], c0502: ['C', 'A', 'B'], c0601: ['A', 'C', 'B'], c0602: ['B', 'A', 'C'],
  c0701: ['C', 'B', 'A'], c0702: ['B', 'A', 'C'], c0801: ['C', 'R', 'A'], c0802: ['B', 'C', 'A'],
  c0901: ['B', 'A', 'N'], c0902: ['C', 'A', 'B'], c1001: ['N', 'A', 'R'], c1002: ['B', 'A', 'C'],
  c1101: ['C', 'B', 'A'], c1102: ['A', 'C', 'B'], c1201: ['B', 'C', 'A'], c1202: ['C', 'A', 'B'],
  c1301: ['A', 'R', 'N'], c1302: ['C', 'A', 'B'], c1401: ['B', 'C', 'A'], c1402: ['B', 'D', 'A'],
  c1501: ['X2', 'X4', 'X1', 'X3', 'X5', 'X6'],
};
// 設計書の効果（表示順）。分岐の中で掛かるもの（13-1R）は空。
const FX = {
  c0101: ['p3+5', 'p1+5', 'p2+5'], c0102: ['p4+10', 'p2+5', 'p1+3'],
  c0201: ['p1+5', 'p3+5', 'p2+5'], c0202: ['p3+5', 'p2+5', 'p1+5'],
  c0301: ['p4+10,m1=2', 'p4+5,m1=1', 'p4+5,m1=3'], c0302: ['p1+7', 'p3+7', 'p2+7'],
  c0401: ['p3+7', 'p2+7', 'p1+7'], c0402: ['', 'p1+5', 'p3+5'],
  c0501: ['p2+7', 'p3+7', 'p1+3,p4+5'], c0502: ['p3+7,w1=3', 'p1+7,w1=1', 'p2+7,w1=2'],
  c0601: ['p1+5', 'p3+7', 'p2+5'], c0602: ['p2+7', 'p1+7', 'p3+7'],
  c0701: ['p3+8,p4+5,w2=3', 'p2+8,w2=2', 'p1+10,f1=1,w2=1'], c0702: ['p2+7', 'p1+5', 'p3+7'],
  c0801: ['p3+7', 'p2+5,p4+8', 'p1+7'], c0802: ['p2+7', 'p3+7', 'p1+7'],
  c0901: ['p2+5', '', 'p1+3'], c0902: ['p3+5,w3=3', 'p1+7,w3=1', 'p2+7,w3=2'],
  c1001: ['p1+3', '', 'p4+8'], c1002: ['p2+7', 'p1+7', 'p3+7'],
  c1101: ['p3+7', 'p2+8', 'p1+5,p2+3'], c1102: ['p1+7', 'p3+7', 'p2+8'],
  c1201: ['p2+8,f3=1,m2=2', 'p3+5,p1+3,m2=3', 'p1+8,m2=1'], c1202: ['p3+7', 'p1+7', 'p2+7'],
  c1301: ['', '', 'p1+5'], c1302: ['p3+7', 'p1+7', 'p2+7'],
  c1401: ['p2+7,m3=1', 'p3+7,p4+5,m3=2', 'p1+5,m3=1'], c1402: ['p2+5', 'f4=1', 'p1+5,p4+5'],
  c1501: ['r1=2', 'r1=4', 'r1=1', 'r1=3', 'r1=5', 'r1=6'],
};

let fail = 0;
const chOps = {};
SN.prog.forEach((op) => { if (op.t === 'ch') chOps[op.id] = op; });
// 並び順と効果の照合
Object.keys(ORDER).forEach((id) => {
  const op = chOps[id];
  if (!op) { console.log('選択肢がない: ' + id); fail++; return; }
  if (op.opts.length !== ORDER[id].length) { console.log('数が違う: ' + id); fail++; return; }
  op.opts.forEach((o, i) => {
    const got = o.fx.replace(/\s/g, '');
    if (got !== FX[id][i]) { console.log('効果が違う: ' + id + '[' + i + '] ' + got + ' / ' + FX[id][i]); fail++; }
  });
});
Object.keys(chOps).forEach((id) => { if (!ORDER[id]) { console.log('表にない選択肢: ' + id); fail++; } });
console.log('並び順と効果の照合：' + (fail ? '不一致 ' + fail : '全' + Object.keys(ORDER).length + '件一致'));

// 走らせる。pick(id, 選べる呼び名の配列, st) → 呼び名
function run(pick, opt) {
  opt = opt || {};
  let st = SN.fresh('結夏');
  let last = null;
  let overs = 0;
  for (let g = 0; g < 200000; g++) {
    const e = SN.step(st);
    if (e.t === 'ch') {
      last = JSON.parse(JSON.stringify(st));
      const list = SN.options(st, e.op).filter((o) => !o.off);
      const names = list.map((o) => ORDER[e.op.id][o.i]);
      let n = pick(e.op.id, names, st, opt.avoid && opt.avoid[e.op.id]);
      if (names.indexOf(n) < 0) n = names[0];
      const o = list[names.indexOf(n)];
      SN.choose(st, e.op, o.i);
    } else if (e.t === 'end') return { end: e.id, st, overs };
    else if (e.t === 'over') {
      overs++;
      if (!opt.retry) return { end: 'over', st, overs };
      // 直前の選択肢に戻って、別の選択肢を選ぶ
      const back = last; const pc = back.pc; st = back;
      const op = SN.prog[pc];
      const list = SN.options(st, op).filter((o) => !o.off);
      const names = list.map((o) => ORDER[op.id][o.i]).filter((x) => x !== 'R');
      const n = names[Math.floor(Math.random() * names.length)];
      SN.choose(st, op, list.find((o) => ORDER[op.id][o.i] === n).i);
    } else if (e.t === 'eof') return { end: 'eof', st, overs };
  }
  return { end: 'loop', st, overs };
}

function lean(letter, final, extra) {
  return (id, names) => {
    if (extra && extra[id] && names.indexOf(extra[id]) >= 0) return extra[id];
    if (id === 'c1501') return final;
    if (names.indexOf(letter) >= 0) return letter;
    return names[0];
  };
}

// モデルルート
const models = [
  ['ed1', lean('A', 'X1', { c0301: 'N1', c1402: 'B', c0501: 'C' })],
  ['ed2', lean('B', 'X2', { c0301: 'N1' })],
  ['ed3', lean('C', 'X3', { c0301: 'N1', c1402: 'B', c1401: 'A' })],
  ['ed4', lean('A', 'X3', { c0301: 'N1', c1402: 'B' })],
  ['ed5', lean('A', 'X4', { c0301: 'N1' })],
  ['ed6', lean('R', 'X1', { c1301: 'N', c1401: 'C', c1402: 'A', c0701: 'C' })],
  ['ed7', lean('C', 'X1', { c1402: 'D', c0301: 'N1' })],
];
const got = {};
models.forEach(([want, p]) => {
  const r = run(p);
  const ok = r.end === want;
  if (!ok) fail++;
  got[want] = ok;
  const v = r.st.v;
  console.log((ok ? '成功 ' : '失敗 ') + want + ' → ' + r.end + '  (p1=' + v.p1 + ' p2=' + v.p2 + ' p3=' + v.p3 + ' p4=' + v.p4 + ' f1=' + v.f1 + ' f2=' + v.f2 + ' f3=' + v.f3 + ')');
});
// 追加エンディング（ed1〜ed7 をすべて回収した状態で）
const allGot = ['ed1', 'ed2', 'ed3', 'ed4', 'ed5', 'ed6', 'ed7'].every((k) => got[k]);
ALL = allGot ? 1 : 0;
[['ed8', 'X5'], ['ed9', 'X6']].forEach(([want, x]) => {
  const r = run(lean('A', x, { c0301: 'N1' }));
  const ok = r.end === want;
  if (!ok) fail++;
  console.log((ok ? '成功 ' : '失敗 ') + want + ' → ' + r.end + '（ed1〜ed7 回収済み：' + (ALL ? 'はい' : 'いいえ') + '）');
});
ALL = 0;
{ // 未回収なら X5・X6 は出ない
  const r = run((id, names) => (id === 'c1501' ? (names.indexOf('X5') >= 0 ? 'X5' : 'X1') : names[0]));
  const ok = r.st.v.r1 !== 5;
  if (!ok) fail++;
  console.log((ok ? '成功 ' : '失敗 ') + '未回収時に追加の選択肢が出ない');
}
{ // ゲームオーバー
  const r = run(lean('R', 'X1', { c0701: 'C', c1301: 'R' }));
  const ok = r.end === 'over';
  if (!ok) fail++;
  console.log((ok ? '成功 ' : '失敗 ') + 'ゲームオーバー（13-1R, p4>=40）→ ' + r.end + ' p4=' + r.st.v.p4);
  const r2 = run(lean('A', 'X1', { c1301: 'R', c0301: 'N1' }));
  const ok2 = r2.end !== 'over';
  if (!ok2) fail++;
  console.log((ok2 ? '成功 ' : '失敗 ') + '13-1R を p4<40 で選んでも続く → ' + r2.end);
}

// 各パラメータの最大値（各選択肢で、その値がいちばん上がるものを選ぶ）
const mx = {};
['p1', 'p2', 'p3', 'p4'].forEach((k) => {
  let sum = 0;
  Object.keys(FX).forEach((id) => {
    let best = 0;
    FX[id].forEach((f) => { const m = f.match(new RegExp(k + '\\+(\\d+)')); if (m) best = Math.max(best, +m[1]); });
    if (id === 'c1301' && k === 'p4') best = Math.max(best, 10);
    sum += best;
  });
  mx[k] = sum;
});
console.log('最大値（上限100の前）：p1 ' + mx.p1 + '、p2 ' + mx.p2 + '、p3 ' + mx.p3 + '、p4 ' + mx.p4);

// シミュレーション
const N = +(process.argv[2] || 20000);
function tally(label, fn, opt) {
  const c = {};
  for (let i = 0; i < N; i++) { const r = run(fn, opt); c[r.end] = (c[r.end] || 0) + 1; }
  const keys = ['ed1', 'ed2', 'ed3', 'ed4', 'ed5', 'ed6', 'ed7', 'over'].filter((k) => c[k]);
  console.log(label + '：' + keys.map((k) => (k === 'over' ? 'ゲームオーバー' : k.toUpperCase()) + ' ' + (100 * c[k] / N).toFixed(1) + '%').join('／'));
}
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const pure = (id, names) => rnd(names.filter((n) => n !== 'X5' && n !== 'X6'));
function leanP(letter, final, force) {
  return (id, names) => {
    if (force && force[id]) return force[id];
    if (id === 'c1501') return final;
    if (names.indexOf(letter) >= 0 && Math.random() < 0.6) return letter;
    return rnd(names.filter((n) => n !== 'D' && n !== 'X5' && n !== 'X6'));
  };
}
tally('完全ランダム', pure);
tally('p1寄り6割・X1', leanP('A', 'X1'));
tally('p2寄り6割（桐箱を預かるのも6割）・X2', leanP('B', 'X2'));
tally('p3寄り6割・X3', leanP('C', 'X3'));
tally('危ない選択・戻ったら別の選択肢', (id, names) => (id === 'c1501' ? rnd(['X1', 'X2', 'X3']) : names.indexOf('R') >= 0 ? 'R' : rnd(names.filter((n) => n !== 'D'))), { retry: 1 });
tally('14-2でD（p1が低い）', (id, names) => (id === 'c1402' ? 'D' : id === 'c1501' ? 'X1' : rnd(names.filter((n) => n !== 'A' && n !== 'D'))));
console.log(fail ? '\n不合格 ' + fail + '件' : '\n到達テスト：全' + (models.length + 2) + '件成功');
process.exitCode = fail ? 1 : 0;
