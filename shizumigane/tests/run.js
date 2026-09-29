#!/usr/bin/env node
/* ルートテスト。出力はルート番号と合否だけ。  node tests/run.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SCN = path.join(ROOT, 'js', 'scenario');

function load() {
  const ctx = { console };
  vm.createContext(ctx);
  const chs = fs.readdirSync(SCN).filter((f) => /^ch\d\d\.js$/.test(f)).sort();
  const files = ['js/core.js', 'js/scenario/meta.js'].concat(chs.map((f) => 'js/scenario/' + f));
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return { ctx, chs };
}

const { ctx, chs } = load();
const { Core, SZ } = ctx;
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'secret', 'routes.json'), 'utf8'));
let failed = 0;

function report(label, ok, note) {
  if (!ok) failed++;
  console.log(label + ': ' + (ok ? 'PASS' : 'FAIL') + (note ? ' ' + note : ''));
}

// 未実装の章への移動なら true
function unbuilt(sc) {
  const m = /^(ch\d\d)_/.exec(sc);
  return !!m && !SZ.ch[m[1]];
}

function parsePicks(s) {
  const o = {};
  String(s || '').split(/\s+/).filter(Boolean).forEach((t) => {
    const m = /^([qd]\d\d)([a-z])$/.exec(t);
    if (!m) throw new Error('pick ' + t);
    o[m[1]] = m[2];
  });
  return o;
}

/* ---------- 静的チェック ---------- */
function staticCheck() {
  const qs = {};
  const probe = Core.fresh('x');
  for (const id of Object.keys(SZ.sc)) {
    SZ.sc[id].forEach((c, i) => {
      const at = id + ':' + i;
      if (typeof c === 'string') {
        if (/\n[~!@+▷]/.test(c) || /\{(?!n\})/.test(c)) throw new Error('line ' + at);
        return;
      }
      if (c.go && !SZ.sc[c.go] && !unbuilt(c.go)) throw new Error('go ' + at);
      if (c.if) Core.test(probe, c.if);
      if (c.set) Core.apply(JSON.parse(JSON.stringify(probe)), c.set);
      if (c.q) {
        if (qs[c.q]) throw new Error('dup ' + c.q);
        qs[c.q] = 1;
        const keys = {};
        c.opts.forEach((o) => {
          if (keys[o.k]) throw new Error('dup key ' + c.q);
          keys[o.k] = 1;
          if (typeof o.t !== 'string' || o.t.charAt(0) !== '▷') throw new Error('label ' + c.q);
          if (o.if) Core.test(probe, o.if);
          if (o.set) Core.apply(JSON.parse(JSON.stringify(probe)), o.set);
          if (o.go && !SZ.sc[o.go] && !unbuilt(o.go)) throw new Error('go ' + c.q);
        });
      }
    });
  }
  // index.html が全章を読み込んでいるか
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const f of chs) if (html.indexOf('js/scenario/' + f) < 0) throw new Error('index ' + f);
  return qs;
}

let qs = {};
try { qs = staticCheck(); report('static', true); }
catch (e) { report('static', false, '(' + e.message + ')'); }

/* ---------- モデルルート ---------- */
function runRoute(r) {
  const picks = Object.assign({}, spec.defaults, parsePicks(r.picks));
  const st = Core.fresh('テスト');
  for (let n = 0; n < 50000; n++) {
    const ev = Core.step(st);
    if (ev.t === 'q') {
      if (ev.id === 'q17' && r.at_q17) {
        for (const k of Object.keys(r.at_q17)) {
          if (Core.val(st, k) !== r.at_q17[k]) return { ok: false, why: 'value@q17' };
        }
      }
      const want = picks[ev.id];
      if (!want) return { ok: false, why: 'no pick ' + ev.id };
      const o = ev.opts.find((x) => x.k === want);
      if (!o) return { ok: false, why: 'hidden ' + ev.id + want };
      Core.choose(st, o.n);
      continue;
    }
    if (ev.t === 'miss') {
      if (unbuilt(st.sc)) return { ok: true, partial: st.sc.slice(0, 4) };
      return { ok: false, why: 'missing ' + st.sc };
    }
    if (ev.t === 'err') return { ok: false, why: ev.msg };
    if (ev.t === 'dead' || ev.t === 'end') {
      if (ev.id !== r.expect) return { ok: false, why: 'reached other' };
      if (r.alive) {
        const all = SZ.meta.members.map((m) => m.id);
        for (const m of all) {
          const gone = st.ab.indexOf(m) >= 0;
          if (gone === (r.alive.indexOf(m) >= 0)) return { ok: false, why: 'roster' };
        }
      }
      return { ok: true };
    }
  }
  return { ok: false, why: 'loop' };
}

for (const r of spec.routes) {
  let res;
  try { res = runRoute(r); } catch (e) { res = { ok: false, why: e.message }; }
  report('route ' + r.no, res.ok, res.partial ? '(~' + res.partial + ')' : (res.ok ? '' : '(' + res.why + ')'));
}

/* ---------- ランダム走行（止まらない・壊れないこと） ---------- */
(function fuzz() {
  let seed = 20060831;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const N = 20000;
  const seenIds = {};
  let partial = false;
  for (let i = 0; i < N; i++) {
    const st = Core.fresh('ランダム');
    let done = false;
    for (let n = 0; n < 50000 && !done; n++) {
      const ev = Core.step(st);
      if (ev.t === 'q') {
        if (!ev.opts.length) { report('fuzz', false, '(empty ' + ev.id + ')'); return; }
        // 途中デッドエンドの分岐では、たまにだけ死亡側を選ぶ
        let o = ev.opts[Math.floor(rnd() * ev.opts.length)];
        if (/^d/.test(ev.id)) {
          const want = rnd() < 0.1 ? 'a' : 'b';
          o = ev.opts.find((x) => x.k === want);
        }
        Core.choose(st, o.n);
      } else if (ev.t === 'miss') {
        if (!unbuilt(st.sc)) { report('fuzz', false, '(missing ' + st.sc + ')'); return; }
        partial = true;
        done = true;
      } else if (ev.t === 'err') { report('fuzz', false, '(' + ev.msg + ')'); return; }
      else if (ev.t === 'dead' || ev.t === 'end') { seenIds[ev.id] = 1; done = true; }
    }
    if (!done) { report('fuzz', false, '(loop)'); return; }
  }
  // 全章そろっていれば、ランダム走行だけで全エンディング・全欠席に届くこと
  if (!partial) {
    const all = SZ.meta.ends.map((e) => e[0]).concat(SZ.meta.xs);
    if (!all.every((id) => seenIds[id])) { report('fuzz', false, '(coverage)'); return; }
  }
  report('fuzz', true);
})();

/* ---------- 数値の上下限（選択肢表から計算） ---------- */
(function bounds() {
  const need = [];
  for (let i = 1; i <= 16; i++) need.push('q' + String(i).padStart(2, '0'));
  if (!need.every((q) => qs[q])) { console.log('bounds: skip'); return; }
  const qcmd = {};
  for (const id of Object.keys(SZ.sc)) SZ.sc[id].forEach((c) => { if (c && c.q) qcmd[c.q] = c; });
  const eff = (o) => {
    const s = { v: { v1: 0, v2: 0, v3: 0 }, f: {} };
    if (o.set) Core.apply(s, o.set);
    s.kc = Object.keys(s.f).filter((k) => /^k\d+$/.test(k)).length;
    return s;
  };
  const got = { v1: [0, 0], v2: [0, 0], v3: [0, 0], kc: [0, 0] };
  let v1allk = 0;
  for (const q of need) {
    const effs = qcmd[q].opts.map(eff);
    for (const k of ['v1', 'v2', 'v3']) {
      got[k][0] += Math.min(...effs.map((e) => e.v[k]));
      got[k][1] += Math.max(...effs.map((e) => e.v[k]));
    }
    got.kc[0] += Math.min(...effs.map((e) => e.kc));
    got.kc[1] += Math.max(...effs.map((e) => e.kc));
    const withK = effs.filter((e) => e.kc > 0);
    v1allk += Math.max(...(withK.length ? withK : effs).map((e) => e.v.v1));
  }
  const b = spec.bounds;
  const ok = ['v1', 'v2', 'v3', 'kc'].every((k) => got[k][0] === b[k][0] && got[k][1] === b[k][1]) && v1allk === b.v1_allk;
  report('bounds', ok);
})();

process.exitCode = failed ? 1 : 0;
