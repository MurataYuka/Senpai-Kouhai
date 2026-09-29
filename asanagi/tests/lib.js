/* モデルルートの自動テスト用 */
'use strict';
const { Core } = require('../tools/load');

const ROUTES = {
  ed01: { pick: 'p1', f1: 1, last: 'A' },
  ed02: { pick: 'p2', f1: 0, last: 'B' },
  ed03: { pick: 'p3', f1: 0, last: 'C' },
  ed04: { pick: 'p1', f1: 1, last: 'B' },
  ed05: { pick: 'p2', f1: 0, last: 'A' },
  ed06: { pick: 'p1', per: { ch03: 'p2', ch06: 'p3', ch08: 'p1' }, f1: 0, last: 'A' }
};

/* route: { pick: 既定のパラメータ, per: { chNN: パラメータ }, f1: 0|1, last: 'A'|'B'|'C' } */
function play(route, name) {
  const st = Core.newState(name || 'テスト');
  const trail = [];
  for (let g = 0; g < 200000; g++) {
    const ev = Core.run(st);
    if (ev.type === 'text') { Core.advance(st); continue; }
    if (ev.type === 'end') return { ed: ev.ed, vars: st.vars, trail };
    const opts = ev.ins.opts;
    let idx;
    if (opts.some(o => o.tags.length)) idx = opts.findIndex(o => o.tags.includes(route.last));
    else if (opts.some(o => o.eff.some(e => e.v === 'f1'))) idx = opts.findIndex(o => o.eff.some(e => e.v === 'f1' && e.n === route.f1));
    else {
      const want = (route.per && route.per[st.file]) || route.pick;
      idx = opts.findIndex(o => o.eff.some(e => e.v === want));
      if (idx < 0) {
        if (opts.some(o => o.eff.some(e => /^p[123]$/.test(e.v)))) throw new Error(st.file + ' に ' + want + ' の選択肢がありません');
        idx = 0; // パラメータの動かない選択肢
      }
    }
    if (idx < 0) throw new Error('選べる選択肢がありません: ' + ev.ins.id);
    trail.push(ev.ins.id + '#' + idx);
    Core.choose(st, idx);
  }
  throw new Error('終わりません');
}

/* 単体で再生して @end まで届くか */
function playFrom(file, vars) {
  const st = Core.newState('テスト');
  st.file = file; st.pc = 0;
  if (vars) Object.assign(st.vars, vars);
  for (let g = 0; g < 200000; g++) {
    const ev = Core.run(st);
    if (ev.type === 'text') { Core.advance(st); continue; }
    if (ev.type === 'end') return ev.ed;
    Core.choose(st, 0);
  }
  throw new Error('終わりません');
}

function check(label, route, expect, expVars) {
  const r = play(route);
  let ok = r.ed === expect;
  if (ok && expVars) for (const k in expVars) if (r.vars[k] !== expVars[k]) ok = false;
  console.log(`${ok ? '通過' : '失敗'}  ${label}  → ${r.ed}  ${JSON.stringify(r.vars)}`);
  return ok;
}

function mainRoute(ed, expVars) {
  return check(ed, ROUTES[ed], ed, expVars);
}

/* 追加枠：本編の ed01〜ed06 をすべて回収したときだけ解放され、単体で最後まで再生できること */
function unlockTest(target) {
  const got = {};
  let ok = true;
  for (const ed of Core.MAIN_ENDS) {
    if (Core.extraUnlocked(got)) { ok = false; console.log('  早すぎる解放: ' + ed + ' の前'); }
    got[play(ROUTES[ed]).ed] = true;
  }
  if (!Core.extraUnlocked(got)) { ok = false; console.log('  全回収しても解放されない'); }
  for (const ed of Core.MAIN_ENDS) {
    const g = Object.assign({}, got); delete g[ed];
    if (Core.extraUnlocked(g)) { ok = false; console.log('  ' + ed + ' 欠けでも解放'); }
  }
  const reached = playFrom(target);
  if (reached !== target) ok = false;
  console.log(`${ok ? '通過' : '失敗'}  ${target}  解放条件と単体再生 → ${reached}`);
  return ok;
}

function runMain(mod, fn) {
  if (require.main === mod) {
    try { process.exitCode = fn() ? 0 : 1; } catch (e) { console.log('失敗  ' + e.message); process.exitCode = 1; }
  }
}

module.exports = { Core, ROUTES, play, playFrom, check, mainRoute, unlockTest, runMain };
