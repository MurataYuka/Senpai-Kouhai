// 本文データの解釈と進行（ブラウザと Node の両方で動く）
(function (root) {
  'use strict';
  const SN = root.SN || (root.SN = {});
  SN.src = SN.src || [];
  SN.add = function (text) { SN.src.push(text); };

  const PV = ['p1', 'p2', 'p3', 'p4'];

  // ---- 組み立て ----
  SN.compile = function () {
    const prog = [];
    const labels = {};
    const stack = [];
    let lab = '_', off = 0;
    const push = (op) => { op.l = lab; op.o = off++; prog.push(op); return op; };

    const all = SN.src.join('\n').split(/\r?\n/);
    for (let i = 0; i < all.length; i++) {
      const line = all[i].trim();
      if (!line || line.startsWith('//')) continue;
      if (line[0] === '*') {
        lab = line.slice(1).trim(); off = 0;
        if (labels[lab] !== undefined) throw new Error('二重ラベル: ' + lab);
        labels[lab] = prog.length;
        continue;
      }
      if (line === '---') { push({ t: 'pg' }); continue; }
      if (line[0] === '@') {
        const sp = line.indexOf(' ');
        const name = sp < 0 ? line.slice(1) : line.slice(1, sp);
        const arg = sp < 0 ? '' : line.slice(sp + 1).trim();
        if (name === 'if') {
          const op = push({ t: 'jf', c: arg, to: -1 });
          stack.push({ jf: op, ends: [] });
        } else if (name === 'elif' || name === 'else') {
          const b = stack[stack.length - 1];
          if (!b) throw new Error('対応しない @' + name + ' (' + lab + ')');
          b.ends.push(push({ t: 'go', to: -1 }));
          if (!b.jf) throw new Error('@else のあとの @' + name + ' (' + lab + ')');
          b.jf.to = prog.length;
          b.jf = name === 'elif' ? push({ t: 'jf', c: arg, to: -1 }) : null;
        } else if (name === 'endif') {
          const b = stack.pop();
          if (!b) throw new Error('対応しない @endif (' + lab + ')');
          if (b.jf) b.jf.to = prog.length;
          b.ends.forEach((g) => { g.to = prog.length; });
        } else if (name === 'goto') {
          push({ t: 'go', to: arg });
        } else if (name === 'set') {
          push({ t: 'set', fx: arg });
        } else if (name === 'choice') {
          const op = push({ t: 'ch', id: arg, opts: [], grey: [] });
          while (i + 1 < all.length) {
            const nx = all[i + 1].trim();
            if (nx[0] === '+') { op.opts.push(parseOpt(nx.slice(1))); i++; }
            else if (nx[0] === '~') { op.grey.push(nx.slice(1).trim()); i++; }
            else if (!nx || nx.startsWith('//')) { i++; }
            else break;
          }
        } else {
          push({ t: 'cmd', n: name, a: arg });
        }
        continue;
      }
      push({ t: 'tx', s: line });
    }
    if (stack.length) throw new Error('@endif が足りない');
    // 飛び先の解決
    prog.forEach((op) => {
      if (op.t === 'go' && typeof op.to === 'string') op.to = resolve(labels, op.to);
      if (op.t === 'ch') op.opts.forEach((o) => { o.at = o.to ? resolve(labels, o.to) : -1; });
    });
    prog.forEach((op, k) => {
      if (op.t === 'ch') op.opts.forEach((o) => { if (o.at < 0) o.at = k + 1; });
      if (op.t === 'tx') op.id = op.l + '.' + op.o;
    });
    SN.prog = prog;
    SN.labels = labels;
    return prog;
  };

  function resolve(labels, name) {
    if (labels[name] === undefined) throw new Error('ラベルがない: ' + name);
    return labels[name];
  }

  function parseOpt(s) {
    const parts = s.split('|').map((x) => x.trim());
    const o = { s: parts[0], fx: '', to: '', cond: '', lock: '', lockText: '' };
    parts.slice(1).forEach((p) => {
      if (!p) return;
      if (p[0] === '>') o.to = p.slice(1).trim();
      else if (p.startsWith('if ')) o.cond = p.slice(3).trim();
      else if (p.startsWith('lock ')) {
        const k = p.indexOf('/');
        o.lock = p.slice(5, k).trim();
        o.lockText = p.slice(k + 1).trim();
      } else o.fx = p;
    });
    return o;
  }

  // ---- 状態 ----
  SN.fresh = function (name) {
    return {
      pc: SN.labels.ch01,
      v: { p1: 0, p2: 0, p3: 0, p4: 0, f1: 0, f2: 0, f3: 0, f4: 0, m1: 0, m2: 0, m3: 0, g1: 0, g2: 0, g3: 0, r1: 0, w1: 0, w2: 0, w3: 0, a1: 0, ch: 0 },
      name: name || '',
      pov: 'h',
      k: [],
      frm: '0',
      sky: '0',
      bg: 'b0',
      page: [],
      es: null,
    };
  };

  SN.glob = function () { return { all: 0 }; };

  SN.ev = function (st, expr) {
    if (!expr) return true;
    const env = Object.assign({}, SN.glob(), st.v);
    env.k1 = st.k.indexOf('k1') >= 0 ? 1 : 0;
    env.k2 = st.k.indexOf('k2') >= 0 ? 1 : 0;
    env.k3 = st.k.indexOf('k3') >= 0 ? 1 : 0;
    env.k4 = st.k.indexOf('k4') >= 0 ? 1 : 0;
    const keys = Object.keys(env);
    // eslint-disable-next-line no-new-func
    return !!Function.apply(null, keys.concat('return (' + expr + ');')).apply(null, keys.map((k) => env[k]));
  };

  SN.apply = function (st, fx) {
    if (!fx) return;
    fx.split(',').map((x) => x.trim()).filter(Boolean).forEach((e) => {
      const m = e.match(/^([a-z]+\d*)\s*([+\-=])\s*(-?\d+)$/);
      if (!m) throw new Error('効果の書式: ' + e);
      const k = m[1], n = +m[3];
      if (!(k in st.v)) throw new Error('不明な変数: ' + k);
      if (m[2] === '+') st.v[k] += n; else if (m[2] === '-') st.v[k] -= n; else st.v[k] = n;
      if (PV.indexOf(k) >= 0) st.v[k] = Math.max(0, Math.min(100, st.v[k]));
    });
  };

  // 表示用の選択肢一覧
  SN.options = function (st, op) {
    // 選べる選択肢を表示順に並べ、選べない一行（灰色）はその下にまとめる
    const out = [], grey = [];
    op.opts.forEach((o, i) => {
      if (o.cond && !SN.ev(st, o.cond)) return;
      if (o.lock && !SN.ev(st, o.lock)) grey.push({ i, s: o.lockText, off: true });
      else out.push({ i, s: o.s, off: false });
    });
    op.grey.forEach((g) => grey.push({ i: -1, s: g, off: true }));
    return out.concat(grey);
  };

  SN.choose = function (st, op, i) {
    const o = op.opts[i];
    SN.apply(st, o.fx);
    st.pc = o.at;
  };

  // 表示や演出が要るところまで進める。返り値は出来事。
  SN.step = function (st) {
    for (let guard = 0; guard < 100000; guard++) {
      const op = SN.prog[st.pc];
      if (!op) return { t: 'eof' };
      switch (op.t) {
        case 'tx': st.pc++; return { t: 'tx', op };
        case 'pg': st.pc++; st.page = []; return { t: 'pg' };
        case 'jf': st.pc = SN.ev(st, op.c) ? st.pc + 1 : op.to; break;
        case 'go': st.pc = op.to; break;
        case 'set': SN.apply(st, op.fx); st.pc++; break;
        case 'ch': return { t: 'ch', op };
        case 'cmd': {
          st.pc++;
          const r = SN.cmd(st, op);
          if (r) return r;
          break;
        }
        default: throw new Error('不明な命令');
      }
    }
    throw new Error('進行が止まらない');
  };

  SN.cmd = function (st, op) {
    const a = op.a;
    switch (op.n) {
      case 'chapter': {
        const sp = a.indexOf(' ');
        st.v.ch = +a.slice(0, sp < 0 ? a.length : sp);
        st.page = [];
        return { t: 'chap', n: st.v.ch, s: sp < 0 ? '' : a.slice(sp + 1) };
      }
      case 'bg': st.bg = a; return { t: 'fx' };
      case 'frm': st.frm = a; return { t: 'fx' };
      case 'sky': st.sky = a; return { t: 'fx' };
      case 'pov': st.pov = a; return { t: 'fx' };
      case 'lose':
        if (st.k.indexOf(a) < 0) st.k.push(a);
        return { t: 'lose', k: a };
      case 'page':
        if (!st.v[a]) { st.v[a] = 1; st.v.f2 += 1; }
        return { t: 'page', g: a };
      case 'rec': return { t: 'rec' };
      case 'ed':
        st.es = { id: a, pc: st.pc, st: JSON.parse(JSON.stringify(Object.assign({}, st, { es: null, page: [] }))) };
        return { t: 'fx' };
      case 'ending': return { t: 'end', id: a };
      case 'gameover': return { t: 'over' };
      case 'fx': return { t: 'fx', fx: a };
      case 'bgm': return { t: 'bgm', a };
      case 'se': return { t: 'se', a };
      case 'note': return { t: 'note', s: a };
      case 'flag': return { t: 'flag', a };
      default: throw new Error('不明なコマンド: @' + op.n);
    }
  };

  // 保存用の位置（ラベル＋ずれ）
  SN.pos = function (pc) { const op = SN.prog[pc]; return op ? { l: op.l, o: op.o } : null; };
  SN.unpos = function (p) {
    const base = SN.labels[p.l];
    if (base === undefined) throw new Error('位置が見つからない');
    return base + p.o;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SN;
})(typeof window !== 'undefined' ? window : globalThis);
