// 自動テスト: node tests/test.js [--verbose]
// 詳細（どの経路がどの結末になるか）は --verbose のときだけ表示する。
'use strict';
const path = require('path');
const assert = require('assert');
const N = require('../js/core.js');

const VERBOSE = process.argv.indexOf('--verbose') >= 0;
N.FILES.forEach(function (id) { require(path.join(__dirname, '..', 'data', id + '.js')); });
const SC = N.scripts();

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e)); }
}
function log() { if (VERBOSE) console.log.apply(console, ['       '].concat([].slice.call(arguments))); }

/* ---------- 走行ドライバ ---------- */

function kind(opts) {
  if (opts.some(function (o) { return o.eff && o.eff.p; })) return 'main';
  if (opts.some(function (o) { return o.eff && o.eff.f; })) return 'flag';
  if (opts.some(function (o) { return o.eff && o.eff.fin; })) return 'final';
  return 'minor';
}

// pick(opts, info) -> index
function play(pick, opt) {
  opt = opt || {};
  const r = opt.runner || N.newGame('テスト');
  const trace = { main: [], flags: [], files: [r.file], choices: 0, texts: 0 };
  let mainIdx = 0;
  for (let step = 0; step < 200000; step++) {
    const ev = r.next();
    if (opt.onEvent) opt.onEvent(ev, r);
    if (ev.type === 'choice') {
      const k = kind(ev.opts);
      const info = { kind: k, file: r.file, mainIdx: mainIdx, state: r.state };
      const i = pick(ev.opts, info);
      assert.ok(i >= 0 && i < ev.opts.length, 'pick out of range');
      const eff = ev.opts[i].eff;
      if (k === 'main') { trace.main.push({ file: r.file, eff: eff }); mainIdx++; }
      if (k === 'flag') trace.flags.push({ file: r.file, eff: eff });
      trace.choices++;
      r.choose(i);
      if (trace.files[trace.files.length - 1] !== r.file) trace.files.push(r.file);
    } else if (ev.type === 'text') {
      trace.texts++;
    } else if (ev.type === 'page') {
      if (trace.files[trace.files.length - 1] !== r.file) trace.files.push(r.file);
    } else if (ev.type === 'fin') {
      return { ed: ev.id, state: r.state, trace: trace, title: ev.title };
    } else if (ev.type === 'eof') {
      throw new Error('script ended without @fin at ' + r.file);
    }
  }
  throw new Error('runaway');
}

function idxOf(opts, pred) {
  for (let i = 0; i < opts.length; i++) if (pred(opts[i].eff)) return i;
  return -1;
}
// 戦略: mains(mainIdx) -> 'p1'|'p2'|'p3', flags: bool, fin: 'F1'|'F2'|'F3'
function strategy(mains, flags, fin) {
  return function (opts, info) {
    if (info.kind === 'main') {
      const want = mains(info.mainIdx);
      const i = idxOf(opts, function (e) { return e && e.p === want; });
      assert.ok(i >= 0, 'main option ' + want + ' missing in ' + info.file);
      return i;
    }
    if (info.kind === 'flag') {
      const i = idxOf(opts, function (e) { return flags ? (e && e.f) : !e; });
      assert.ok(i >= 0, 'flag option missing');
      return i;
    }
    if (info.kind === 'final') {
      const i = idxOf(opts, function (e) { return e && e.fin === fin; });
      assert.ok(i >= 0, 'final option ' + fin + ' missing');
      return i;
    }
    return 0;
  };
}

/* ---------- 構造 ---------- */

console.log('structure');

test('all 19 scripts parse and are present', function () {
  N.FILES.forEach(function (id) { assert.ok(SC[id], 'missing ' + id); });
  assert.strictEqual(Object.keys(SC).length, 19);
});

test('extra ending is outside the story: no chapter or judge leads to it', function () {
  N.CHAPTERS.concat(N.ENDINGS).forEach(function (id) {
    SC[id].cmds.forEach(function (c) {
      if (c.t === 'cmd' && c.c === 'next') assert.ok(N.EXTRA.indexOf(c.a[0]) < 0, id + ' leads to extra ending');
    });
  });
  // 判定はどの状態でも ed1〜ed6 のどれかを返す
  ['F1', 'F2', 'F3'].forEach(function (fin) {
    for (let a = 0; a <= 29; a += 1) for (let b = 0; b + a <= 29; b += 1) {
      const st = Object.assign(N.initState('x'), { p1: a, p2: b, p3: 29 - a - b, f1: 1, f2: 1, f3: 1, fin: fin });
      assert.ok(N.ENDINGS.indexOf(N.judge(st)) >= 0);
    }
  });
  const extra = SC.ed7.cmds;
  assert.ok(!extra.some(function (c) { return c.t === 'choice'; }), 'extra ending has no choices');
  assert.ok(!extra.some(function (c) { return c.t === 'cmd' && (c.c === 'judge' || c.c === 'next'); }));
});

test('file names are alphanumeric only', function () {
  const fs = require('fs');
  const root = path.join(__dirname, '..');
  ['', 'js', 'css', 'data', 'tools', 'tests'].forEach(function (d) {
    fs.readdirSync(path.join(root, d)).forEach(function (f) {
      assert.ok(/^[A-Za-z0-9._-]+$/.test(f), 'non-alnum file name: ' + path.join(d, f));
    });
  });
});

test('chapters chain ch01..ch12, ch12 ends in judge, endings end in fin', function () {
  N.CHAPTERS.forEach(function (id, i) {
    const cmds = SC[id].cmds;
    const nexts = cmds.filter(function (c) { return c.t === 'cmd' && c.c === 'next'; });
    if (i < 11) {
      assert.strictEqual(nexts.length, 1, id + ' should have one @next');
      assert.strictEqual(nexts[0].a[0], N.CHAPTERS[i + 1]);
    } else {
      assert.ok(cmds.some(function (c) { return c.t === 'cmd' && c.c === 'judge'; }), 'ch12 needs @judge');
    }
    const ch = cmds.filter(function (c) { return c.t === 'cmd' && c.c === 'chapter'; });
    assert.strictEqual(ch.length, 1);
    assert.strictEqual(+ch[0].a[0], i + 1);
  });
  N.ENDINGS.concat(N.EXTRA).forEach(function (id) {
    assert.ok(SC[id].meta.title, id + ' needs a title');
    assert.ok(SC[id].cmds.some(function (c) { return c.t === 'cmd' && c.c === 'fin'; }), id + ' needs @fin');
  });
});

test('main choices: 2 per chapter (ch12: 1), 3 options p1/p2/p3, weight 2 in ch05/09/11', function () {
  let total = 0;
  N.CHAPTERS.forEach(function (id, i) {
    const mains = SC[id].cmds.filter(function (c) { return c.t === 'choice' && kind(c.opts) === 'main'; });
    assert.strictEqual(mains.length, i === 11 ? 1 : 2, id + ' main choice count');
    const w = (id === 'ch05' || id === 'ch09' || id === 'ch11') ? 2 : 1;
    mains.forEach(function (c) {
      assert.strictEqual(c.opts.length, 3, id + ' main choice must have 3 options');
      const ps = c.opts.map(function (o) { assert.ok(o.eff && o.eff.p, id + ' option without param'); assert.strictEqual(o.eff.v, w, id + ' weight'); return o.eff.p; }).sort();
      assert.deepStrictEqual(ps, ['p1', 'p2', 'p3']);
      c.opts.forEach(function (o) { assert.ok(/^▷/.test(o.text), 'option text must start with ▷'); });
    });
    total += mains.length;
  });
  assert.strictEqual(total, 23);
});

test('flag choices: f1 in ch05, f2 in ch07, f3 in ch10, two options each', function () {
  const where = { f1: 'ch05', f2: 'ch07', f3: 'ch10' };
  Object.keys(where).forEach(function (f) {
    N.FILES.forEach(function (id) {
      SC[id].cmds.forEach(function (c) {
        if (c.t !== 'choice') return;
        const has = c.opts.some(function (o) { return o.eff && o.eff.f === f; });
        if (!has) return;
        assert.strictEqual(id, where[f], f + ' found in ' + id);
        assert.strictEqual(c.opts.length, 2);
        assert.ok(c.opts.some(function (o) { return !o.eff; }), f + ' needs a decline option');
      });
    });
  });
});

test('final choice in ch12 shows F1, F2, F3 together', function () {
  const fins = SC.ch12.cmds.filter(function (c) { return c.t === 'choice' && kind(c.opts) === 'final'; });
  assert.strictEqual(fins.length, 1);
  assert.deepStrictEqual(fins[0].opts.map(function (o) { return o.eff.fin; }), ['F1', 'F2', 'F3']);
});

test('minor choices do not move parameters (at most 4 per chapter)', function () {
  N.CHAPTERS.forEach(function (id) {
    const minors = SC[id].cmds.filter(function (c) { return c.t === 'choice' && kind(c.opts) === 'minor'; });
    assert.ok(minors.length <= 4, id + ' has ' + minors.length + ' minor choices');
    minors.forEach(function (c) { c.opts.forEach(function (o) { assert.strictEqual(o.eff, null); }); });
  });
});

test('parameter bounds: max 29, min 0, thresholds reachable', function () {
  let max = 0;
  N.CHAPTERS.forEach(function (id) {
    SC[id].cmds.forEach(function (c) {
      if (c.t === 'choice' && kind(c.opts) === 'main') max += c.opts[0].eff.v;
    });
  });
  assert.strictEqual(max, 29);
  // 実走でも最大・最小を確かめる
  ['p1', 'p2', 'p3'].forEach(function (p) {
    const hi = play(strategy(function () { return p; }, false, 'F1'));
    assert.strictEqual(hi.state[p], 29, p + ' max');
    const other = p === 'p1' ? 'p2' : 'p1';
    const lo = play(strategy(function () { return other; }, false, 'F1'));
    assert.strictEqual(lo.state[p], 0, p + ' min');
  });
  assert.ok(18 <= 29 && 14 <= 29 && 10 <= 29);
});

/* ---------- 判定表 ---------- */

console.log('judge table');

test('judge table matches the design', function () {
  const S = function (o) { return Object.assign(N.initState('x'), o); };
  const cases = [
    [{ fin: 'F1', f1: 1, f2: 1, f3: 1, p1: 18 }, 'ed1'],
    [{ fin: 'F1', f1: 1, f2: 1, f3: 1, p1: 17 }, 'ed4'],
    [{ fin: 'F1', f1: 1, f2: 1, f3: 0, p1: 29 }, 'ed4'],
    [{ fin: 'F1', f1: 0, f2: 0, f3: 0, p1: 10 }, 'ed4'],
    [{ fin: 'F1', f1: 1, f2: 1, f3: 1, p1: 9 }, 'ed5'],
    [{ fin: 'F1', p1: 0, p2: 29 }, 'ed5'],
    [{ fin: 'F2', p2: 14, p3: 14 }, 'ed2'],
    [{ fin: 'F2', p2: 14, p3: 15 }, 'ed6'],
    [{ fin: 'F2', p2: 13, p3: 0 }, 'ed6'],
    [{ fin: 'F2', p1: 29 }, 'ed6'],
    [{ fin: 'F3', p3: 14, p2: 14 }, 'ed3'],
    [{ fin: 'F3', p3: 14, p2: 15, p1: 0 }, 'ed6'],
    [{ fin: 'F3', p3: 13, p1: 10 }, 'ed4'],
    [{ fin: 'F3', p3: 13, p1: 9 }, 'ed6'],
    [{ fin: 'F3', p3: 20, p2: 0, p1: 25 }, 'ed3']
  ];
  cases.forEach(function (c) { assert.strictEqual(N.judge(S(c[0])), c[1], JSON.stringify(c[0])); });
});

/* ---------- モデルルート ---------- */

console.log('model routes');

const MODEL = [
  { name: 'route-1', mains: function () { return 'p1'; }, flags: true, fin: 'F1', expect: 'ed1' },
  { name: 'route-2', mains: function () { return 'p2'; }, flags: false, fin: 'F2', expect: 'ed2' },
  { name: 'route-3', mains: function () { return 'p3'; }, flags: false, fin: 'F3', expect: 'ed3' },
  { name: 'route-4', mains: function () { return 'p1'; }, flags: false, fin: 'F1', expect: 'ed4' },
  { name: 'route-5', mains: function () { return 'p2'; }, flags: false, fin: 'F1', expect: 'ed5' },
  { name: 'route-6', mains: function () { return 'p1'; }, flags: false, fin: 'F2', expect: 'ed6' }
];
MODEL.forEach(function (m) {
  test(m.name + ' reaches its expected ending', function () {
    const res = play(strategy(m.mains, m.flags, m.fin));
    log(m.name, '->', res.ed, JSON.stringify({ p1: res.state.p1, p2: res.state.p2, p3: res.state.p3, f1: res.state.f1, f2: res.state.f2, f3: res.state.f3 }));
    assert.strictEqual(res.ed, m.expect);
    assert.strictEqual(res.trace.main.length, 23);
    assert.deepStrictEqual(res.trace.files.filter(function (f) { return /^ch/.test(f); }), N.CHAPTERS);
  });
});

test('rotating p1/p2/p3 route: F1/F2/F3 results match the judge table', function () {
  const rot = function (i) { return ['p1', 'p2', 'p3'][i % 3]; };
  ['F1', 'F2', 'F3'].forEach(function (fin) {
    [true, false].forEach(function (flags) {
      const res = play(strategy(rot, flags, fin));
      const exp = N.judge(res.state);
      log('rotate', fin, 'flags=' + flags, '->', res.ed, JSON.stringify({ p1: res.state.p1, p2: res.state.p2, p3: res.state.p3 }));
      assert.strictEqual(res.ed, exp);
    });
  });
});

/* ---------- 到達可能性 ---------- */

console.log('reachability');

test('every ending is reachable (exhaustive over parameter totals)', function () {
  // 主要選択肢の重み列から、到達可能な (p1,p2,p3) の組をすべて求める
  const weights = [];
  N.CHAPTERS.forEach(function (id) {
    SC[id].cmds.forEach(function (c) { if (c.t === 'choice' && kind(c.opts) === 'main') weights.push(c.opts[0].eff.v); });
  });
  let set = new Set(['0,0,0']);
  weights.forEach(function (w) {
    const next = new Set();
    set.forEach(function (k) {
      const v = k.split(',').map(Number);
      next.add([v[0] + w, v[1], v[2]].join(','));
      next.add([v[0], v[1] + w, v[2]].join(','));
      next.add([v[0], v[1], v[2] + w].join(','));
    });
    set = next;
  });
  const reached = {};
  set.forEach(function (k) {
    const v = k.split(',').map(Number);
    [[0, 0, 0], [1, 1, 1]].forEach(function (f) {
      ['F1', 'F2', 'F3'].forEach(function (fin) {
        const st = Object.assign(N.initState('x'), { p1: v[0], p2: v[1], p3: v[2], f1: f[0], f2: f[1], f3: f[2], fin: fin });
        reached[N.judge(st)] = true;
      });
    });
  });
  N.ENDINGS.forEach(function (id) { assert.ok(reached[id], id + ' unreachable'); });
  log('distinct parameter totals:', set.size);
});

test('simulation: targeted play reaches endings at sane rates', function () {
  // 設計書と同じ条件: 主要選択肢の半分を狙い、残りをランダムに
  let seed = 12345;
  const rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const weights = [];
  N.CHAPTERS.forEach(function (id) {
    SC[id].cmds.forEach(function (c) { if (c.t === 'choice' && kind(c.opts) === 'main') weights.push(c.opts[0].eff.v); });
  });
  function sim(target, ratio, fin, flags) {
    const RUNS = 20000;
    let hit = 0;
    const expect = { p1: 'ed1', p2: 'ed2', p3: 'ed3' }[target];
    for (let n = 0; n < RUNS; n++) {
      const st = N.initState('x');
      const idx = weights.map(function (_, i) { return i; });
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      const aimed = new Set(idx.slice(0, Math.round(weights.length * ratio)));
      weights.forEach(function (w, i) {
        const p = aimed.has(i) ? target : ['p1', 'p2', 'p3'][Math.floor(rnd() * 3)];
        st[p] += w;
      });
      st.f1 = st.f2 = st.f3 = flags ? 1 : 0;
      st.fin = fin;
      if (N.judge(st) === expect) hit++;
    }
    return hit / RUNS;
  }
  const r1 = sim('p1', 0.5, 'F1', true), r2 = sim('p2', 0.5, 'F2', false), r3 = sim('p3', 0.5, 'F3', false);
  const r1b = sim('p1', 0.6, 'F1', true);
  log('half-targeted rates:', r1.toFixed(3), r2.toFixed(3), r3.toFixed(3), '/ 60%:', r1b.toFixed(3));
  assert.ok(r1 > 0.5 && r2 > 0.8 && r3 > 0.8 && r1b > r1);
});

/* ---------- セーブ／ロード ---------- */

console.log('save / load');

function eventsSig(ev) { return ev.type + ':' + (ev.s || (ev.opts ? ev.opts.map(function (o) { return o.text; }).join('/') : '') || ev.id || ''); }

// UI と同じ手順で保存点から復帰し、その後の出来事列を返す
function resumeAndCollect(save, count) {
  const r = N.resume(save);
  let n = r.count;
  const runner = r.runner;
  while (n > 0) {
    const ev = runner.next();
    if (ev.type === 'text') n--;
    if (ev.type === 'choice' || ev.type === 'fin') throw new Error('hit ' + ev.type + ' during replay');
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    const ev = runner.next();
    out.push(eventsSig(ev));
    if (ev.type === 'choice' || ev.type === 'fin') break;
  }
  return { runner: runner, events: out };
}

test('manual save mid-page restores position, params, flags and name', function () {
  const r = N.newGame('しおり');
  const pick = strategy(function (i) { return ['p2', 'p3', 'p1'][i % 3]; }, true, 'F1');
  let save = null, after = [], mainIdx = 0, texts = 0;
  for (let step = 0; step < 100000; step++) {
    const ev = r.next();
    if (ev.type === 'choice') {
      const k = kind(ev.opts);
      r.choose(pick(ev.opts, { kind: k, mainIdx: mainIdx, file: r.file }));
      if (k === 'main') mainIdx++;
      continue;
    }
    if (ev.type === 'text') texts++;
    if (save) {
      after.push(eventsSig(ev));
      if (after.length >= 25 || ev.type === 'choice') break;
      continue;
    }
    if (ev.type === 'text' && r.file === 'ch06' && r.shown === 3) save = r.saveData();
  }
  assert.ok(save, 'save point not reached');
  assert.strictEqual(save.file, 'ch06');
  assert.strictEqual(save.snap.name, 'しおり');
  assert.ok(save.head.length > 0, 'head line recorded');
  const res = resumeAndCollect(JSON.parse(JSON.stringify(save)), after.length);
  assert.deepStrictEqual(res.events, after);
  ['p1', 'p2', 'p3', 'f1', 'f2', 'f3', 'name', 'candles', 'ch'].forEach(function (k) {
    assert.deepStrictEqual(res.runner.state[k], r.state[k], 'state ' + k);
  });
});

test('11 manual slots, overwrite replaces, slot 12 rejected', function () {
  const store = new N.Store(N.MemoryStorage());
  assert.strictEqual(store.slots().length, 11);
  for (let n = 1; n <= 11; n++) store.saveSlot(n, { v: 1, t: n, file: 'ch01', pc: 0, shown: 0, snap: N.initState('a'), head: 'x' + n, ch: 1 });
  assert.ok(store.slots().every(function (d, i) { return d && d.head === 'x' + (i + 1); }));
  store.saveSlot(5, { v: 1, t: 99, file: 'ch02', pc: 0, shown: 0, snap: N.initState('b'), head: 'new', ch: 2 });
  assert.strictEqual(store.slot(5).head, 'new');
  assert.strictEqual(N.placeLabel(store.slot(5)), '第2章');
  assert.throws(function () { store.saveSlot(12, {}); });
  assert.throws(function () { store.saveSlot(0, {}); });
});

test('back-to-last-choice: auto slot restores the state right before every choice', function () {
  const store = new N.Store(N.MemoryStorage());
  const r = N.newGame('もどる');
  let checked = 0, mainIdx = 0;
  const pick = strategy(function (i) { return ['p3', 'p1', 'p2'][i % 3]; }, false, 'F3');
  for (let step = 0; step < 200000; step++) {
    const ev = r.next();
    if (ev.type === 'fin') break;
    if (ev.type !== 'choice') continue;
    store.saveAuto(r.saveData());            // UI は選択肢を出すたびに保存する
    const before = N.clone(r.state);
    const k = kind(ev.opts);
    const i = pick(ev.opts, { kind: k, mainIdx: mainIdx, file: r.file });
    if (k === 'main') mainIdx++;
    r.choose(i);
    // 選んだ直後に「直前の選択肢に戻る」
    const back = N.resume(store.auto());
    let n = back.count, ev2;
    while (n > 0) { ev2 = back.runner.next(); if (ev2.type === 'text') n--; }
    ev2 = back.runner.next();
    while (ev2.type !== 'choice') { assert.notStrictEqual(ev2.type, 'text', 'extra text before choice'); ev2 = back.runner.next(); }
    assert.deepStrictEqual(ev2.opts.map(function (o) { return o.text; }), ev.opts.map(function (o) { return o.text; }));
    ['p1', 'p2', 'p3', 'f1', 'f2', 'f3', 'fin', 'name'].forEach(function (key) {
      assert.deepStrictEqual(back.runner.state[key], before[key], key + ' at ' + r.file);
    });
    checked++;
  }
  assert.ok(checked >= 30, 'checked ' + checked + ' choices');
  log('choices checked:', checked);
});

test('every page start in every script can be resumed', function () {
  // 各ページ先頭から保存・復帰して、次の出来事が同じになること
  let pages = 0;
  const r = N.newGame('ぺーじ');
  const pick = strategy(function () { return 'p1'; }, true, 'F1');
  let mainIdx = 0;
  for (let step = 0; step < 200000; step++) {
    const ev = r.next();
    if (ev.type === 'fin') break;
    if (ev.type === 'choice') {
      const k = kind(ev.opts);
      r.choose(pick(ev.opts, { kind: k, mainIdx: mainIdx, file: r.file }));
      if (k === 'main') mainIdx++;
      continue;
    }
    if (ev.type === 'text' && r.shown === 1) {
      const save = r.saveData();
      const back = N.resume(JSON.parse(JSON.stringify(save)));
      let ev2 = back.runner.next();
      while (ev2.type !== 'text') ev2 = back.runner.next();
      assert.strictEqual(ev2.s, ev.s);
      pages++;
    }
  }
  assert.ok(pages > 250, 'pages ' + pages);
  log('pages checked:', pages);
});

/* ---------- エンディング記録と再生 ---------- */

console.log('ending record / replay');

test('ending record survives new game and slot overwrite; reset clears it', function () {
  const ls = N.MemoryStorage();
  const store = new N.Store(ls);
  const res = play(strategy(function () { return 'p1'; }, false, 'F2'));
  store.addEnding(res.ed);
  store.addEnding(res.ed);
  assert.deepStrictEqual(store.endings(), [res.ed]);
  // 新しいゲームとセーブの上書き
  N.newGame('べつ');
  for (let n = 1; n <= 11; n++) store.saveSlot(n, N.newGame('x').saveData());
  store.saveAuto(N.newGame('y').saveData());
  const again = new N.Store(ls);
  assert.deepStrictEqual(again.endings(), [res.ed]);
  again.resetEndings();
  assert.deepStrictEqual(again.endings(), []);
  assert.ok(again.slot(1), 'slots untouched by reset');
});

test('each ending replays from its start to fin', function () {
  N.GALLERY.forEach(function (id) {
    const r = N.replayEnding(id, 'さいせい');
    const res = play(function () { return 0; }, { runner: r });
    assert.strictEqual(res.ed, id);
    assert.ok(res.title.length > 0);
    assert.ok(res.trace.texts > 20);
  });
});

test('ending gallery hides unreached titles', function () {
  // UI の表示規則をここでも確かめる: 未到達は ？？？
  const store = new N.Store(N.MemoryStorage());
  store.addEnding('ed4');
  const got = store.endings();
  const labels = N.ENDINGS.map(function (id) { return got.indexOf(id) >= 0 ? SC[id].meta.title : '？？？'; });
  assert.strictEqual(labels.filter(function (x) { return x === '？？？'; }).length, 5);
  assert.notStrictEqual(labels[3], '？？？');
});

test('extra ending unlocks only after ed1-ed6 are all recorded, listed last', function () {
  const ls = N.MemoryStorage();
  const store = new N.Store(ls);
  let g = store.gallery();
  assert.strictEqual(g.length, 7);
  assert.strictEqual(g[6].id, 'ed7');
  assert.ok(g.every(function (x) { return !x.open && x.title === '？？？'; }));
  ['ed1', 'ed2', 'ed3', 'ed4', 'ed5'].forEach(function (id) { store.addEnding(id); });
  assert.strictEqual(store.extraUnlocked(), false);
  g = store.gallery();
  assert.strictEqual(g[6].open, false);
  assert.strictEqual(g[6].title, '？？？');
  assert.strictEqual(g.filter(function (x) { return x.open; }).length, 5);
  store.addEnding('ed6');
  assert.strictEqual(store.extraUnlocked(), true);
  g = new N.Store(ls).gallery();       // 読み直しても同じ
  assert.ok(g.every(function (x) { return x.open; }));
  assert.strictEqual(g[6].title, SC.ed7.meta.title);
  // 追加の結末を見ても ed1〜ed6 の記録には影響しない
  store.addEnding('ed7');
  assert.ok(N.ENDINGS.every(function (id) { return store.endings().indexOf(id) >= 0; }));
  // 記録リセットで再び伏せられる
  store.resetEndings();
  assert.strictEqual(store.extraUnlocked(), false);
  assert.strictEqual(store.gallery()[6].title, '？？？');
});

test('extra ending stays locked when ed1-ed6 are recorded out of order with gaps', function () {
  const store = new N.Store(N.MemoryStorage());
  ['ed6', 'ed2', 'ed2', 'ed4', 'ed1', 'ed3'].forEach(function (id) { store.addEnding(id); });
  assert.strictEqual(store.extraUnlocked(), false);
  store.addEnding('ed5');
  assert.strictEqual(store.extraUnlocked(), true);
});

/* ---------- 文字数 ---------- */

console.log('length');

test('lengths are within the target ranges', function () {
  N.FILES.forEach(function (id) {
    const n = N.countScript(SC[id]);
    let lo = 5950, hi = 8050;
    if (/^ed[123]$/.test(id)) { lo = 2975; hi = 4025; }
    if (/^ed[456]$/.test(id)) { lo = 2000; hi = 2500; }
    if (id === 'ed7') { lo = 4250; hi = 5750; }
    assert.ok(n >= lo && n <= hi, id + ': ' + n);
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
