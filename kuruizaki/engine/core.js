/* ADV エンジン：シナリオの解析と進行（DOM に依存しない。ブラウザと node の両方で動く） */
(function (root) {
  'use strict';

  var Core = {};
  var files = {};
  var records = {};
  Core.files = files;
  Core.records = records;

  function cfg() { return root.ADV_CONFIG || {}; }
  Core.config = cfg;

  /* ---------- 設定の点検 ---------- */

  Core.checkConfig = function (c) {
    c = c || cfg();
    var err = [];
    if (!root.ADV_CONFIG) { err.push('設定ファイル（game/config.js）が読み込まれていません。'); return err; }
    if (typeof c.id !== 'string' || !c.id.trim()) err.push('作品ID（game/config.js の id）が設定されていません。作品ごとに別の ID を決めてください。');
    else if (!/^[A-Za-z0-9_-]+$/.test(c.id)) err.push('作品ID は英数字・ハイフン・下線だけで書いてください：' + c.id);
    if (!Array.isArray(c.files) || !c.files.length) err.push('files（読み込むシナリオファイルの一覧）が空です。');
    if (!c.endings || !c.endings.main || !Object.keys(c.endings.main).length) err.push('endings.main（本編エンディング）が空です。');
    if (c.vars) Object.keys(c.vars).forEach(function (v) {
      if (!/^[A-Za-z_]\w*$/.test(v)) err.push('パラメータ名が不正です：' + v);
    });
    return err;
  };

  Core.storagePrefix = function () {
    var c = cfg();
    if (typeof c.id !== 'string' || !c.id.trim()) throw new Error('作品ID が未設定です');
    return c.id + '.';
  };

  /* ---------- パラメータ ---------- */

  function varNames() { return Object.keys(cfg().vars || {}); }
  Core.varNames = varNames;

  function clampVar(name, n) {
    var d = (cfg().vars || {})[name] || {};
    if (typeof d.min === 'number' && n < d.min) n = d.min;
    if (typeof d.max === 'number' && n > d.max) n = d.max;
    return n;
  }

  function setVar(st, name, n, hooks) {
    var prev = st.vars[name] || 0;
    var v = clampVar(name, n);
    st.vars[name] = v;
    if (v !== prev && hooks && hooks.param) hooks.param(name, v, prev, st);
  }
  Core.setVar = setVar;

  /* ---------- 命令 ---------- */

  var BUILTIN = ['title', 'page', 'set', 'goto', 'next', 'end', 'vis', 'fx', 'bgm', 'mark', 'record'];
  function known(cmd) {
    return BUILTIN.indexOf(cmd) >= 0 || (cfg().commands || []).indexOf(cmd) >= 0;
  }

  /* ---------- 解析 ---------- */

  function parseEffect(t, where) {
    var m;
    if ((m = /^([A-Za-z_]\w*)$/.exec(t))) return { v: m[1], op: '+', n: 1 };
    if ((m = /^([A-Za-z_]\w*)([+-])(\d+)$/.exec(t))) return { v: m[1], op: m[2], n: Number(m[3]) };
    if ((m = /^([A-Za-z_]\w*)=(-?\d+)$/.exec(t))) return { v: m[1], op: '=', n: Number(m[2]) };
    throw new Error('効果の書式エラー: ' + t + ' @ ' + where);
  }

  function parseOption(line, where) {
    // + 効果 > 飛び先 | 文面
    var body = line.replace(/^\s*\+\s*/, '');
    var bar = body.indexOf('|');
    if (bar < 0) throw new Error('選択肢の書式エラー（| がありません）: ' + where);
    var head = body.slice(0, bar).trim();
    var text = body.slice(bar + 1).trim();
    var gt = head.indexOf('>');
    if (gt < 0) throw new Error('選択肢の飛び先がありません: ' + where);
    var tokens = head.slice(0, gt).trim().split(/\s+/).filter(function (t) { return t && t !== '-'; });
    var target = head.slice(gt + 1).trim();
    if (!target) throw new Error('選択肢の飛び先が空です: ' + where);
    if (!text) throw new Error('選択肢の文面が空です: ' + where);
    var eff = [], tags = [];
    tokens.forEach(function (t) {
      if (t[0] === '#') tags.push(t.slice(1));
      else {
        var e = parseEffect(t, where);
        if (varNames().indexOf(e.v) < 0) throw new Error('設定にないパラメータ: ' + e.v + ' @ ' + where);
        eff.push(e);
      }
    });
    return { text: text, target: target, eff: eff, tags: tags };
  }

  function parse(name, src) {
    var code = [], labels = {}, stack = [];
    var lines = src.split(/\r?\n/);
    var i = 0, choiceNo = 0, ids = {};
    function where() { return name + ' 行' + i; }
    function top() {
      if (!stack.length) throw new Error('@if がありません: ' + where());
      return stack[stack.length - 1];
    }
    while (i < lines.length) {
      var raw = lines[i++];
      var s = raw.trim();
      if (!s || s.indexOf('//') === 0) continue;
      if (s[0] === '*') {
        var lb = s.slice(1).trim();
        if (!lb) throw new Error('ラベル名が空です: ' + where());
        if (labels[lb] !== undefined) throw new Error('ラベル重複: ' + name + ':' + lb);
        labels[lb] = code.length;
        continue;
      }
      if (s[0] === '+') throw new Error('@choice の外に選択肢があります: ' + where());
      if (s[0] === '@') {
        var sp = s.search(/\s/);
        var cmd = sp < 0 ? s.slice(1) : s.slice(1, sp);
        var arg = sp < 0 ? '' : s.slice(sp + 1).trim();
        var t, j, ins;
        switch (cmd) {
          case 'if':
            if (!arg) throw new Error('@if の条件が空です: ' + where());
            checkCond(arg, where());
            ins = { t: 'jf', cond: arg, to: -1, line: i };
            code.push(ins);
            stack.push({ jf: ins, ends: [], line: i });
            break;
          case 'elif':
            t = top();
            if (!t.jf) throw new Error('@else の後に @elif があります: ' + where());
            checkCond(arg, where());
            j = { t: 'jmp', to: -1, line: i };
            code.push(j); t.ends.push(j);
            t.jf.to = code.length;
            ins = { t: 'jf', cond: arg, to: -1, line: i };
            code.push(ins); t.jf = ins;
            break;
          case 'else':
            t = top();
            if (!t.jf) throw new Error('@else が二つあります: ' + where());
            j = { t: 'jmp', to: -1, line: i };
            code.push(j); t.ends.push(j);
            t.jf.to = code.length; t.jf = null;
            break;
          case 'endif':
            t = stack.pop();
            if (!t) throw new Error('@endif が余っています: ' + where());
            if (t.jf) t.jf.to = code.length;
            t.ends.forEach(function (e) { e.to = code.length; });
            break;
          case 'choice':
            var opts = [], at = i;
            while (i < lines.length && /^\s*\+/.test(lines[i])) {
              opts.push(parseOption(lines[i], name + ' 行' + (i + 1)));
              i++;
            }
            if (!opts.length) throw new Error('選択肢が空です: ' + name + ' 行' + at);
            choiceNo++;
            var id = name + '-' + (arg || ('c' + choiceNo));
            if (ids[id]) throw new Error('選択肢の ID が重複しています: ' + id);
            ids[id] = 1;
            code.push({ t: 'choice', opts: opts, id: id, line: at });
            break;
          default:
            if (!known(cmd)) throw new Error('不明な命令 @' + cmd + '（作品独自の命令は config.commands に書いてください）: ' + where());
            code.push({ t: 'cmd', cmd: cmd, arg: arg, line: i });
        }
        continue;
      }
      if (s[0] === '\\') s = s.slice(1); // 行頭の @ * + // を文として書きたいとき
      code.push({ t: 'text', s: s, line: i });
    }
    if (stack.length) throw new Error('@endif が足りません（' + name + ' 行' + stack[stack.length - 1].line + ' の @if）');
    code.push({ t: 'cmd', cmd: 'eof', arg: '', line: i });
    return { name: name, code: code, labels: labels };
  }

  Core.add = function (name, src) {
    if (files[name]) throw new Error('シナリオファイルの名前が重複しています: ' + name);
    files[name] = parse(name, src);
  };

  Core.addRecords = function (obj) {
    Object.keys(obj).forEach(function (k) {
      if (!/^r\d+$/.test(k)) throw new Error('記録の識別子は r01 のような記号にしてください: ' + k);
      records[k] = obj[k];
    });
  };
  Core.recordIds = function () { return Object.keys(records).sort(); };

  /* ---------- 条件式 ---------- */

  var condCache = {};
  function compile(cond) {
    var names = varNames();
    var js = cond.replace(/\b[A-Za-z_]\w*\b/g, function (w) {
      if (names.indexOf(w) < 0) throw new Error('条件式に設定にない名前があります: ' + w);
      return 'v.' + w;
    });
    if (/[^\s\d<>=!&|()+\-*]/.test(js.replace(/v\.[A-Za-z_]\w*/g, ''))) throw new Error('条件式に使えない文字があります');
    return new Function('v', 'return !!(' + js + ');');
  }
  function checkCond(cond, where) {
    try { condCache[cond] = condCache[cond] || compile(cond); }
    catch (e) { throw new Error(e.message + '：' + cond + ' @ ' + where); }
  }
  function evalCond(cond, vars) {
    var fn = condCache[cond] || (condCache[cond] = compile(cond));
    return fn(vars);
  }
  Core.evalCond = evalCond;

  /* ---------- 状態 ---------- */

  Core.newState = function (name) {
    var c = cfg(), vars = {};
    varNames().forEach(function (v) { vars[v] = (c.vars[v] && c.vars[v].init) || 0; });
    return { file: c.start || c.files[0], pc: 0, name: name || '', vars: vars, vis: { chap: '' }, page: [] };
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

  Core.subst = function (s, st) { return s.replace(/\{name\}/g, st.name); };

  /* 既読の判定に使う鍵：ファイル名と文面から作る（行を足しても既読がずれない） */
  Core.lineKey = function (file, s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return file + ':' + h.toString(36);
  };

  /* 次に止まる地点まで進める。
     戻り値：{type:'text', ins, key} / {type:'choice', ins} / {type:'end', ed}
     hooks（どれも省略可）：
       cmd(cmd, arg, st)            … 画面効果などの命令
       chapter(file, st)             … 別のファイルに移ったとき
       param(name, value, prev, st)  … パラメータが変わったとき */
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
          return { type: 'text', ins: ins, key: Core.lineKey(st.file, ins.s) };
        case 'choice':
          return { type: 'choice', ins: ins };
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
            var moved = r.file !== st.file;
            st.file = r.file; st.pc = r.pc;
            if (moved && hooks.chapter) hooks.chapter(r.file, st);
            break;
          }
          if (c === 'end') { st.pc++; return { type: 'end', ed: a }; }
          if (c === 'eof') throw new Error('本文が途切れています（@next / @goto / @end がありません）: ' + st.file);
          if (c === 'set') {
            var m = /^([A-Za-z_]\w*)\s*(\+=|-=|=)\s*(-?\d+)$/.exec(a);
            if (!m) throw new Error('@set の書式エラー: ' + a + ' @ ' + st.file + ' 行' + ins.line);
            var cur = st.vars[m[1]] || 0, n = Number(m[3]);
            setVar(st, m[1], m[2] === '=' ? n : m[2] === '+=' ? cur + n : cur - n, hooks);
          } else if (c === 'title') {
            st.vis.chap = a.split('|')[0];
          } else if (c === 'page') {
            st.page = [];
          } else if (c === 'vis') {
            var sp = a.search(/\s/);
            var key = sp < 0 ? a : a.slice(0, sp), val = sp < 0 ? '' : a.slice(sp + 1).trim();
            if (!/^[A-Za-z][\w-]*$/.test(key) || key === 'chap') throw new Error('@vis の名前が不正です: ' + a);
            st.vis[key] = val;
          }
          st.pc++;
          if (hooks.cmd) hooks.cmd(c, a, st);
          break;
        default:
          throw new Error('不明な命令');
      }
    }
  };

  function applyEffect(st, e, hooks) {
    var cur = st.vars[e.v] || 0;
    setVar(st, e.v, e.op === '+' ? cur + e.n : e.op === '-' ? cur - e.n : e.n, hooks);
  }

  Core.choose = function (st, idx, hooks) {
    var ins = files[st.file].code[st.pc];
    if (!ins || ins.t !== 'choice') throw new Error('選択肢ではありません');
    var o = ins.opts[idx];
    if (!o) throw new Error('選択肢の番号が範囲外です: ' + ins.id + '#' + idx);
    o.eff.forEach(function (e) { applyEffect(st, e, hooks); });
    var r = resolve(o.target, st.file);
    var moved = r.file !== st.file;
    st.file = r.file; st.pc = r.pc;
    if (moved && hooks && hooks.chapter) hooks.chapter(r.file, st);
    return o;
  };

  Core.advance = function (st) { st.pc++; };

  /* ---------- エンディング ---------- */

  Core.mainEnds = function () { return Object.keys((cfg().endings || {}).main || {}); };
  Core.extraEnds = function () { return Object.keys((cfg().endings || {}).extra || {}); };
  Core.allEnds = function () { return Core.mainEnds().concat(Core.extraEnds()); };
  Core.endTitle = function (ed) {
    var e = cfg().endings || {};
    return (e.main && e.main[ed]) || (e.extra && e.extra[ed]) || ed;
  };
  Core.extraUnlocked = function (got) {
    var rule = (cfg().endings || {}).extraUnlock || 'all-main';
    var need = rule === 'all-main' ? Core.mainEnds() : rule;
    if (typeof rule === 'function') return !!rule(got || {});
    return need.every(function (e) { return !!(got && got[e]); });
  };

  /* ファイルの種類：'main'（本編）/ 'ending' / 'extra'（追加エンディング） */
  Core.kind = function (name) {
    if (Core.extraEnds().indexOf(name) >= 0) return 'extra';
    if (Core.mainEnds().indexOf(name) >= 0) return 'ending';
    return 'main';
  };

  /* 本文の文字数（空白を除く。{name} は 2 字として数える） */
  Core.countText = function (name) {
    var F = files[name], n = 0;
    var norm = function (s) { return s.replace(/\{name\}/g, '○○').replace(/\s/g, '').length; };
    F.code.forEach(function (ins) {
      if (ins.t === 'text') n += norm(ins.s);
      if (ins.t === 'choice') ins.opts.forEach(function (o) { n += norm(o.text); });
    });
    return n;
  };

  root.ADV = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
