'use strict';
/* 全ルートの到達テストと、パラメータの取りうる範囲の確認 */
const { Core } = require('./lib');

let pass = 0, total = 0;
for (let i = 1; i <= 8; i++) {
  const n = 'route_ed' + String(i).padStart(2, '0');
  total++;
  try { if (require('./' + n)()) pass++; } catch (e) { console.log('失敗  ' + n + '  ' + e.message); }
}
console.log(`到達テスト：${pass}/${total} 通過`);

/* 章ごとに選択肢を総当たりし、章の出口での値の組を集合で持って次の章へ渡す */
function explore(file, vars) {
  const out = [];
  const stack = [{ file, pc: 0, vars }];
  while (stack.length) {
    const s = stack.pop();
    const st = Core.newState('x');
    st.file = s.file; st.pc = s.pc; st.vars = Object.assign({}, s.vars);
    for (;;) {
      const before = st.file;
      const ev = Core.run(st);
      if (st.file !== before && st.file !== file) {
        if (/^ch/.test(st.file)) { out.push({ next: st.file, vars: st.vars }); break; }
      }
      if (ev.type === 'text') { Core.advance(st); continue; }
      if (ev.type === 'end') { out.push({ ed: ev.ed, vars: st.vars }); break; }
      ev.ins.opts.forEach((o, i) => {
        const c = Core.clone(st);
        Core.choose(c, i);
        stack.push({ file: c.file, pc: c.pc, vars: c.vars });
      });
      break;
    }
  }
  return out;
}

try {
  const range = {};
  const hit = {};
  const upd = v => {
    for (const k in v) {
      range[k] = range[k] || [Infinity, -Infinity];
      range[k][0] = Math.min(range[k][0], v[k]);
      range[k][1] = Math.max(range[k][1], v[k]);
    }
  };
  const v0 = Core.newState('x').vars;
  let frontier = new Map([['ch01|' + JSON.stringify(v0), { file: 'ch01', vars: v0 }]]);
  while (frontier.size) {
    const nf = new Map();
    for (const { file, vars } of frontier.values()) {
      for (const r of explore(file, vars)) {
        upd(r.vars);
        if (r.ed) { hit[r.ed] = (hit[r.ed] || 0) + 1; continue; }
        nf.set(r.next + '|' + JSON.stringify(r.vars), { file: r.next, vars: r.vars });
      }
    }
    frontier = nf;
  }
  console.log('取りうる範囲：' + Object.keys(range).map(k => `${k}=${range[k][0]}〜${range[k][1]}`).join(' '));
  console.log('通常プレイで到達できる本編エンディング：' + Core.MAIN_ENDS.map(e => e + (hit[e] ? '○' : '×')).join(' '));
  if (Core.MAIN_ENDS.some(e => !hit[e])) process.exitCode = 1;
} catch (e) {
  console.log('範囲の計算に失敗: ' + e.message);
  process.exitCode = 1;
}
if (pass !== total) process.exitCode = 1;
