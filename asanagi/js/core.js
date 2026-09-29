/* 本文データの読み込みと進行（DOM に依存しない部分） */
(function (root) {
  'use strict';

  var Core = {};
  var files = {};
  Core.files = files;

  var VAR_NAMES = ['p1', 'p2', 'p3', 'p4', 'f1', 'f2'];
  Core.VAR_NAMES = VAR_NAMES;
  Core.MAIN_ENDS = ['ed01', 'ed02', 'ed03', 'ed04', 'ed05', 'ed06'];
  Core.EXTRA_ENDS = ['ed07', 'ed08'];
  Core.ALL_ENDS = Core.MAIN_ENDS.concat(Core.EXTRA_ENDS);
  Core.P4_MAX = 5;

  /* ---------- 解析 ---------- */

  function parseOption(line, where) {
    // + 効果 > 飛び先 | 文面
    var body = line.replace(/^\s*\+\s*/, '');
    var bar = body.indexOf('|');
    if (bar < 0) throw new Error('選択肢の書式エラー: ' + where);
    var head = body.slice(0, bar).trim();
    var text = body.slice(bar + 1).trim();
    var gt = head.indexOf('>');
    if (gt < 0) throw new Error('選択肢の飛び先がありません: ' + where);
    var effTokens = head.slice(0, gt).trim().split(/\s+/).filter(function (t) { return t && t !== '-'; });
    var target = head.slice(gt + 1).trim();
    var eff = [], tags = [];
    effTokens.forEach(function (t) {
      var m;
      if ((m = /^(p\d)$/.exec(t))) eff.push({ v: m[1], op: '+', n: 1 });
      else if ((m = /^(\w+)=(\d+)$/.exec(t))) eff.push({ v: m[1], op: '=', n: Number(m[2]) });
      else if (t[0] === '#') tags.push(t.slice(1));
      else throw new Error('効果の書式エラー: ' + t + ' @ ' + where);
    });
    return { text: text, target: target, eff: eff, tags: tags };
  }

  function parse(name, src) {
    var code = [], labels = {}, stack = [];
    var lines = src.split(/\r?\n/);
    var i = 0, choiceNo = 0;
    function top() {
      if (!stack.length) throw new Error('@if がありません: ' + name + ' 行' + i);
      return stack[stack.length - 1];
    }
    while (i < lines.length) {
      var raw = lines[i++];
      var s = raw.trim();
      if (!s || s.indexOf('//') === 0) continue;
      if (s[0] === '*') {
        var lb = s.slice(1).trim();
        if (labels[lb] !== undefined) throw new Error('ラベル重複: ' + name + ':' + lb);
        labels[lb] = code.length;
        continue;
      }
      if (s[0] === '@') {
        var sp = s.search(/\s/);
        var cmd = sp < 0 ? s.slice(1) : s.slice(1, sp);
        var arg = sp < 0 ? '' : s.slice(sp + 1).trim();
        var t, j, ins;
        switch (cmd) {
          case 'if':
            ins = { t: 'jf', cond: arg, to: -1, line: i };
            code.push(ins);
            stack.push({ jf: ins, ends: [] });
            break;
          case 'elif':
            t = top();
            j = { t: 'jmp', to: -1 };
            code.push(j); t.ends.push(j);
            t.jf.to = code.length;
            ins = { t: 'jf', cond: arg, to: -1, line: i };
            code.push(ins); t.jf = ins;
            break;
          case 'else':
            t = top();
            j = { t: 'jmp', to: -1 };
            code.push(j); t.ends.push(j);
            t.jf.to = code.length; t.jf = null;
            break;
          case 'endif':
            t = stack.pop();
            if (!t) throw new Error('@endif が余っています: ' + name + ' 行' + i);
            if (t.jf) t.jf.to = code.length;
            t.ends.forEach(function (e) { e.to = code.length; });
            break;
          case 'choice':
            var opts = [];
            while (i < lines.length && /^\s*\+/.test(lines[i])) {
              opts.push(parseOption(lines[i], name + ' 行' + (i + 1)));
              i++;
            }
            if (!opts.length) throw new Error('選択肢が空です: ' + name + ' 行' + i);
            choiceNo++;
            code.push({ t: 'choice', opts: opts, id: name + '-c' + choiceNo, line: i });
            break;
          default:
            code.push({ t: 'cmd', cmd: cmd, arg: arg, line: i });
        }
        continue;
      }
      var tint = false;
      if (s[0] === '~') { tint = true; s = s.slice(1).trim(); }
      code.push({ t: 'text', s: s, tint: tint, line: i });
    }
    if (stack.length) throw new Error('@endif が足りません: ' + name);
    code.push({ t: 'cmd', cmd: 'eof', arg: '' });
    return { name: name, code: code, labels: labels };
  }

  Core.add = function (name, src) { files[name] = parse(name, src); };

  /* ---------- 状態 ---------- */

  Core.newState = function (name) {
    var vars = {};
    VAR_NAMES.forEach(function (v) { vars[v] = 0; });
    return {
      file: 'ch01', pc: 0, name: name || '',
      vars: vars,
      vis: { wave: '0', crew: '7', bgA: 'off', bgB: 'off', dim: 'off', alert: 'off', chap: '' },
      page: []
    };
  };

  Core.clone = function (st) { return JSON.parse(JSON.stringify(st)); };

  function resolve(target, curFile) {
    var f = curFile, lb = target;
    if (target.indexOf(':') >= 0) { f = target.split(':')[0]; lb = target.split(':')[1]; }
    else if (files[target] && !(files[curFile] && files[curFile].labels[target] !== undefined)) { f = target; lb = null; }
    var F = files[f];
    if (!F) throw new Error('ファイルがありません: ' + f);
    var pc = 0;
    if (lb) {
      if (F.labels[lb] === undefined) throw new Error('ラベルがありません: ' + f + ':' + lb);
      pc = F.labels[lb];
    }
    return { file: f, pc: pc };
  }
  Core.resolve = resolve;

  var condCache = {};
  function evalCond(cond, vars) {
    var fn = condCache[cond];
    if (!fn) {
      var js = cond.replace(/\b(p\d|f\d)\b/g, 'v.$1');
      if (/[^\sv.\dpf<>=!&|()]/.test(js.replace(/v\.(p|f)\d/g, ''))) throw new Error('条件式エラー: ' + cond);
      fn = condCache[cond] = new Function('v', 'return !!(' + js + ');');
    }
    return fn(vars);
  }
  Core.evalCond = evalCond;

  Core.subst = function (s, st) {
    return s.replace(/\{name\}/g, st.name);
  };

  /* 次に止まる地点まで進める。
     戻り値：{type:'text', ins} / {type:'choice', ins} / {type:'end', ed}
     hooks.cmd(cmd, arg, st) は画面効果の通知（無くてもよい） */
  var PERSIST = { wave: 1, crew: 1, bgA: 1, bgB: 1, dim: 1, alert: 1 };
  Core.run = function (st, hooks) {
    hooks = hooks || {};
    var guard = 0;
    for (;;) {
      if (++guard > 100000) throw new Error('無限ループ: ' + st.file + ':' + st.pc);
      var F = files[st.file];
      if (!F) throw new Error('ファイルがありません: ' + st.file);
      var ins = F.code[st.pc];
      if (!ins) throw new Error('範囲外: ' + st.file + ':' + st.pc);
      switch (ins.t) {
        case 'text':
          return { type: 'text', ins: ins, key: st.file + ':' + st.pc };
        case 'choice':
          return { type: 'choice', ins: ins, key: st.file + ':' + st.pc };
        case 'jf':
          if (evalCond(ins.cond, st.vars)) st.pc++; else st.pc = ins.to;
          break;
        case 'jmp':
          st.pc = ins.to;
          break;
        case 'cmd':
          var c = ins.cmd, a = ins.arg;
          if (c === 'goto' || c === 'next') {
            var r = resolve(a, st.file);
            st.file = r.file; st.pc = r.pc;
            if (hooks.cmd) hooks.cmd('goto', r.file, st);
            break;
          }
          if (c === 'end') {
            st.pc++;
            return { type: 'end', ed: a };
          }
          if (c === 'eof') throw new Error('本文が途切れています: ' + st.file);
          if (c === 'set') {
            var m = /^(\w+)\s*(\+=|=)\s*(\d+)$/.exec(a);
            if (!m) throw new Error('@set 書式: ' + a);
            st.vars[m[1]] = m[2] === '=' ? Number(m[3]) : (st.vars[m[1]] || 0) + Number(m[3]);
            if (m[1] === 'p4' && st.vars.p4 > Core.P4_MAX) st.vars.p4 = Core.P4_MAX;
          } else if (PERSIST[c]) {
            st.vis[c] = a;
          } else if (c === 'title') {
            st.vis.chap = a.split('|')[0];
          } else if (c === 'page') {
            st.page = [];
          }
          st.pc++;
          if (hooks.cmd) hooks.cmd(c, a, st);
          break;
        default:
          throw new Error('不明な命令');
      }
    }
  };

  Core.choose = function (st, idx) {
    var F = files[st.file];
    var ins = F.code[st.pc];
    if (!ins || ins.t !== 'choice') throw new Error('選択肢ではありません');
    var o = ins.opts[idx];
    o.eff.forEach(function (e) {
      if (e.op === '+') st.vars[e.v] = (st.vars[e.v] || 0) + e.n;
      else st.vars[e.v] = e.n;
    });
    if (st.vars.p4 > Core.P4_MAX) st.vars.p4 = Core.P4_MAX;
    var r = resolve(o.target, st.file);
    st.file = r.file; st.pc = r.pc;
    return o;
  };

  Core.advance = function (st) { st.pc++; };

  Core.extraUnlocked = function (got) {
    return Core.MAIN_ENDS.every(function (e) { return !!(got && got[e]); });
  };

  /* 本文の文字数（空白を除く） */
  Core.countText = function (name) {
    var F = files[name], n = 0;
    F.code.forEach(function (ins) {
      if (ins.t === 'text') n += ins.s.replace(/\s/g, '').length;
      if (ins.t === 'choice') ins.opts.forEach(function (o) { n += o.text.replace(/\s/g, '').length; });
    });
    return n;
  };

  root.ASANAGI = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
