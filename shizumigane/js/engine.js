/* engine.js — 画面・入力・セーブ */
(function () {
  'use strict';
  var Core = window.Core, SZ = window.SZ, Snd = window.Snd;
  var DEBUG = /[?&]debug=1(?:&|$)/.test(location.search);

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  /* ---------- 保存（失敗しても遊べるように全部 try/catch） ---------- */
  var PFX = 'szg_';
  function sget(k, d) {
    try { var v = localStorage.getItem(PFX + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  }
  function sset(k, v) {
    try { localStorage.setItem(PFX + k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  var SPD = [55, 30, 14, 0];
  var SPD_L = ['遅い', '普通', '速い', '瞬時'];
  var cfg = sget('cfg', null) || {};
  if (!(cfg.spd >= 0 && cfg.spd <= 3)) cfg.spd = 1;
  cfg.snd = !!cfg.snd;
  Snd.set(cfg.snd);
  var rec = sget('rec', null) || {};
  rec.e = rec.e || {}; rec.x = rec.x || {};
  var seen = sget('r', null) || {};
  var seenDirty = 0;

  var el = {
    app: $('app'), tt: $('tt'), nx: $('nx'), pl: $('pl'),
    tx: $('tx'), op: $('op'), mn: $('mn'), cue: $('cue'), rs: $('rs'), plate: $('plate'),
    lv: $('lv'), cd: $('cd'), cdL: $('cd-l'), cdT: $('cd-t'), ov: $('ov'), pn: $('pn'),
    pnIn: document.querySelector('#pn .pn-in'), skip: $('b-skip'), sndV: $('snd-v'),
    cont: $('b-cont'), nxF: $('nx-f'), nxI: $('nx-i'), nxD: $('nx-d')
  };

  var run = null;       // { st, pg, chSnap, qSnap }
  var mode = 'title';   // title | name | type | wait | busy | choice | card | over
  var screen = 'tt';
  var typing = null;
  var skip = false;
  var log = [];
  var timer = null;
  var cardTimer = null;

  function sub(s) { return String(s).replace(/\{n\}/g, run ? run.st.nm : ''); }

  /* ---------- 画面切り替え ---------- */
  function show(id) {
    ['tt', 'nx', 'pl'].forEach(function (k) { el[k].hidden = (k !== id); });
    screen = id;
  }

  function toTitle() {
    clearTimeout(timer); clearTimeout(cardTimer);
    stopTyping();
    setSkip(false);
    flushSeen();
    run = null;
    mode = 'title';
    el.ov.hidden = true; el.cd.hidden = true;
    closePanel();
    setWater(0, true);
    el.app.classList.remove('fl', 'bk');
    el.app.removeAttribute('data-e');
    el.cont.disabled = !hasSave();
    el.sndV.textContent = cfg.snd ? 'ON' : 'OFF';
    show('tt');
  }

  function hasSave() {
    return ['auto', 's1', 's2', 's3'].some(function (k) { return !!sget(k, null); });
  }

  function toName() {
    mode = 'name';
    el.nxD.textContent = SZ.meta.defName;
    el.nxI.value = '';
    el.nxI.placeholder = SZ.meta.defName;
    show('nx');
    setTimeout(function () { try { el.nxI.focus(); } catch (e) {} }, 50);
  }

  function cleanName(s) {
    s = String(s || '').replace(/[\u0000-\u001f{}\[\]<>]/g, '').trim();
    return s ? Array.from(s).slice(0, 8).join('') : SZ.meta.defName;
  }

  function startNew(nm) {
    run = { st: Core.fresh(cleanName(nm)), pg: [], chSnap: null, qSnap: null };
    log = [];
    enterPlay();
    next();
  }

  function enterPlay() {
    show('pl');
    el.ov.hidden = true;
    el.op.hidden = true; el.op.innerHTML = '';
    el.app.classList.remove('fl', 'bk');
    el.app.removeAttribute('data-e');
    renderRoster(null);
    setWater(run.st.lv, true);
    setPlate();
    renderPage();
  }

  /* ---------- 進行 ---------- */
  function next() {
    if (!run) return;
    clearTimeout(timer);
    for (var guard = 0; guard < 1000; guard++) {
      var ev;
      try { ev = Core.step(run.st); } catch (e) { ev = { t: 'err', msg: String(e) }; }
      switch (ev.t) {
        case 'ln': return showLine(ev);
        case 'clr': clearPage(); continue;
        case 'lv': setWater(ev.n, false); continue;
        case 'fx':
          if (fx(ev.fx)) { mode = 'busy'; timer = setTimeout(next, skip ? 120 : 1000); return; }
          continue;
        case 'wait': mode = 'busy'; timer = setTimeout(next, skip ? 60 : ev.ms); return;
        case 'ab': return stampMember(ev.id);
        case 'rk': return annotateMember(ev.id);
        case 'ch': return chapterCard(ev.id);
        case 'q': return showChoice(ev);
        case 'dead': return showDead(ev.id);
        case 'end': return showEnd(ev.id);
        case 'miss': return showMiss();
        default:
          if (window.console) console.error(ev.msg);
          return showMiss();
      }
    }
  }

  function advance() {
    if (mode === 'type' && typing) { typing.finish(); return; }
    if (mode === 'wait') { cue(false); mode = 'busy'; next(); return; }
    if (mode === 'card') hideCard();
  }

  function cue(on) { el.cue.classList.toggle('on', !!on); }

  function markSeen(key) {
    if (seen[key]) return;
    seen[key] = 1;
    if (++seenDirty >= 12) flushSeen();
  }
  function flushSeen() {
    if (!seenDirty) return;
    seenDirty = 0;
    sset('r', seen);
  }

  function pushLog(k, s) {
    log.push({ k: k, s: s });
    if (log.length > 80) log.shift();
  }

  function clearPage() {
    stopTyping();
    el.tx.innerHTML = '';
    if (run) run.pg = [];
  }

  function renderPage() {
    el.tx.innerHTML = '';
    run.pg.forEach(function (p) { lineEl(p.k, sub(p.s), true); });
    scrollDown();
  }

  function scrollDown() { el.mn.scrollTop = el.mn.scrollHeight; }

  function showLine(ev) {
    var wasSeen = !!seen[ev.key];
    markSeen(ev.key);
    run.pg.push({ k: ev.k, s: ev.s });
    var s = sub(ev.s);
    pushLog(ev.k, s);
    if (skip && !wasSeen) setSkip(false);
    mode = 'type';
    lineEl(ev.k, s, skip && wasSeen, function () {
      if (ev.k === 'e') { mode = 'busy'; next(); return; }
      mode = 'wait';
      cue(true);
      if (skip) timer = setTimeout(function () { if (skip && mode === 'wait') advance(); }, 45);
    });
  }

  function stopTyping() {
    if (typing) { var t = typing; typing = null; t.kill(); }
  }

  // 行を 1 つ描く。instant でなければ 1 文字ずつ
  function lineEl(k, s, instant, done) {
    var p = mk('p', 'ln ln-' + k);
    if (k === 'f' && s.charAt(0) === '▷') p.classList.add('ln-b');
    el.tx.appendChild(p);
    var ms = SPD[cfg.spd];
    if (k === 'd') return callLine(p, s, instant, ms, done);
    if (k === 'c' && !instant && !reduced()) p.classList.add('shv');
    if (instant || ms === 0) {
      p.textContent = s;
      scrollDown();
      if (done) done();
      return p;
    }
    var chars = Array.from(s), n = 0, tn = document.createTextNode('');
    p.appendChild(tn);
    var tm = setInterval(function () {
      n += (chars[n] === '\n') ? 2 : 1;
      tn.data = chars.slice(0, n).join('');
      scrollDown();
      if (n >= chars.length) fin();
    }, ms);
    function fin() {
      clearInterval(tm);
      tn.data = s;
      typing = null;
      scrollDown();
      if (done) done();
    }
    typing = { finish: fin, kill: function () { clearInterval(tm); } };
    return p;
  }

  // にじんで出る行。[[ ]] の中は別の色
  function callLine(p, s, instant, ms, done) {
    var parts = s.split(/(\[\[.*?\]\])/), i = 0;
    var per = Math.max(ms, 12) * 3;
    parts.forEach(function (part) {
      if (!part) return;
      var nm = /^\[\[(.*)\]\]$/.exec(part);
      var box = nm ? mk('span', 'nm') : p;
      if (nm) p.appendChild(box);
      Array.from(nm ? nm[1] : part).forEach(function (ch) {
        if (ch === '\n') { box.appendChild(document.createElement('br')); return; }
        var c = mk('span', 'cc', ch);
        c.style.animationDelay = (i++ * per) + 'ms';
        box.appendChild(c);
      });
    });
    function fin() {
      clearTimeout(tm);
      p.classList.add('now');
      typing = null;
      scrollDown();
      if (done) done();
    }
    if (instant || ms === 0) { p.classList.add('now'); scrollDown(); if (done) done(); return p; }
    var tm = setTimeout(fin, i * per + 900);
    typing = { finish: fin, kill: function () { clearTimeout(tm); } };
    scrollDown();
    return p;
  }

  /* ---------- 選択肢 ---------- */
  function showChoice(ev) {
    setSkip(false);
    run.qSnap = snap();
    autosave();
    flushSeen();
    mode = 'choice';
    cue(false);
    el.op.innerHTML = '';
    el.op._opts = ev.opts;
    ev.opts.forEach(function (o, i) {
      var b = mk('button', 'op');
      b.type = 'button';
      b.appendChild(mk('span', 'op-n', String(i + 1)));
      b.appendChild(mk('span', 'op-t', sub(o.s)));
      b.addEventListener('click', function (e) { e.stopPropagation(); pick(o.n); });
      el.op.appendChild(b);
    });
    el.op.hidden = false;
    scrollDown();
    if (DEBUG && window.SZG_DEV) window.SZG_DEV.update();
  }

  function pick(n) {
    if (mode !== 'choice') return;
    Snd.tick();
    var s;
    try { s = Core.choose(run.st, n); } catch (e) { return; }
    el.op.hidden = true; el.op.innerHTML = '';
    run.pg.push({ k: 'b', s: s });
    pushLog('b', sub(s));
    lineEl('b', sub(s), true);
    mode = 'busy';
    if (DEBUG && window.SZG_DEV) window.SZG_DEV.update();
    timer = setTimeout(next, 250);
  }

  function focusOp(d) {
    var bs = Array.prototype.slice.call(el.op.querySelectorAll('button'));
    if (!bs.length) return;
    var i = bs.indexOf(document.activeElement);
    i = i < 0 ? (d > 0 ? 0 : bs.length - 1) : (i + d + bs.length) % bs.length;
    bs[i].focus();
  }

  /* ---------- 章題 ---------- */
  function chapterCard(id) {
    var c = SZ.ch[id] || {};
    setSkip(false);
    clearPage();
    setPlate();
    setWater(run.st.lv, false);
    run.chSnap = snap();
    autosave();
    flushSeen();
    el.cdL.textContent = c.label || '';
    el.cdT.textContent = c.title || '';
    el.cd.hidden = false;
    el.cd.classList.remove('out');
    mode = 'card';
    clearTimeout(cardTimer);
    cardTimer = setTimeout(hideCard, 3200);
    if (DEBUG && window.SZG_DEV) window.SZG_DEV.update();
  }

  function hideCard() {
    if (mode !== 'card') return;
    clearTimeout(cardTimer);
    mode = 'busy';
    el.cd.classList.add('out');
    timer = setTimeout(function () {
      el.cd.hidden = true;
      next();
    }, reduced() ? 50 : 600);
  }

  function setPlate() {
    var c = run && SZ.ch[run.st.ch];
    el.plate.textContent = c ? c.title : '';
    el.plate.hidden = !c;
  }

  /* ---------- 状態欄 ---------- */
  function renderRoster(fresh) {
    el.rs.innerHTML = '';
    SZ.meta.members.forEach(function (m, i) {
      var li = mk('li', 'rr');
      li.setAttribute('data-i', String(i));
      li.appendChild(mk('span', 'rr-no', String(i + 1)));
      var full = m.full || run.st.nm;
      var short = m.short || Array.from(run.st.nm).slice(0, 4).join('');
      li.appendChild(mk('span', 'rr-f', full));
      li.appendChild(mk('span', 'rr-s', short));
      var st = mk('i', 'rr-st', '欠');
      st.setAttribute('aria-hidden', 'true');
      li.appendChild(st);
      var rk = (run.st.rk || {})[m.id] || {};
      var label = full;
      if (run.st.ab.indexOf(m.id) >= 0) {
        li.classList.add('ab');
        if (m.id === fresh) li.classList.add('ab-new');
        label += '　欠';
      }
      if (rk.x) {
        var ln = mk('i', 'rr-ln');
        ln.setAttribute('aria-hidden', 'true');
        li.appendChild(ln);
        li.classList.add('sk');
        label += '　線';
      }
      if (rk.o) {
        var ok = mk('i', 'rr-ok', '出');
        ok.setAttribute('aria-hidden', 'true');
        li.appendChild(ok);
        li.classList.add('ok');
        label += '　出';
      }
      if (rk.nt) {
        li.appendChild(mk('span', 'rr-nt', rk.nt));
        label += '（' + rk.nt + '）';
      }
      if (m.id === fresh && (rk.x || rk.o || rk.nt)) li.classList.add('rk-new');
      li.setAttribute('aria-label', label);
      el.rs.appendChild(li);
    });
  }

  function stampMember(id) {
    renderRoster(id);
    mode = 'busy';
    var slow = !(skip || reduced());
    setTimeout(function () { Snd.stamp(); }, slow ? 520 : 0);
    timer = setTimeout(next, slow ? 1500 : 200);
  }

  // 状態欄への書き込み（線・出の印・添え書き）
  function annotateMember(id) {
    renderRoster(id);
    mode = 'busy';
    var slow = !(skip || reduced());
    if (slow) setTimeout(function () { Snd.tick(); }, 300);
    timer = setTimeout(next, slow ? 1100 : 150);
  }

  /* ---------- 水位・演出 ---------- */
  function setWater(n, instant) {
    n = Math.max(0, Math.min(100, +n || 0));
    if (instant) el.app.classList.add('lv-now');
    document.documentElement.style.setProperty('--lv', n + 'vh');
    el.lv.classList.toggle('on', n > 0);
    el.app.classList.toggle('lv-hi', n > 40);
    if (instant) setTimeout(function () { el.app.classList.remove('lv-now'); }, 60);
  }

  // true を返したら少し間を置く
  function fx(name) {
    switch (name) {
      case 'bell': Snd.bell(3); shake(); return true;
      case 'bell1': Snd.bell(1); shake(); return true;
      case 'far': Snd.far(); return false;
      case 'shake': shake(); return false;
      case 'splash': Snd.splash(); return false;
      case 'drip': Snd.drip(); return false;
      case 'dark': flash('dk', 1600); return false;
      case 'bellw': Snd.muffled(); return false;
      case 'flood': el.app.classList.add('fl'); return true;
      case 'black': el.app.classList.add('bk'); return true;
    }
    return false;
  }

  function shake() {
    if (skip) return;
    flash(reduced() ? 'flh' : 'shk', 700);
  }
  function flash(cls, ms) {
    el.app.classList.remove(cls);
    void el.app.offsetWidth;
    el.app.classList.add(cls);
    setTimeout(function () { el.app.classList.remove(cls); }, ms);
  }

  /* ---------- 途中の終わり・結末 ---------- */
  function snap() { return { st: clone(run.st), pg: clone(run.pg) }; }

  function restore(s) {
    if (!s) return;
    run.st = clone(s.st);
    run.pg = clone(s.pg) || [];
    el.ov.hidden = true;
    enterPlay();
    resume();
  }

  function resume() {
    if (!run.pg.length || Core.atChoice(run.st)) { mode = 'busy'; next(); }
    else { mode = 'wait'; cue(true); }
  }

  function overlay(cls, build) {
    el.ov.innerHTML = '';
    el.ov.classList.toggle('e', cls === 'ov-e');
    var box = mk('div', 'ov-in ' + cls);
    build(box);
    el.ov.appendChild(box);
    el.ov.hidden = false;
    el.ov.classList.remove('in');
    void el.ov.offsetWidth;
    el.ov.classList.add('in');
    return box;
  }

  function ovButton(box, label, fn) {
    var b = mk('button', 'ov-b', label);
    b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    box.appendChild(b);
    return b;
  }

  function showDead(id) {
    setSkip(false);
    cue(false);
    mode = 'over';
    rec.x[id] = 1;
    sset('rec', rec);
    flushSeen();
    var slow = !reduced();
    timer = setTimeout(function () {
      var box = overlay('ov-x', function (b) {
        b.appendChild(mk('p', 'ov-h', '出席簿'));
        var row = mk('div', 'ov-row');
        row.appendChild(mk('span', 'rr-no', '1'));
        row.appendChild(mk('span', 'ov-nm', run.st.nm));
        var cell = mk('span', 'ov-cell');
        cell.appendChild(mk('i', 'ov-st', '欠'));
        row.appendChild(cell);
        b.appendChild(row);
        var bs = mk('div', 'ov-bs');
        b.appendChild(bs);
        ovButton(bs, 'この章の最初から', function () { restore(run.chSnap); });
        ovButton(bs, '直前の選択肢から', function () { restore(run.qSnap || run.chSnap); });
        ovButton(bs, 'タイトルへ', toTitle);
      });
      setTimeout(function () { box.classList.add('go'); Snd.stamp(); }, slow ? 900 : 10);
    }, slow ? 900 : 10);
  }

  function endName(id) {
    for (var i = 0; i < SZ.meta.ends.length; i++) if (SZ.meta.ends[i][0] === id) return SZ.meta.ends[i][1];
    return '';
  }

  function showEnd(id) {
    setSkip(false);
    cue(false);
    mode = 'over';
    rec.e[id] = 1;
    sset('rec', rec);
    flushSeen();
    timer = setTimeout(function () {
      overlay('ov-e', function (b) {
        b.appendChild(mk('p', 'ov-s', '終'));
        b.appendChild(mk('h2', 'ov-t', endName(id)));
        var bs = mk('div', 'ov-bs');
        b.appendChild(bs);
        ovButton(bs, 'タイトルへ', toTitle);
      });
    }, reduced() ? 50 : 1800);
  }

  function showMiss() {
    setSkip(false);
    cue(false);
    mode = 'over';
    run.pg = [];
    sset('auto', pack());
    flushSeen();
    overlay('ov-m', function (b) {
      b.appendChild(mk('p', 'ov-p', 'ここから先は準備中です。'));
      b.appendChild(mk('p', 'ov-p2', '続きが追加されたら「つづきから」で再開できます。'));
      var bs = mk('div', 'ov-bs');
      b.appendChild(bs);
      ovButton(bs, 'タイトルへ', toTitle);
    });
  }

  /* ---------- セーブ／ロード ---------- */
  function pack() {
    return { v: 1, t: Date.now(), st: run.st, pg: run.pg, chSnap: run.chSnap, qSnap: run.qSnap };
  }
  function autosave() { if (run) sset('auto', pack()); }

  function valid(d) {
    return d && d.st && typeof d.st.sc === 'string' && d.st.v && d.st.f && Array.isArray(d.st.ab);
  }

  function loadData(d) {
    if (!valid(d)) return false;
    d = clone(d);
    run = { st: d.st, pg: d.pg || [], chSnap: d.chSnap || null, qSnap: d.qSnap || null };
    if (!run.chSnap) run.chSnap = { st: clone(run.st), pg: [] };
    log = [];
    run.pg.forEach(function (p) { pushLog(p.k, sub(p.s)); });
    closePanel();
    enterPlay();
    resume();
    return true;
  }

  function fmtT(t) {
    var d = new Date(t);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  function slotInfo(d) {
    if (!valid(d)) return '— 空き —';
    var c = SZ.ch[d.st.ch];
    var head = c ? c.label + '　' + c.title : '';
    return (head ? head + '　' : '') + fmtT(d.t);
  }

  function savePanel(isLoad) {
    panel(isLoad ? 'ロード' : 'セーブ', function (b) {
      var keys = isLoad ? ['auto', 's1', 's2', 's3'] : ['s1', 's2', 's3'];
      var msg = mk('p', 'pn-msg');
      keys.forEach(function (k) {
        var d = sget(k, null);
        var btn = mk('button', 'sl');
        btn.type = 'button';
        btn.appendChild(mk('span', 'sl-k', k === 'auto' ? 'オート' : k.slice(1)));
        btn.appendChild(mk('span', 'sl-i', slotInfo(d)));
        if (isLoad && !valid(d)) btn.disabled = true;
        btn.addEventListener('click', function () {
          if (isLoad) {
            if (!loadData(sget(k, null))) msg.textContent = '読み込めませんでした。';
          } else {
            if (sset(k, pack())) { btn.lastChild.textContent = slotInfo(sget(k, null)); msg.textContent = '保存しました。'; }
            else msg.textContent = '保存できませんでした（ブラウザの保存領域が使えない状態です）。このまま遊び続けることはできます。';
          }
        });
        b.appendChild(btn);
      });
      b.appendChild(msg);
    });
  }

  /* ---------- パネル ---------- */
  var panelBack = null;
  function panel(title, build) {
    el.pnIn.innerHTML = '';
    el.pnIn.appendChild(mk('p', 'pn-h', title));
    var body = mk('div', 'pn-b');
    build(body);
    el.pnIn.appendChild(body);
    var x = mk('button', 'pn-x', '閉じる');
    x.type = 'button';
    x.addEventListener('click', closePanel);
    el.pnIn.appendChild(x);
    if (el.pn.hidden) panelBack = document.activeElement;
    el.pn.hidden = false;
    setSkip(false);
    var f = el.pnIn.querySelector('button:not([disabled])');
    if (f) f.focus();
  }
  function closePanel() {
    if (el.pn.hidden) return;
    el.pn.hidden = true;
    el.pnIn.innerHTML = '';
    if (panelBack && panelBack.focus && screen === 'tt') { try { panelBack.focus(); } catch (e) {} }
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    panelBack = null;
  }

  function logPanel() {
    panel('ログ', function (b) {
      var box = mk('div', 'lg');
      if (!log.length) box.appendChild(mk('p', 'lg-0', '（まだありません）'));
      log.forEach(function (l) { box.appendChild(mk('p', 'ln ln-' + l.k + ' now', l.s.replace(/\[\[|\]\]/g, ''))); });
      b.appendChild(box);
      setTimeout(function () { box.scrollTop = box.scrollHeight; }, 0);
    });
  }

  function cfgPanel() {
    panel('設定', function (b) {
      b.appendChild(mk('p', 'pn-l', '文字の速さ'));
      var row = mk('div', 'seg');
      SPD_L.forEach(function (l, i) {
        var s = mk('button', 'seg-b', l);
        s.type = 'button';
        s.setAttribute('aria-pressed', String(cfg.spd === i));
        s.addEventListener('click', function () {
          cfg.spd = i; sset('cfg', cfg);
          Array.prototype.forEach.call(row.children, function (c, j) { c.setAttribute('aria-pressed', String(j === i)); });
        });
        row.appendChild(s);
      });
      b.appendChild(row);
      b.appendChild(mk('p', 'pn-l', '音'));
      var snd = mk('button', 'seg-b', cfg.snd ? 'ON' : 'OFF');
      snd.type = 'button';
      snd.addEventListener('click', function () {
        toggleSnd();
        snd.textContent = cfg.snd ? 'ON' : 'OFF';
      });
      b.appendChild(snd);
      b.appendChild(mk('p', 'pn-l', '操作'));
      b.appendChild(mk('p', 'pn-t', 'クリック／タップ・Enter・Space：読み進める\n数字キー：選択肢を選ぶ（↑↓でも移動）\nS：既読スキップ　L：ログ　Esc：閉じる'));
    });
  }

  function menuPanel() {
    panel('メニュー', function (b) {
      [['セーブ', function () { savePanel(false); }],
       ['ロード', function () { savePanel(true); }],
       ['設定', cfgPanel],
       ['タイトルへ戻る', function () { closePanel(); toTitle(); }]
      ].forEach(function (it) {
        var x = mk('button', 'mn-b', it[0]);
        x.type = 'button';
        x.addEventListener('click', it[1]);
        b.appendChild(x);
      });
    });
  }

  function recPanel() {
    panel('回収一覧', function (b) {
      var ol = mk('ol', 'rc');
      SZ.meta.ends.forEach(function (e) {
        var got = !!rec.e[e[0]];
        var li = mk('li', got ? 'rc-g' : 'rc-n', got ? e[1] : '？？？');
        ol.appendChild(li);
      });
      b.appendChild(ol);
      var xs = SZ.meta.xs.filter(function (id) { return rec.x[id]; }).length;
      b.appendChild(mk('p', 'rc-x', '欠席　' + xs + '／' + SZ.meta.xs.length));
    });
  }

  function toggleSnd() {
    cfg.snd = !cfg.snd;
    Snd.set(cfg.snd);
    sset('cfg', cfg);
    el.sndV.textContent = cfg.snd ? 'ON' : 'OFF';
    if (cfg.snd) Snd.tick();
  }

  function setSkip(on) {
    skip = !!on;
    el.skip.setAttribute('aria-pressed', String(skip));
    el.skip.classList.toggle('on', skip);
    if (skip && mode === 'wait') advance();
    if (skip && mode === 'type' && typing) typing.finish();
  }

  /* ---------- 入力 ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-a]');
    if (!b) return;
    e.stopPropagation();
    var a = b.getAttribute('data-a');
    if (b.blur && a !== 'snd') b.blur();
    switch (a) {
      case 'new': toName(); break;
      case 'cont': savePanel(true); break;
      case 'rec': recPanel(); break;
      case 'cfg': cfgPanel(); break;
      case 'snd': toggleSnd(); break;
      case 'title': toTitle(); break;
      case 'log': logPanel(); break;
      case 'skip': setSkip(!skip); break;
      case 'menu': menuPanel(); break;
    }
  });

  el.mn.addEventListener('click', function () {
    if (window.getSelection && String(window.getSelection())) return;
    advance();
  });
  el.cd.addEventListener('click', function () { if (mode === 'card') hideCard(); });
  el.pn.addEventListener('click', function (e) { if (e.target === el.pn) closePanel(); });

  el.nxF.addEventListener('submit', function (e) {
    e.preventDefault();
    if (el.nxI.blur) el.nxI.blur();
    startNew(el.nxI.value);
  });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!el.pn.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closePanel(); }
      return;
    }
    if (screen !== 'pl' || !run) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (mode === 'over') return;
    if (mode === 'choice') {
      var opts = el.op._opts || [];
      var d = parseInt(e.key, 10);
      if (d >= 1 && d <= opts.length) { e.preventDefault(); pick(opts[d - 1].n); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); focusOp(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusOp(-1); return; }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target && e.target.tagName === 'BUTTON' && e.target.closest('#ov')) return;
      e.preventDefault();
      advance();
    } else if (e.key === 's' || e.key === 'S') {
      setSkip(!skip);
    } else if (e.key === 'l' || e.key === 'L') {
      logPanel();
    }
  });

  window.addEventListener('resize', function () { if (screen === 'pl') scrollDown(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushSeen(); });
  window.addEventListener('pagehide', flushSeen);

  /* ---------- デバッグ（?debug=1 のときだけ） ---------- */
  if (DEBUG) {
    window.SZG = {
      get run() { return run; },
      get rec() { return rec; },
      saveRec: function () { sset('rec', rec); },
      clearSeen: function () { seen = {}; seenDirty = 0; sset('r', seen); },
      jump: function (chId, st) {
        var c = SZ.ch[chId];
        if (!c) return;
        var base = run ? run.st : Core.fresh(SZ.meta.defName);
        run = { st: Core.fresh(base.nm), pg: [], chSnap: null, qSnap: null };
        if (st) { run.st.v = clone(st.v); run.st.f = clone(st.f); run.st.ab = clone(st.ab); }
        run.st.sc = c.start; run.st.i = 0;
        log = [];
        closePanel();
        clearTimeout(timer); clearTimeout(cardTimer); stopTyping();
        el.cd.hidden = true;
        enterPlay();
        next();
      },
      refresh: function () { if (run && screen === 'pl') renderRoster(null); },
      toTitle: toTitle
    };
    var sc = document.createElement('script');
    sc.src = 'js/dev.js';
    document.body.appendChild(sc);
  }

  toTitle();
})();
