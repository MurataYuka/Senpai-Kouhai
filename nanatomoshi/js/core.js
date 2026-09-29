/*
 * core.js — シナリオの解析・進行・判定・保存（DOM に依存しない）
 * ブラウザでは window.NANA、Node では module.exports として使う。
 */
(function (root) {
  'use strict';

  const N = root.NANA || (root.NANA = {});
  N.src = N.src || {};
  N.def = function (id, src) { N.src[id] = src; cache = null; };

  N.CHAPTERS = ['ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08', 'ch09', 'ch10', 'ch11', 'ch12'];
  N.ENDINGS = ['ed1', 'ed2', 'ed3', 'ed4', 'ed5', 'ed6'];
  // 本編の判定に関係しない追加の結末（ed1〜ed6 をすべて見たときだけ解放）
  N.EXTRA = ['ed7'];
  N.GALLERY = N.ENDINGS.concat(N.EXTRA);
  N.FILES = N.CHAPTERS.concat(N.ENDINGS, N.EXTRA);
  N.SLOTS = 11;

  /* ---------- 解析 ---------- */

  // 効果指定: "-" | "p1" | "p1:2" | "f1" | "F1"
  function parseEff(s) {
    s = (s || '-').trim();
    if (s === '-' || s === '') return null;
    let m = /^p([123])(?::(\d+))?$/.exec(s);
    if (m) return { p: 'p' + m[1], v: m[2] ? +m[2] : 1 };
    m = /^f([123])$/.exec(s);
    if (m) return { f: 'f' + m[1] };
    m = /^F([123])$/.exec(s);
    if (m) return { fin: 'F' + m[1] };
    throw new Error('bad effect: ' + s);
  }

  /*
   * 書式
   *   空行        改ページ
   *   # ...       注釈
   *   *name       ラベル
   *   @cmd args   命令
   *   ? 文 | 効果 | 飛び先   選択肢（連続行で一組）
   *   % 文        重なる声
   *   それ以外    本文（▷ で始まれば主人公の行動）
   *   本文中の <<...>> は滲む文字、{name} は主人公の名前
   */
  function parse(id, src) {
    const cmds = [];
    const labels = {};
    const meta = {};
    let choice = null;
    let atPage = true;
    const flush = function () { if (choice) { cmds.push(choice); choice = null; } };
    const lines = String(src).replace(/\r/g, '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/[ \t　]+$/, '');
      if (/^#/.test(line)) continue;
      if (line.trim() === '') {
        flush();
        if (!atPage) { cmds.push({ t: 'page' }); atPage = true; }
        continue;
      }
      if (line[0] === '?') {
        const parts = line.slice(1).split('|').map(function (x) { return x.trim(); });
        if (!choice) choice = { t: 'choice', opts: [], line: i + 1 };
        choice.opts.push({ text: parts[0], eff: parseEff(parts[1]), go: parts[2] || null });
        atPage = false;
        continue;
      }
      flush();
      if (line[0] === '*') { labels[line.slice(1).trim()] = cmds.length; continue; }
      if (line[0] === '@') {
        const body = line.slice(1).trim();
        const name = body.split(/\s+/)[0];
        const rest = body.slice(name.length).trim();
        const a = rest ? rest.split(/\s+/) : [];
        if (name === 'ending') { meta.title = rest; continue; }
        cmds.push({ t: 'cmd', c: name, a: a, rest: rest, line: i + 1 });
        continue;
      }
      if (line[0] === '%') {
        cmds.push({ t: 'text', kind: 'voice', s: line.slice(1).trim() });
        atPage = false;
        continue;
      }
      cmds.push({ t: 'text', kind: /^[\s　]*▷/.test(line) ? 'pc' : 'n', s: line });
      atPage = false;
    }
    flush();
    // 飛び先の検査
    cmds.forEach(function (c) {
      if (c.t === 'choice') c.opts.forEach(function (o) {
        if (o.go && !(o.go in labels)) throw new Error(id + ': missing label ' + o.go);
      });
      if (c.t === 'cmd' && c.c === 'goto' && !(c.a[0] in labels)) throw new Error(id + ': missing label ' + c.a[0]);
      if (c.t === 'cmd' && c.c === 'if' && !(c.a[1] in labels)) throw new Error(id + ': missing label ' + c.a[1]);
    });
    return { id: id, cmds: cmds, labels: labels, meta: meta };
  }
  N.parse = parse;
  N.parseEff = parseEff;

  let cache = null;
  N.scripts = function () {
    if (!cache) {
      cache = {};
      Object.keys(N.src).forEach(function (id) { cache[id] = parse(id, N.src[id]); });
    }
    return cache;
  };

  /* ---------- 状態と判定 ---------- */

  N.initState = function (name) {
    return {
      name: name || '',
      p1: 0, p2: 0, p3: 0,
      f1: 0, f2: 0, f3: 0,
      fin: null,
      ch: 0,
      candles: '0000000',
      night: 0,
      names: null
    };
  };

  N.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  N.judge = function (s) {
    if (s.fin === 'F1') {
      if (s.f1 && s.f2 && s.f3 && s.p1 >= 18) return 'ed1';
      if (s.p1 >= 10) return 'ed4';
      return 'ed5';
    }
    if (s.fin === 'F2') {
      if (s.p2 >= 14 && s.p2 >= s.p3) return 'ed2';
      return 'ed6';
    }
    if (s.fin === 'F3') {
      if (s.p3 >= 14 && s.p3 >= s.p2) return 'ed3';
      if (s.p1 >= 10) return 'ed4';
      return 'ed6';
    }
    throw new Error('final choice not set');
  };

  N.fill = function (s, st) { return s.replace(/\{name\}/g, st.name || ''); };

  function test(expr, st) {
    const eq = /^(\w+)=(\w+)$/.exec(expr);
    if (eq) return String(st[eq[1]]) === eq[2];
    const m = /^(!?)(\w+)(?:(>=|<=|>|<|==)(\d+))?$/.exec(expr);
    if (!m) throw new Error('bad condition: ' + expr);
    const v = +st[m[2]] || 0;
    let r;
    switch (m[3]) {
      case '>=': r = v >= +m[4]; break;
      case '<=': r = v <= +m[4]; break;
      case '>': r = v > +m[4]; break;
      case '<': r = v < +m[4]; break;
      case '==': r = v === +m[4]; break;
      default: r = !!v;
    }
    return m[1] ? !r : r;
  }

  /* ---------- 進行 ---------- */

  function Runner(state, file, pc) {
    this.sc = N.scripts();
    this.state = state;
    this.file = file;
    this.pc = pc || 0;
    this.pending = null;
    this.lastHead = '';
    this.mark();
  }

  Runner.prototype.mark = function () {
    if (this.head) this.lastHead = this.head;
    this.pageFile = this.file;
    this.pageStart = this.pc;
    this.snap = N.clone(this.state);
    this.shown = 0;
    this.head = '';
  };

  Runner.prototype.goto = function (label) {
    const sc = this.sc[this.file];
    if (!(label in sc.labels)) throw new Error(this.file + ': missing label ' + label);
    this.pc = sc.labels[label];
  };

  Runner.prototype.enter = function (file) {
    if (!this.sc[file]) throw new Error('missing script ' + file);
    this.file = file;
    this.pc = 0;
    this.mark();
  };

  Runner.prototype.choiceEvent = function () {
    const st = this.state;
    return {
      type: 'choice',
      opts: this.pending.opts.map(function (o) { return { text: N.fill(o.text, st), eff: o.eff }; })
    };
  };

  Runner.prototype.next = function () {
    if (this.pending) return this.choiceEvent();
    for (let guard = 0; guard < 100000; guard++) {
      const sc = this.sc[this.file];
      if (!sc) throw new Error('missing script ' + this.file);
      if (this.pc >= sc.cmds.length) return { type: 'eof' };
      const c = sc.cmds[this.pc++];
      if (c.t === 'page') { this.mark(); return { type: 'page' }; }
      if (c.t === 'text') {
        const s = N.fill(c.s, this.state);
        this.shown++;
        if (this.shown === 1) this.head = s;
        return { type: 'text', kind: c.kind, s: s };
      }
      if (c.t === 'choice') { this.pending = c; return this.choiceEvent(); }
      const ev = this.exec(c, sc);
      if (ev) return ev;
    }
    throw new Error('runaway script');
  };

  Runner.prototype.exec = function (c, sc) {
    const st = this.state;
    const a = c.a;
    switch (c.c) {
      case 'chapter':
        st.ch = +a[0];
        return { type: 'chapter', n: st.ch, title: c.rest.slice(a[0].length).trim() };
      case 'candles':
        st.candles = a[0];
        return { type: 'visual' };
      case 'candle': {
        const i = +a[0] - 1;
        const on = a[1] === 'on';
        st.candles = st.candles.slice(0, i) + (on ? '1' : '0') + st.candles.slice(i + 1);
        return { type: 'candle', i: i, on: on, hard: a[2] === 'hard' };
      }
      case 'names':
        st.names = c.rest === '-' ? null : c.rest.split(',');
        return { type: 'visual', names: true };
      case 'night': st.night = 1; return { type: 'visual' };
      case 'day': st.night = 0; return { type: 'visual' };
      case 'fx': return { type: 'fx', k: a[0] };
      case 'wait': return { type: 'wait', ms: +a[0] };
      case 'set': st[a[0]] = +a[1]; return null;
      case 'goto': this.goto(a[0]); return null;
      case 'if': if (test(a[0], st)) this.goto(a[1]); return null;
      case 'next': this.enter(a[0]); return { type: 'page' };
      case 'judge': {
        const ed = N.judge(st);
        this.enter(ed);
        return { type: 'page' };
      }
      case 'fin':
        return { type: 'fin', id: this.file, title: sc.meta.title || '' };
      default:
        throw new Error(this.file + ':' + c.line + ' unknown command @' + c.c);
    }
  };

  Runner.prototype.choose = function (i) {
    const c = this.pending;
    if (!c) throw new Error('no choice pending');
    const o = c.opts[i];
    if (!o) throw new Error('bad choice index');
    const st = this.state;
    if (o.eff) {
      if (o.eff.p) st[o.eff.p] += o.eff.v;
      if (o.eff.f) st[o.eff.f] = 1;
      if (o.eff.fin) st.fin = o.eff.fin;
    }
    this.pending = null;
    if (o.go) this.goto(o.go);
    this.mark();
    return o.eff;
  };

  // 現在のページ先頭からやり直せる形で保存する
  Runner.prototype.saveData = function () {
    return {
      v: 1,
      t: Date.now(),
      file: this.pageFile,
      pc: this.pageStart,
      shown: this.shown,
      snap: N.clone(this.snap),
      head: this.head || this.lastHead || '',
      ch: this.snap.ch
    };
  };

  N.Runner = Runner;

  // 保存データから復帰する。返り値の count だけ本文を即時表示すれば保存時点に戻る
  N.resume = function (save) {
    const r = new Runner(N.clone(save.snap), save.file, save.pc);
    r.lastHead = save.head || '';
    return { runner: r, count: save.shown || 0 };
  };

  N.newGame = function (name) {
    return new Runner(N.initState(name), 'ch01', 0);
  };

  N.replayEnding = function (id, name) {
    const st = N.initState(name);
    st.ch = 12;
    st.candles = '1011010';
    return new Runner(st, id, 0);
  };

  N.placeLabel = function (save) {
    if (!save) return '';
    if (/^ch/.test(save.file)) return '第' + (+save.file.slice(2)) + '章';
    return '終章';
  };

  /* ---------- 保存領域 ---------- */

  const K = {
    slot: function (n) { return 'nana.slot.' + n; },
    auto: 'nana.auto',
    ends: 'nana.ends',
    cfg: 'nana.cfg',
    meta: 'nana.meta'
  };

  function Store(ls) { this.ls = ls; }
  Store.prototype.get = function (k) {
    try { const v = this.ls.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  };
  Store.prototype.set = function (k, v) {
    try { this.ls.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  };
  Store.prototype.del = function (k) {
    try { this.ls.removeItem(k); } catch (e) { /* ignore */ }
  };
  Store.prototype.slot = function (n) { return this.get(K.slot(n)); };
  Store.prototype.saveSlot = function (n, d) {
    if (n < 1 || n > N.SLOTS) throw new Error('bad slot');
    return this.set(K.slot(n), d);
  };
  Store.prototype.slots = function () {
    const out = [];
    for (let n = 1; n <= N.SLOTS; n++) out.push(this.slot(n));
    return out;
  };
  Store.prototype.auto = function () { return this.get(K.auto); };
  Store.prototype.saveAuto = function (d) { return this.set(K.auto, d); };
  Store.prototype.hasAny = function () {
    if (this.auto()) return true;
    return this.slots().some(function (x) { return !!x; });
  };
  Store.prototype.endings = function () { return this.get(K.ends) || []; };
  Store.prototype.addEnding = function (id) {
    const e = this.endings();
    if (e.indexOf(id) < 0) { e.push(id); this.set(K.ends, e); }
    return e;
  };
  Store.prototype.resetEndings = function () { this.del(K.ends); };
  Store.prototype.extraUnlocked = function () {
    const e = this.endings();
    return N.ENDINGS.every(function (id) { return e.indexOf(id) >= 0; });
  };
  // 一覧に出す項目: { id, open, title }
  Store.prototype.gallery = function () {
    const e = this.endings();
    const extra = this.extraUnlocked();
    const sc = N.scripts();
    return N.GALLERY.map(function (id) {
      const open = N.EXTRA.indexOf(id) >= 0 ? extra : e.indexOf(id) >= 0;
      return { id: id, open: open, title: open ? ((sc[id] && sc[id].meta.title) || '') : '？？？' };
    });
  };
  Store.prototype.cfg = function () { return this.get(K.cfg) || {}; };
  Store.prototype.saveCfg = function (c) { return this.set(K.cfg, c); };
  Store.prototype.meta = function () { return this.get(K.meta) || {}; };
  Store.prototype.saveMeta = function (m) { return this.set(K.meta, m); };
  N.Store = Store;

  // テスト用の簡易ストレージ
  N.MemoryStorage = function () {
    const m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      keys: function () { return Object.keys(m); }
    };
  };

  /* ---------- 文字数 ---------- */

  // 本文と選択肢の文字数（空白・改行・▷・書式記号を除く）
  N.countText = function (s) {
    return s.replace(/<<|>>/g, '').replace(/\{name\}/g, '').replace(/[\s　▷]/g, '').length;
  };
  N.countScript = function (sc) {
    let n = 0;
    sc.cmds.forEach(function (c) {
      if (c.t === 'text') n += N.countText(c.s);
      if (c.t === 'choice') c.opts.forEach(function (o) { n += N.countText(o.text); });
    });
    return n;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = N;
})(typeof window !== 'undefined' ? window : globalThis);
