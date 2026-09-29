/* core.js — シナリオ登録と進行（DOM を触らない。ブラウザと Node の両方で動く） */
(function (root) {
  'use strict';

  var SZ = root.SZ = root.SZ || {};
  SZ.ch = SZ.ch || {};
  SZ.sc = SZ.sc || {};
  SZ.order = SZ.order || [];
  SZ.meta = SZ.meta || {};

  /*
   * 章データの形
   *   { id:'ch01', label:'第一章', title:'…', lv:0, start:'ch01_s1', scenes:{ ch01_s1:[ … ] } }
   *
   * シーンは命令の配列。
   *   '文'            地の文・台詞（1 クリック 1 段落。\n で改行）
   *   '▷ 文'          主人公の間接話法
   *   '!文'           大きく震える行
   *   '~文'           にじんで出る行（[[ ]] で囲んだ部分は別の色）
   *   '@ 文'          日付などの小見出し（クリックを待たない）
   *   '---'           ページを消す
   *   { ch:'ch01' }   章の開始（章題の札・章頭の記録）
   *   { q:'q01', opts:[{ k:'a', t:'▷ …', set:'v1+1', if:'…', go:'…', then:[…] }] }
   *   { go:'id', at:0, if:'…' }  移動（if があれば条件付き）
   *   { set:'v1+1 k01 !f02', if:'…' }
   *   { lv:12 }       水位（画面の高さに対する %）
   *   { ab:'m_03' }   状態欄に印
   *   { strike:'m_03' } / { mark:'m_02' } / { note:['m_01','…'] }  状態欄への書き込み（線・出の印・小さな添え書き）
   *   '+文'           近く、はっきり、少し大きく出る行（▷ と組み合わせて '+▷ …' も可）
   *   { fx:'bell' }   演出
   *   { wait:800 }
   *   { dead:'x_01' } / { end:'end_01' }
   *   {n} は主人公の名前に置き換わる。
   */
  SZ.add = function (chap) {
    if (SZ.ch[chap.id]) return;
    SZ.ch[chap.id] = chap;
    SZ.order.push(chap.id);
    SZ.order.sort();
    Object.keys(chap.scenes).forEach(function (id) {
      var list = chap.scenes[id];
      SZ.sc[id] = list;
      list.forEach(function (c, i) {
        if (!c || typeof c !== 'object' || !c.q) return;
        c.opts.forEach(function (o) {
          if (!o.then) return;
          var sub = id + '~' + i + o.k;
          SZ.sc[sub] = o.then.concat([o.go ? { go: o.go } : { go: id, at: i + 1 }]);
          o.go = sub;
          delete o.then;
        });
      });
    });
  };

  function fresh(nm) {
    return {
      sc: SZ.meta.start || 'ch01_s1', i: 0,
      v: { v1: 0, v2: 0, v3: 0 }, f: {}, ab: [], rk: {}, lv: 0, ch: '', nm: nm
    };
  }

  function val(st, name) {
    if (name === 'kc') {
      var n = 0;
      for (var k in st.f) if (st.f[k] && /^k\d+$/.test(k)) n++;
      return n;
    }
    if (Object.prototype.hasOwnProperty.call(st.v, name)) return st.v[name];
    return st.f[name] ? 1 : 0;
  }

  // 'v1>=8&kc>=5|f01'  （& が | より強い）
  function test(st, expr) {
    return String(expr).split('|').some(function (or) {
      return or.split('&').every(function (a) {
        var m = /^\s*(!?)(\w+)\s*(?:(>=|<=|==|!=|>|<)\s*(-?\d+))?\s*$/.exec(a);
        if (!m) throw new Error('cond: ' + expr);
        var x = val(st, m[2]), r;
        if (!m[3]) r = !!x;
        else {
          var y = +m[4];
          r = m[3] === '>=' ? x >= y : m[3] === '<=' ? x <= y : m[3] === '>' ? x > y :
              m[3] === '<' ? x < y : m[3] === '==' ? x === y : x !== y;
        }
        return m[1] ? !r : r;
      });
    });
  }

  // 'v1+1 v2-1 v3=0 k01 !f02'
  function apply(st, expr) {
    String(expr).split(/\s+/).forEach(function (t) {
      if (!t) return;
      var m;
      if ((m = /^(\w+)([+-]\d+)$/.exec(t))) st.v[m[1]] = (st.v[m[1]] || 0) + (+m[2]);
      else if ((m = /^(\w+)=(-?\d+)$/.exec(t))) st.v[m[1]] = +m[2];
      else if ((m = /^!(\w+)$/.exec(t))) delete st.f[m[1]];
      else if (/^\w+$/.test(t)) st.f[t] = 1;
      else throw new Error('set: ' + expr);
    });
  }

  function parseLine(s) {
    if (s === '---') return { k: 'clr' };
    var c = s.charAt(0);
    if (c === '▷') return { k: 'b', s: s };
    if (c === '!') return { k: 'c', s: s.slice(1) };
    if (c === '~') return { k: 'd', s: s.slice(1) };
    if (c === '@') return { k: 'e', s: s.replace(/^@\s*/, '') };
    if (c === '+') return { k: 'f', s: s.slice(1) };
    return { k: 'a', s: s };
  }

  function cur(st) {
    var list = SZ.sc[st.sc];
    return list ? list[st.i] : undefined;
  }

  // 次の「止まる所」まで進めてイベントを返す
  function step(st) {
    for (var guard = 0; guard < 5000; guard++) {
      var list = SZ.sc[st.sc];
      if (!list) return { t: 'miss', sc: st.sc };
      if (st.i >= list.length) return { t: 'err', msg: 'end of ' + st.sc };
      var c = list[st.i], key = st.sc + ':' + st.i;

      if (typeof c === 'string') {
        var p = parseLine(c);
        st.i++;
        if (p.k === 'clr') return { t: 'clr' };
        return { t: 'ln', k: p.k, s: p.s, key: key };
      }
      if (c.q) {
        var opts = [];
        c.opts.forEach(function (o, n) {
          if (!o.if || test(st, o.if)) opts.push({ n: n, k: o.k, s: o.t });
        });
        return { t: 'q', id: c.q, opts: opts, key: key };
      }
      if (c.if && !test(st, c.if)) { st.i++; continue; }
      if (c.set) apply(st, c.set);
      if (c.go) { st.sc = c.go; st.i = c.at || 0; continue; }
      st.i++;
      if (c.ch) {
        st.ch = c.ch;
        var chap = SZ.ch[c.ch];
        if (chap && chap.lv != null) st.lv = chap.lv;
        return { t: 'ch', id: c.ch };
      }
      if (c.lv != null) { st.lv = c.lv; return { t: 'lv', n: c.lv }; }
      if (c.ab) {
        if (st.ab.indexOf(c.ab) < 0) st.ab.push(c.ab);
        return { t: 'ab', id: c.ab };
      }
      if (c.strike || c.mark || c.note) {
        var who = c.strike || c.mark || c.note[0];
        st.rk = st.rk || {};
        var r = st.rk[who] = st.rk[who] || {};
        if (c.strike) r.x = 1;
        if (c.mark) r.o = 1;
        if (c.note) r.nt = c.note[1];
        return { t: 'rk', id: who };
      }
      if (c.fx) return { t: 'fx', fx: c.fx };
      if (c.wait) return { t: 'wait', ms: c.wait };
      if (c.dead) return { t: 'dead', id: c.dead };
      if (c.end) return { t: 'end', id: c.end };
      if (c.set) continue;
      return { t: 'err', msg: 'bad command ' + key };
    }
    return { t: 'err', msg: 'loop at ' + st.sc };
  }

  // 選択肢 n（opts の元の番号）を選ぶ。表示用の文を返す
  function choose(st, n) {
    var c = cur(st);
    if (!c || !c.q) throw new Error('not at a choice');
    var o = c.opts[n];
    if (!o || (o.if && !test(st, o.if))) throw new Error('bad option');
    if (o.set) apply(st, o.set);
    st.i++;
    if (o.go) { st.sc = o.go; st.i = 0; }
    return o.t;
  }

  function atChoice(st) {
    var c = cur(st);
    return !!(c && typeof c === 'object' && c.q);
  }

  root.Core = {
    fresh: fresh, step: step, choose: choose, test: test, apply: apply,
    val: val, parseLine: parseLine, atChoice: atChoice
  };
})(typeof window !== 'undefined' ? window : globalThis);
