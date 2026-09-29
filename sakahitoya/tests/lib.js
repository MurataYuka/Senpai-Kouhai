/* モデルルートの自動テスト用の部品。
   ルートの書き方（tests/route_edNN.js）：
     { ed: 'ed01',               … 着くはずのエンディング
       picks: [0, '#A', 'p1'],   … 出てくる選択肢を順に選ぶ（配列）。または { 'ch01-c1': 0, … }（選択肢ID → 選び方）
       rest: 'p1',               … picks に無い選択肢の選び方（省略すると、足りないときに失敗）
       vars: { p1: 1 },          … 着いたときのパラメータ（省略可。書いたものだけ確かめる）
       name: 'テスト' }          … 主人公の名前（省略可）
   選び方：数字＝上から何番目か（0 始まり）／ '#タグ'＝そのタグの付いた選択肢／パラメータ名＝そのパラメータを動かす選択肢 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Core } = require('../tools/load');

function pickIndex(ins, tok) {
  const opts = ins.opts;
  if (typeof tok === 'number') return tok >= 0 && tok < opts.length ? tok : -1;
  if (typeof tok !== 'string') return -1;
  if (tok[0] === '#') return opts.findIndex(o => o.tags.includes(tok.slice(1)));
  return opts.findIndex(o => o.eff.some(e => e.v === tok));
}

function play(spec) {
  const st = Core.newState(spec.name || 'テスト');
  const trail = [];
  const seq = Array.isArray(spec.picks) ? spec.picks.slice() : null;
  const map = !seq && spec.picks ? spec.picks : {};
  for (let g = 0; g < 1e6; g++) {
    const ev = Core.run(st);
    if (ev.type === 'text') { Core.advance(st); continue; }
    if (ev.type === 'end') {
      if (seq && seq.length) throw new Error('選択肢の指定が ' + seq.length + ' 個余っています（' + trail.join(' ') + ' の後）');
      return { ed: ev.ed, vars: st.vars, trail };
    }
    const id = ev.ins.id;
    let tok;
    if (seq && seq.length) tok = seq.shift();
    else if (map[id] !== undefined) tok = map[id];
    else if (spec.rest !== undefined) tok = spec.rest;
    else throw new Error('選択肢 ' + id + ' の選び方が指定されていません');
    const idx = pickIndex(ev.ins, tok);
    if (idx < 0) throw new Error('選択肢 ' + id + ' に「' + tok + '」に当たるものがありません');
    trail.push(id + '=' + (idx + 1));
    Core.choose(st, idx);
  }
  throw new Error('終わりません');
}

/* 指定のファイルから単体で再生して、着いたエンディングを返す（選択肢は一番上） */
function playFrom(file, vars) {
  const st = Core.newState('テスト');
  st.file = file; st.pc = 0;
  if (vars) Object.assign(st.vars, vars);
  for (let g = 0; g < 1e6; g++) {
    const ev = Core.run(st);
    if (ev.type === 'text') { Core.advance(st); continue; }
    if (ev.type === 'end') return ev.ed;
    Core.choose(st, 0);
  }
  throw new Error('終わりません');
}

function route(spec) {
  const r = play(spec);
  let ok = r.ed === spec.ed;
  const diff = [];
  if (spec.vars) for (const k in spec.vars) if (r.vars[k] !== spec.vars[k]) { ok = false; diff.push(k + '=' + r.vars[k] + '（期待 ' + spec.vars[k] + '）'); }
  console.log(`${ok ? '通過' : '失敗'}  ${spec.ed}  → ${r.ed}  ${JSON.stringify(r.vars)}  ${r.trail.join(' ')}${diff.length ? '  ' + diff.join(' ') : ''}`);
  return ok;
}

/* 本編エンディングのルート（tests/route_edNN.js の spec）を集める */
function mainSpecs() {
  const specs = {};
  for (const ed of Core.mainEnds()) {
    const f = path.join(__dirname, 'route_' + ed + '.js');
    if (!fs.existsSync(f)) throw new Error('本編エンディング ' + ed + ' のルート（tests/route_' + ed + '.js）がありません');
    const m = require(f);
    if (!m.spec) throw new Error('tests/route_' + ed + '.js に spec がありません');
    specs[ed] = m.spec;
  }
  return specs;
}

/* 追加エンディング：本編のルートで回収していくと、条件を満たしたときに初めて解放され、単体で最後まで再生できること */
function extraRoute(target) {
  let ok = true;
  const why = [];
  if (!Core.extraEnds().includes(target)) { ok = false; why.push('設定の endings.extra にない'); }
  const specs = mainSpecs();
  const got = {};
  if (Core.extraUnlocked(got)) { ok = false; why.push('何も回収していないのに解放'); }
  for (const ed of Core.mainEnds()) {
    const r = play(specs[ed]);
    if (r.ed !== ed) { ok = false; why.push(ed + ' のルートが ' + r.ed + ' に着く'); }
    got[r.ed] = true;
  }
  if (!Core.extraUnlocked(got)) { ok = false; why.push('本編を全回収しても解放されない'); }
  const rule = (Core.config().endings || {}).extraUnlock || 'all-main';
  if (rule === 'all-main') for (const ed of Core.mainEnds()) {
    const g = Object.assign({}, got); delete g[ed];
    if (Core.extraUnlocked(g)) { ok = false; why.push(ed + ' が欠けても解放'); }
  }
  let reached = null;
  try { reached = playFrom(target); } catch (e) { why.push(e.message); }
  if (reached !== target) { ok = false; why.push('単体再生の行き先が ' + reached); }
  console.log(`${ok ? '通過' : '失敗'}  ${target}  解放条件と単体再生${why.length ? '  ' + why.join(' / ') : ''}`);
  return ok;
}

function runMain(mod) {
  if (require.main === mod) {
    try { process.exitCode = mod.exports() ? 0 : 1; }
    catch (e) { console.log('失敗  ' + e.message); process.exitCode = 1; }
  }
}

module.exports = { Core, play, playFrom, route, extraRoute, mainSpecs, runMain };
