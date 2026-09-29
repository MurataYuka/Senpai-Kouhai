/* 進行の中核：本文スクリプトの解析と判定。ブラウザと点検ツールで共用する。 */
(function (root) {
  'use strict';

  var ORDER = ['ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08',
    'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15'];
  var ENDS = ['ed1', 'ed2', 'ed3', 'ed4', 'ed5', 'ed6', 'ed7', 'ed8', 'ed9'];
  var DEFAULT_NAME = 'あまね';

  function asciiTrim(s) { return s.replace(/^[ \t]+|[ \t]+$/g, ''); }

  function parseCond(str) {
    return str.trim().split(/\s+/).filter(Boolean).map(function (tok) {
      var m = tok.match(/^(p\d)(<=|>=|<|>|==)(-?\d+)$/);
      if (m) return { k: 'p', v: m[1], op: m[2], n: parseInt(m[3], 10) };
      if (tok.charAt(0) === '!') return { k: 'f', v: tok.slice(1), neg: true };
      return { k: 'f', v: tok, neg: false };
    });
  }

  function parseEff(str) {
    var eff = { p: {}, f: [] };
    (str || '').trim().split(/\s+/).filter(Boolean).forEach(function (tok) {
      var m = tok.match(/^(p\d)([+-]\d+)$/);
      if (m) eff.p[m[1]] = (eff.p[m[1]] || 0) + parseInt(m[2], 10);
      else eff.f.push(tok);
    });
    return eff;
  }

  function compile(src) {
    var ops = [], labels = {};
    var lines = src.split(/\r?\n/);
    var i = 0;
    while (i < lines.length) {
      var line = asciiTrim(lines[i]);
      i++;
      if (!line || line.charAt(0) === '#') continue;
      var c0 = line.charAt(0);
      if (c0 === '*') { labels[line.slice(1).trim()] = ops.length; continue; }
      if (line === '---') { ops.push({ t: 'page' }); continue; }
      if (c0 === '>') { ops.push({ t: 'go', to: line.slice(1).trim() }); continue; }
      if (c0 === '@') {
        var sp = line.slice(1).split(/\s+/);
        var cmd = sp[0];
        if (cmd === 'if') {
          var rest = line.slice(3).trim();
          var gi = rest.lastIndexOf('>');
          ops.push({ t: 'if', cond: parseCond(rest.slice(0, gi)), to: rest.slice(gi + 1).trim() });
        } else if (cmd === 'title' || cmd === 'next' || cmd === 'fin') {
          ops.push({ t: cmd });
        } else {
          ops.push({ t: cmd, v: sp.slice(1).join(' ') });
        }
        continue;
      }
      if (c0 === '?') {
        var id = line.slice(1).trim();
        var opts = [];
        while (i < lines.length && asciiTrim(lines[i]).charAt(0) === '+') {
          var parts = asciiTrim(lines[i]).slice(1).split('|').map(function (s) { return s.trim(); });
          opts.push({ s: parts[0], eff: parseEff(parts[1]), to: parts[2] });
          i++;
        }
        ops.push({ t: 'choice', id: id, opts: opts });
        continue;
      }
      var cond = null;
      var m = line.match(/^\[([^\]]+)\](.*)$/);
      if (m) { cond = parseCond(m[1]); line = m[2]; }
      ops.push({ t: 'text', s: line, cond: cond });
    }
    return { ops: ops, labels: labels };
  }

  function evalCond(cond, st) {
    if (!cond) return true;
    for (var i = 0; i < cond.length; i++) {
      var c = cond[i];
      if (c.k === 'p') {
        var x = st.p[c.v] || 0, ok;
        switch (c.op) {
          case '<': ok = x < c.n; break;
          case '<=': ok = x <= c.n; break;
          case '>': ok = x > c.n; break;
          case '>=': ok = x >= c.n; break;
          default: ok = x === c.n;
        }
        if (!ok) return false;
      } else {
        var has = !!st.f[c.v];
        if (has === c.neg) return false;
      }
    }
    return true;
  }

  function applyEff(eff, st) {
    Object.keys(eff.p).forEach(function (k) { st.p[k] = (st.p[k] || 0) + eff.p[k]; });
    eff.f.forEach(function (k) { st.f[k] = true; });
  }

  function nextOf(id) {
    var i = ORDER.indexOf(id);
    return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
  }

  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  }

  function newState(name) {
    return { cur: 'ch01', pc: 0, p: { p1: 0, p2: 0, p3: 0 }, f: {}, name: name || DEFAULT_NAME };
  }

  /* 画面なしで最後まで走らせる（自動テスト用）。pick(choiceOp, state, n) が選ぶ番号を返す。 */
  function runHeadless(data, pick, opt) {
    opt = opt || {};
    var cache = {};
    function prog(id) { return cache[id] || (cache[id] = compile(data[id].src)); }
    var st = opt.state || newState();
    var trace = [], n = 0, guard = 0;
    while (guard++ < 200000) {
      var P = prog(st.cur), op = P.ops[st.pc];
      if (!op) throw new Error('script ran off end: ' + st.cur);
      switch (op.t) {
        case 'text': case 'page': case 'bg': case 'fx': case 'frame': case 'title': case 'bgm':
          if (op.t === 'text' && opt.onText && evalCond(op.cond, st)) opt.onText(st.cur, op, st);
          st.pc++; break;
        case 'go':
          if (!(op.to in P.labels)) throw new Error('missing label ' + op.to + ' in ' + st.cur);
          st.pc = P.labels[op.to]; break;
        case 'if':
          if (!(op.to in P.labels)) throw new Error('missing label ' + op.to + ' in ' + st.cur);
          st.pc = evalCond(op.cond, st) ? P.labels[op.to] : st.pc + 1; break;
        case 'choice':
          var k = pick(op, st, n++);
          var o = op.opts[k];
          if (!o) throw new Error('bad pick ' + k + ' at ' + st.cur + ' ' + op.id);
          applyEff(o.eff, st);
          trace.push({ cur: st.cur, id: op.id, k: k, p: Object.assign({}, st.p) });
          if (!(o.to in P.labels)) throw new Error('missing label ' + o.to + ' in ' + st.cur);
          st.pc = P.labels[o.to]; break;
        case 'next':
          if (opt.onChapterEnd) opt.onChapterEnd(st.cur, st);
          st.cur = nextOf(st.cur); st.pc = 0;
          if (!st.cur) throw new Error('no next chapter');
          break;
        case 'ending':
          st.cur = op.v; st.pc = 0; break;
        case 'fin':
          return { ending: st.cur, state: st, trace: trace };
        default:
          throw new Error('unknown op ' + op.t);
      }
    }
    throw new Error('loop guard');
  }

  /* エンディング一覧の状態。ends は到達記録（{ed1:1,...}）。
     ed1〜ed6 は到達で再生可。ed7 は ed1〜ed6 すべて、ed8・ed9 は ed1〜ed7 すべてで解放。
     未解放・未到達はすべて「？？？」で並べる。 */
  function galleryState(ends) {
    ends = ends || {};
    var has = function (k) { return !!ends[k]; };
    var base = ['ed1', 'ed2', 'ed3', 'ed4', 'ed5', 'ed6'];
    var u7 = base.every(has);
    var u8 = base.concat(['ed7']).every(has);
    return ENDS.map(function (k) {
      var open = k === 'ed7' ? (u7 || has(k)) : (k === 'ed8' || k === 'ed9') ? (u8 || has(k)) : has(k);
      return { id: k, open: open };
    });
  }

  var api = {
    ORDER: ORDER, ENDS: ENDS, DEFAULT_NAME: DEFAULT_NAME,
    compile: compile, evalCond: evalCond, applyEff: applyEff, parseCond: parseCond,
    nextOf: nextOf, hash: hash, newState: newState, runHeadless: runHeadless, galleryState: galleryState
  };
  root.YoiCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
