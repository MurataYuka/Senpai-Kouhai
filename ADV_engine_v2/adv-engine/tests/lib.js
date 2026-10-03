/* モデルルートの自動テスト用の部品。
   ルートの書き方（tests/route_edNN.js）：
     { ed: 'ed01',               … 着くはずのエンディング
       picks: [0, '#A', 'p1'],   … 出てくる選択肢を順に選ぶ（配列）。または { 'ch01-c1': 0, … }（選択肢ID → 選び方）
       rest: 'p1',               … picks に無い選択肢の選び方（省略すると、足りないときに失敗）
       vars: { p1: 1 },          … 着いたときのパラメータ（省略可。書いたものだけ確かめる）
       name: 'テスト' }          … 主人公の名前（省略可）
   選び方：数字＝上から何番目か（0 始まり）／ '#タグ'＝そのタグの付いた選択肢／パラメータ名＝そのパラメータを動かす選択肢
   ゲームオーバー（任意機能）のルート（tests/route_gNNa.js など）：
     { go: 'g01', ver: 'a', picks: [...], rest, vars, name }  … ed の代わりに go（識別子）と ver（'a' / 'b'）を書く */
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

function play(spec, hooks) {
  const st = Core.newState(spec.name || 'テスト');
  const trail = [];
  const seq = Array.isArray(spec.picks) ? spec.picks.slice() : null;
  const map = !seq && spec.picks ? spec.picks : {};
  for (let g = 0; g < 1e6; g++) {
    const ev = Core.run(st, hooks);
    if (ev.type === 'text') { Core.advance(st); continue; }
    if (ev.type === 'end' || ev.type === 'over') {
      if (seq && seq.length) throw new Error('選択肢の指定が ' + seq.length + ' 個余っています（' + trail.join(' ') + ' の後）');
      if (ev.type === 'over') return { over: ev.id, ver: ev.ver, vars: st.vars, trail };
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
    Core.choose(st, idx, hooks);
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
    if (ev.type === 'over') return ev.id + ':' + ev.ver;
    Core.choose(st, 0);
  }
  throw new Error('終わりません');
}

function route(spec) {
  const r = play(spec);
  let ok = r.ed === spec.ed;
  const diff = [];
  if (spec.vars) for (const k in spec.vars) if (r.vars[k] !== spec.vars[k]) { ok = false; diff.push(k + '=' + r.vars[k] + '（期待 ' + spec.vars[k] + '）'); }
  console.log(`${ok ? '通過' : '失敗'}  ${spec.ed}  → ${r.ed || (r.over + ' 版' + String(r.ver).toUpperCase())}  ${JSON.stringify(r.vars)}  ${r.trail.join(' ')}${diff.length ? '  ' + diff.join(' ') : ''}`);
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

/* ---------- ゲームオーバー（任意機能）。機能がオフのときは「省略」と表示して null を返す ---------- */

function goSkipped(what) {
  if (Core.goOn()) return false;
  console.log('省略  ' + what + '（ゲームオーバー機能がオフ：config.gameovers.enabled）');
  return true;
}

/* ゲームオーバーのルート：指定の選び方で、指定の識別子・版のゲームオーバーに着くこと。
   回収の記録（hooks.gameover）が、ゲームオーバーのファイルの最初の文より前に付くことも確かめる */
function overRoute(spec) {
  if (goSkipped(spec.go)) return null;
  const ver = spec.ver || 'a';
  const entered = [];
  const hooks = { gameover: (id, v, st) => entered.push({ id, v, first: st.pc === 0 && st.file === Core.overFile(id, v) }) };
  const r = play(spec, hooks);
  const why = [];
  if (r.over !== spec.go || r.ver !== ver) why.push('着いた先が ' + (r.over ? r.over + ' 版' + String(r.ver).toUpperCase() : r.ed));
  if (entered.length !== 1 || entered[0].id !== spec.go || entered[0].v !== ver) why.push('@gameover の記録が ' + JSON.stringify(entered));
  else if (!entered[0].first) why.push('回収の記録がゲームオーバーのファイルに入った時点で付いていない');
  if (spec.vars) for (const k in spec.vars) if (r.vars[k] !== spec.vars[k]) why.push(k + '=' + r.vars[k] + '（期待 ' + spec.vars[k] + '）');
  const ok = !why.length;
  console.log(`${ok ? '通過' : '失敗'}  ${spec.go} 版${ver.toUpperCase()}  → ${r.over ? r.over + ' 版' + String(r.ver).toUpperCase() : r.ed}  ${JSON.stringify(r.vars)}  ${r.trail.join(' ')}${why.length ? '  ' + why.join(' / ') : ''}`);
  return ok;
}

/* ゲームオーバー一覧：一覧での再生、版の切り替えの解放前後の再生版、ボタンの出し分け。
   画面（engine/ui.js）は ADV.overView / overPlayVer / overFile で決めているので、それを確かめる */
function overList() {
  if (goSkipped('ゲームオーバー一覧')) return null;
  const alt = Core.config().gameovers.alt || {};
  const toA = alt.toA || '版Aを見る', toB = alt.toB || '版Bを見る';
  let all = true;
  const check = (label, ok, why) => {
    if (!ok) all = false;
    console.log(`${ok ? '通過' : '失敗'}  一覧：${label}${ok || !why ? '' : '  ' + why}`);
  };
  const replay = (id, view) => {
    const ver = Core.overPlayVer(id, view.ver);
    return { ver, to: playFrom(Core.overFile(id, ver)) };
  };

  // 解放前：版Aだけ・ボタンなし
  const v0 = Core.overView({ alt: false, view: 'b' });
  check('解放前は版Aでボタンを出さない', v0.ver === 'a' && v0.toggle === null, JSON.stringify(v0));
  for (const o of Core.overList()) {
    const p = replay(o.id, v0);
    check(`解放前の ${o.id} の再生は版Aで @over まで`, p.ver === 'a' && p.to === o.id + ':a', JSON.stringify(p));
    const a = Core.overOf(o.a), b = o.b ? Core.overOf(o.b) : a;
    check(`${o.id} は版A・版Bどちらも同じ識別子の回収`, a.id === o.id && b.id === o.id);
  }

  if (Core.altOn()) {
    // 解放後：版Bが基本・ボタンは toA。押すと版A・ボタンは toB
    const v1 = Core.overView({ alt: true });
    check('解放後は版Bが基本でボタンは「' + toA + '」', v1.ver === 'b' && v1.toggle === toA, JSON.stringify(v1));
    const v2 = Core.overView({ alt: true, view: 'a' });
    check('切り替え後は版Aでボタンは「' + toB + '」', v2.ver === 'a' && v2.toggle === toB, JSON.stringify(v2));
    const v3 = Core.overView({ alt: true, view: 'b' });
    check('もう一度押すと版Bに戻る', v3.ver === 'b' && v3.toggle === toA, JSON.stringify(v3));
    for (const o of Core.overList()) {
      const pb = replay(o.id, v1), pa = replay(o.id, v2);
      const want = o.b ? 'b' : 'a';
      check(`解放後の ${o.id} の再生は版${want.toUpperCase()}（b ${o.b ? 'あり' : 'なし'}）`, pb.ver === want && pb.to === o.id + ':' + want, JSON.stringify(pb));
      check(`版Aを見ているときの ${o.id} の再生は版A`, pa.ver === 'a' && pa.to === o.id + ':a', JSON.stringify(pa));
    }
    // 本編のルートのどこかで @altopen に着き、その前後で一覧の再生版が切り替わること
    let opened = null;
    try {
      const specs = mainSpecs();
      for (const ed of Core.mainEnds()) {
        let flag = false, before = null, after = null;
        play(specs[ed], { cmd: c => { if (c === 'altopen' && !flag) { before = Core.overView({ alt: flag }).ver; flag = true; after = Core.overView({ alt: flag }).ver; } } });
        if (flag) { opened = { ed, before, after }; break; }
      }
      check('本編のルートで @altopen に着き、前後で再生版が A → B になる', !!opened && opened.before === 'a' && opened.after === 'b', opened ? JSON.stringify(opened) : 'どのルートでも @altopen に着かない');
    } catch (e) { check('本編のルートで @altopen に着く', false, e.message); }
  } else {
    const v = Core.overView({ alt: true, view: 'b' });
    check('切り替えがオフなら、解放の記録があっても版Aでボタンなし', v.ver === 'a' && v.toggle === null, JSON.stringify(v));
  }
  return all;
}

function runMain(mod) {
  if (require.main === mod) {
    try { const r = mod.exports(); process.exitCode = r === false ? 1 : 0; }
    catch (e) { console.log('失敗  ' + e.message); process.exitCode = 1; }
  }
}

module.exports = { Core, play, playFrom, route, extraRoute, overRoute, overList, mainSpecs, runMain };
