/* 画面と操作。本文データは data/*.js、判定は js/core.js。 */
(function () {
  'use strict';
  var C = window.YoiCore;
  var D = window.YOI_DATA || {};
  var $ = function (id) { return document.getElementById(id); };
  var DEBUG = /[?&]debug=1(?:&|$)/.test(location.search);

  var KEY = { slots: 'ymg.s1', quick: 'ymg.q1', read: 'ymg.r1', ends: 'ymg.e1', opt: 'ymg.o1' };
  var NSLOT = 11;

  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境では黙って続ける */ } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var readMap = lsGet(KEY.read, {});
  var ends = lsGet(KEY.ends, {});
  var opt = lsGet(KEY.opt, { speed: 1, name: '' });
  var readDirty = false;
  function flushRead() { if (readDirty) { lsSet(KEY.read, readMap); readDirty = false; } }
  setInterval(flushRead, 3000);
  window.addEventListener('pagehide', flushRead);
  document.addEventListener('visibilitychange', flushRead);

  /* 音 */
  if (typeof opt.vol !== 'number') opt.vol = 0.5;
  var snd = window.YoiSnd.create(function (src) { return new Audio(src); }, { vol: opt.vol, mute: !!opt.mute });
  (function sndUi() {
    var btn = $('sndMute'), rng = $('sndVol');
    var paint = function () { btn.classList.toggle('off', !!opt.mute); btn.textContent = '♪'; rng.value = Math.round(opt.vol * 100); };
    paint();
    btn.addEventListener('click', function (e) { e.stopPropagation(); opt.mute = !opt.mute; snd.setMute(opt.mute); lsSet(KEY.opt, opt); paint(); });
    rng.addEventListener('input', function () { opt.vol = rng.value / 100; snd.setVolume(opt.vol); });
    rng.addEventListener('change', function () { lsSet(KEY.opt, opt); });
    ['pointerdown', 'click'].forEach(function (ev) { $('snd').addEventListener(ev, function (e) { e.stopPropagation(); }); });
    // 自動再生の制限で鳴らせなかったときは、次の操作で鳴らす
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { document.addEventListener(ev, function () { snd.onGesture(); }, true); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') snd.onGesture(); });
  })();

  var cache = {};
  function prog(id) { return cache[id] || (cache[id] = C.compile(D[id].src)); }

  /* ---------- 要素 ---------- */
  var el = {
    bg: $('bg'), edge: $('edge'), lay: $('lay'), frame: $('frame'), stage: $('stage'), box: $('box'),
    txt: $('txt'), more: $('more'), card: $('card'), fade: $('fade'), toast: $('toast')
  };
  var BAR_ORDER = [['l', 3], ['r', 5], ['l', 6], ['r', 1], ['l', 0], ['r', 3], ['l', 5],
    ['r', 0], ['l', 2], ['r', 6], ['l', 4], ['r', 2], ['l', 1], ['r', 4]];
  var bars = { l: [], r: [] };
  (function buildFrame() {
    ['l', 'r'].forEach(function (side) {
      var s = document.createElement('div');
      s.className = 'fs f' + side;
      for (var i = 0; i < 7; i++) { var b = document.createElement('i'); b.className = 'b'; s.appendChild(b); bars[side].push(b); }
      el.frame.appendChild(s);
    });
    ['ft', 'fb', 'fi'].forEach(function (c) { var d = document.createElement('div'); d.className = c; el.frame.appendChild(d); });
  })();

  /* ---------- 状態 ---------- */
  var st = null;          // 進行状態
  var vis = null;         // 見た目の状態（セーブに含める）
  var pageStart = 0;
  var wait = null;        // 'line' | 'choice' | 'busy' | 'fin' | null
  var typing = null;      // { timer, finish }
  var skip = false, auto = false;
  var skipTimer = 0, autoTimer = 0;
  var replayUntil = null;
  var mode = 'none';      // 'play' | 'gallery' | 'none'
  var log = [];
  var curKey = null;

  function defaultVis(id) {
    var i = C.ORDER.indexOf(id);
    var fw = i < 0 ? 0 : Math.min(i, 14);
    return { bg: 't2', edge: '', fw: fw, fm: '', fk: '', lay: '' };
  }

  function applyVis() {
    el.bg.className = 'bg ' + (vis.bg || 't2');
    el.edge.className = 'edge ' + (vis.edge || '');
    el.frame.className = 'frame ' + (vis.fm || '') + ' ' + (vis.fk || '');
    el.lay.setAttribute('class', 'lay ' + (vis.lay || ''));
    bars.l.concat(bars.r).forEach(function (b) { b.className = 'b'; });
    for (var i = 0; i < BAR_ORDER.length; i++) {
      var b = bars[BAR_ORDER[i][0]][BAR_ORDER[i][1]];
      if (i < vis.fw) b.classList.add('w');
    }
    if ((vis.fm || '').indexOf('m-f') >= 0) bars.l[3].classList.add('x');
  }

  /* ---------- 表示の小物 ---------- */
  function fmt(s) { return s.replace(/\{name\}/g, st ? st.name : C.DEFAULT_NAME); }
  function lineClass(s) {
    var c = s.charAt(0);
    if (c === '▷') return 'u';
    if (c === '「' || c === '『') return 'q';
    return '';
  }
  function toast(msg) {
    el.toast.textContent = msg; el.toast.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.toast.hidden = true; }, 1600);
  }
  function pushLog(c, s) { log.push({ c: c, s: s }); if (log.length > 500) log.shift(); }
  function clearPage() { el.txt.innerHTML = ''; }
  function scrollEnd() { el.txt.scrollTop = el.txt.scrollHeight; }
  function setMore(on) { el.more.className = 'more' + (on ? ' on' : ''); }

  function addLine(s) {
    var p = document.createElement('p');
    var c = lineClass(s);
    if (c) p.className = c;
    p.textContent = s;
    el.txt.appendChild(p);
    if (el.txt.children.length > 1 && el.txt.scrollHeight > el.txt.clientHeight + 2) {
      clearPage();
      pageStart = st.pc;
      el.txt.appendChild(p);
    }
    scrollEnd();
    return p;
  }

  function stopTimers() { clearTimeout(skipTimer); clearTimeout(autoTimer); skipTimer = autoTimer = 0; }
  function setSkip(on) {
    skip = !!on; $('btnSkip').classList.toggle('on', skip);
    if (!skip) clearTimeout(skipTimer);
    if (skip && wait === 'line') skipTimer = setTimeout(advance, 40);
  }
  function setAuto(on) {
    auto = !!on; $('btnAuto').classList.toggle('on', auto);
    if (!auto) clearTimeout(autoTimer);
    if (auto && wait === 'line') autoTimer = setTimeout(advance, 900);
  }

  function fadeThen(cb, white, hold) {
    wait = 'busy';
    el.fade.classList.toggle('white', !!white);
    el.fade.classList.add('on');
    setTimeout(function () {
      cb();
      setTimeout(function () { el.fade.classList.remove('on'); }, hold || 200);
    }, skip ? 200 : 560);
  }

  /* ---------- 進行 ---------- */
  function step() {
    var guard = 0;
    while (guard++ < 5000) {
      var P = prog(st.cur);
      var op = P.ops[st.pc];
      dbgUpdate();
      if (!op) { toTitle(); return; }
      switch (op.t) {
        case 'text':
          if (!C.evalCond(op.cond, st)) { st.pc++; continue; }
          if (replayUntil !== null) {
            var s0 = fmt(op.s);
            addLine(s0); pushLog(lineClass(s0), s0);
            if (st.pc === replayUntil) { replayUntil = null; curKey = st.cur + ':' + C.hash(op.s); wait = 'line'; setMore(true); return; }
            st.pc++; continue;
          }
          showLine(op); return;
        case 'page':
          st.pc++; clearPage(); pageStart = st.pc; continue;
        case 'go':
          st.pc = P.labels[op.to]; continue;
        case 'if':
          st.pc = C.evalCond(op.cond, st) ? P.labels[op.to] : st.pc + 1; continue;
        case 'bg':
          vis.bg = op.v; applyVis(); st.pc++; continue;
        case 'frame':
          var fp = op.v.split(/\s+/);
          vis.fm = fp[0] === '-' ? '' : fp[0];
          if (fp[1] !== undefined) vis.fw = parseInt(fp[1], 10);
          applyVis(); st.pc++; continue;
        case 'bgm':
          if (op.v === '0') snd.stop(); else snd.play(op.v);
          st.pc++; continue;
        case 'fx':
          st.pc++;
          if (doFx(op.v)) return;
          continue;
        case 'title':
          st.pc++;
          if (replayUntil !== null) continue;
          showCard(); return;
        case 'choice':
          showChoice(op); return;
        case 'next':
          nextChapter(); return;
        case 'ending':
          enterScript(op.v); return;
        case 'fin':
          finish(); return;
      }
    }
  }

  function doFx(v) {
    switch (v) {
      case 'e0': vis.edge = ''; break;
      case 'e1': vis.edge = 'on'; break;
      case 'e2': vis.edge = 'faint'; break;
      case 'e3': vis.edge = 'fxr'; break;
      case 'e4': vis.edge = 'fxk'; break;
      case 'e5': vis.edge = 'fxf'; break;
      case 'k0': vis.fk = ''; break;
      case 'k1': vis.fk = 'fxs'; break;
      case 'l0': vis.lay = ''; break;
      case 'l1': vis.lay = 'on'; break;
      case 'l2': vis.lay = 'on shut'; break;
      case 'l3': vis.lay = 'on dim'; break;
      case 'l4': vis.lay = 'on shut warm'; break;
      case 'z1': vis.fm = 'm-z'; vis.fw = 14; break;
      case 'z2': vis.fm = 'm-z open'; vis.lay = 'on'; break;
      case 'z3': vis.fm = 'm-k'; vis.fw = 0; break;
      case 'z4': vis.fm = 'm-k open'; vis.lay = 'on ink'; break;
      case 'z5': vis.fm = 'm-k open ash'; vis.lay = 'on ink'; break;
      case 'z6': vis.fm = 'm-r'; break;
      case 'z7': vis.fm = 'm-r fall'; break;
      case 'q':
        el.frame.classList.remove('fxq'); void el.frame.offsetWidth; el.frame.classList.add('fxq');
        setTimeout(function () { el.frame.classList.remove('fxq'); }, 1600);
        return false;
      case 'd': case 'w':
        if (replayUntil !== null) { clearPage(); pageStart = st.pc; return false; }
        fadeThen(function () { clearPage(); pageStart = st.pc; pushLog('hr', '◇'); step(); }, v === 'w', v === 'w' ? 500 : 200);
        return true;
    }
    applyVis();
    return false;
  }

  function showLine(op) {
    var s = fmt(op.s);
    var key = st.cur + ':' + C.hash(op.s);
    var wasRead = !!readMap[key];
    if (skip && !wasRead) setSkip(false);
    var p = addLine(s);
    pushLog(lineClass(s), s);
    curKey = key;
    var done = function () {
      typing = null;
      p.textContent = s;
      scrollEnd();
      if (!readMap[key]) { readMap[key] = 1; readDirty = true; }
      wait = 'line';
      setMore(true);
      if (skip) skipTimer = setTimeout(advance, 40);
      else if (auto) autoTimer = setTimeout(advance, 1100 + s.length * 55);
    };
    wait = 'busy';
    setMore(false);
    if (skip) { done(); return; }
    var per = [42, 24, 9][opt.speed == null ? 1 : opt.speed];
    var i = 0, t0 = performance.now();
    p.textContent = '';
    var timer = setInterval(function () {
      var n = Math.min(s.length, Math.floor((performance.now() - t0) / per) + 1);
      if (n !== i) { i = n; p.textContent = s.slice(0, i); }
      if (i >= s.length) { clearInterval(timer); done(); }
    }, 16);
    typing = { finish: function () { clearInterval(timer); done(); } };
  }

  function advance() {
    if (anyOverlay()) return;
    if (typing) { typing.finish(); return; }
    if (wait !== 'line') return;
    stopTimers();
    wait = null; setMore(false);
    st.pc++;
    step();
  }

  function showChoice(op) {
    replayUntil = null;
    setSkip(false);
    clearTimeout(autoTimer);
    if (mode === 'play') quickSave();
    var wrap = document.createElement('div');
    wrap.className = 'choices';
    op.opts.forEach(function (o, k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = fmt(o.s);
      if (DEBUG) {
        var e = Object.keys(o.eff.p).map(function (x) { return x + '+' + o.eff.p[x]; }).concat(o.eff.f).join(' ');
        b.textContent += '　[' + e + ']';
      }
      b.addEventListener('click', function (ev) { ev.stopPropagation(); pick(op, k); });
      wrap.appendChild(b);
    });
    el.txt.appendChild(wrap);
    scrollEnd();
    wait = 'choice';
    setMore(false);
  }

  function pick(op, k) {
    if (wait !== 'choice') return;
    var o = op.opts[k];
    C.applyEff(o.eff, st);
    var s = fmt(o.s);
    pushLog('sel', s);
    clearPage();
    st.pc = prog(st.cur).labels[o.to];
    pageStart = st.pc;
    wait = null;
    step();
  }

  function showCard() {
    var d = D[st.cur];
    var isEd = st.cur.charAt(0) === 'e';
    if (isEd && (mode === 'play' || mode === 'gallery') && !ends[st.cur]) { ends[st.cur] = 1; lsSet(KEY.ends, ends); }
    $('cardNum').textContent = d.num || '';
    $('cardTitle').textContent = d.title || '';
    pushLog('hr', (d.num || '') + '　' + (d.title || ''));
    wait = 'busy';
    el.card.hidden = false;
    void el.card.offsetWidth;
    el.card.classList.add('on');
    var closed = false;
    var close = function () {
      if (closed) return; closed = true;
      el.card.removeEventListener('click', close);
      el.card.classList.remove('on');
      setTimeout(function () { el.card.hidden = true; wait = null; step(); }, skip ? 150 : 700);
    };
    el.card.addEventListener('click', close);
    setTimeout(close, skip ? 700 : 2600);
  }

  function enterScript(id) {
    fadeThen(function () {
      st.cur = id; st.pc = 0; pageStart = 0;
      vis = defaultVis(id);
      applyVis();
      clearPage();
      step();
    }, false, 300);
  }

  function nextChapter() {
    var n = C.nextOf(st.cur);
    if (!n) { toTitle(); return; }
    enterScript(n);
  }

  function finish() {
    stopTimers(); setSkip(false); setAuto(false);
    wait = 'fin';
    var f = document.createElement('div');
    f.className = 'fin';
    f.textContent = '終';
    $('app').appendChild(f);
    void f.offsetWidth;
    f.classList.add('on');
    var gal = mode === 'gallery';
    setTimeout(function () {
      f.addEventListener('click', function () {
        f.remove();
        toTitle();
        if (gal) openGallery();
      });
    }, 1200);
  }

  /* ---------- 開始・セーブ ---------- */
  function begin(state, v, from, until) {
    st = state; vis = v || defaultVis(st.cur);
    applyVis();
    log = [];
    clearPage(); setMore(false);
    stopTimers(); setSkip(false); setAuto(false);
    typing = null; wait = null;
    hideAll();
    $('title').hidden = true;
    el.stage.hidden = false;
    document.querySelectorAll('.ingame').forEach(function (b) { b.hidden = mode !== 'play'; });
    st.pc = from || 0; pageStart = st.pc;
    replayUntil = (until === undefined || until === null) ? null : until;
    step();
  }

  function snapshot() {
    var last = el.txt.querySelector('p:last-of-type');
    return {
      st: clone(st), vis: clone(vis), pageStart: pageStart, pos: st.pc, time: Date.now(),
      snip: last ? last.textContent.slice(0, 40) : ''
    };
  }
  function quickSave() { lsSet(KEY.quick, snapshot()); }
  function restore(sv) {
    if (!sv || !sv.st || !D[sv.st.cur]) { toast('読み込めませんでした'); return; }
    snd.onEnter('load');
    mode = 'play';
    var s = clone(sv.st);
    begin(s, clone(sv.vis), sv.pageStart, sv.pos);
  }

  function chapterLabel(cur) {
    var d = D[cur];
    if (!d) return '';
    return (d.num || '') + '　' + (d.title || '');
  }
  function fmtTime(t) {
    var d = new Date(t);
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  var slotMode = 'save';
  function openSlots(m) {
    slotMode = m;
    $('slotsHead').textContent = m === 'save' ? 'セーブ' : 'ロード';
    renderSlots();
    show('slots');
  }
  function renderSlots() {
    var slots = lsGet(KEY.slots, []);
    var ul = $('slotList');
    ul.innerHTML = '';
    for (var i = 0; i < NSLOT; i++) {
      (function (i) {
        var sv = slots[i];
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'sl';
        var head = document.createElement('span');
        head.textContent = (i + 1 < 10 ? '0' : '') + (i + 1) + '　' + (sv ? chapterLabel(sv.st.cur) + '　' + fmtTime(sv.time) : '――');
        b.appendChild(head);
        if (sv) { var sm = document.createElement('small'); sm.textContent = sv.snip || ''; b.appendChild(sm); }
        if (slotMode === 'load' && !sv) b.disabled = true;
        b.addEventListener('click', function () {
          if (slotMode === 'save') {
            var doSave = function () { slots[i] = snapshot(); lsSet(KEY.slots, slots); renderSlots(); toast('セーブしました'); };
            if (sv) confirmBox('上書きしますか？', doSave); else doSave();
          } else if (sv) {
            confirmBox('この記録を読み込みますか？', function () { hideAll(); restore(sv); });
          }
        });
        li.appendChild(b);
        if (sv) {
          var del = document.createElement('button');
          del.type = 'button'; del.className = 'del'; del.textContent = '消す';
          del.addEventListener('click', function () {
            confirmBox('この記録を消しますか？', function () { slots[i] = null; lsSet(KEY.slots, slots); renderSlots(); });
          });
          li.appendChild(del);
        }
        ul.appendChild(li);
      })(i);
    }
  }

  function openGallery() {
    var ul = $('galList');
    ul.innerHTML = '';
    C.galleryState(ends).forEach(function (g, i) {
      var k = g.id;
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'gl';
      b.textContent = (i + 1) + '　' + (g.open && D[k] ? D[k].title : '？？？');
      b.disabled = !g.open || !D[k];
      b.addEventListener('click', function () {
        hideAll();
        snd.onEnter('gallery', k);
        mode = 'gallery';
        var s = C.newState(opt.name || C.DEFAULT_NAME);
        s.cur = k;
        begin(s, defaultVis(k), 0, null);
      });
      li.appendChild(b); ul.appendChild(li);
    });
    show('gallery');
  }

  function openLog() {
    var body = $('logBody');
    body.innerHTML = '';
    log.forEach(function (e) {
      var p = document.createElement('p');
      if (e.c === 'hr') { p.className = 'hr'; p.textContent = e.s; }
      else { p.className = e.c; p.textContent = e.s; }
      body.appendChild(p);
    });
    show('log');
    body.scrollTop = body.scrollHeight;
  }

  /* ---------- 画面切り替え ---------- */
  var OVERLAYS = ['namein', 'menu', 'slots', 'gallery', 'log', 'confirm'];
  function show(id) {
    OVERLAYS.forEach(function (o) { if (o !== 'confirm') $(o).hidden = o !== id; });
    stopTimers();
    if (skip) setSkip(false);
  }
  function hideAll() { OVERLAYS.forEach(function (o) { $(o).hidden = true; }); resumeTimers(); }
  function anyOverlay() { return OVERLAYS.some(function (o) { return !$(o).hidden; }) || !$('title').hidden; }
  function resumeTimers() {
    if (auto && wait === 'line' && $('title').hidden) { clearTimeout(autoTimer); autoTimer = setTimeout(advance, 900); }
  }
  function confirmBox(msg, yes) {
    $('cfMsg').textContent = msg;
    $('confirm').hidden = false;
    $('cfYes').onclick = function () { $('confirm').hidden = true; yes(); };
    $('cfNo').onclick = function () { $('confirm').hidden = true; };
  }

  function toTitle() {
    flushRead();
    stopTimers(); setSkip(false); setAuto(false);
    if (typing) { typing = null; }
    wait = null; mode = 'none'; st = null;
    hideAll();
    el.stage.hidden = true;
    vis = { bg: 't2', edge: '', fw: 0, fm: '', fk: '', lay: '' };
    applyVis();
    clearPage();
    refreshTitle();
    $('title').hidden = false;
  }
  function refreshTitle() {
    $('btnQuickT').disabled = !lsGet(KEY.quick, null);
    var slots = lsGet(KEY.slots, []);
    $('title').querySelector('[data-act="load"]').disabled = !slots.some(Boolean);
    $('btnSpeed').textContent = '文字の速さ：' + ['ゆっくり', 'ふつう', 'はやい'][opt.speed == null ? 1 : opt.speed];
  }

  /* ---------- 操作 ---------- */
  function act(a) {
    switch (a) {
      case 'new':
        $('nameBox').value = '';
        $('nameBox').placeholder = C.DEFAULT_NAME;
        show('namein');
        setTimeout(function () { $('nameBox').focus(); }, 50);
        break;
      case 'nameok':
        var nm = $('nameBox').value.replace(/[\s　]+/g, '').slice(0, 8) || C.DEFAULT_NAME;
        opt.name = nm; lsSet(KEY.opt, opt);
        hideAll();
        snd.onEnter('new');
        mode = 'play';
        begin(C.newState(nm), defaultVis('ch01'), 0, null);
        break;
      case 'nameback': hideAll(); break;
      case 'load': openSlots('load'); break;
      case 'save':
        if (wait !== 'line' && wait !== 'choice') { toast('いまはセーブできません'); return; }
        openSlots('save'); break;
      case 'quick':
        var q = lsGet(KEY.quick, null);
        if (!q) { toast('記録がありません'); return; }
        if (mode === 'play') confirmBox('直前の選択肢に戻りますか？', function () { hideAll(); restore(q); });
        else { hideAll(); restore(q); }
        break;
      case 'gallery': openGallery(); break;
      case 'log': openLog(); break;
      case 'menu': show('menu'); break;
      case 'speed':
        opt.speed = ((opt.speed == null ? 1 : opt.speed) + 1) % 3; lsSet(KEY.opt, opt); refreshTitle(); break;
      case 'totitle': confirmBox('タイトルに戻りますか？', toTitle); break;
      case 'skip': setSkip(!skip); break;
      case 'auto': setAuto(!auto); break;
      case 'close':
        if (!$('slots').hidden && !el.stage.hidden) { show('menu'); break; }
        hideAll(); break;
    }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (b) { e.stopPropagation(); act(b.getAttribute('data-act')); }
  });
  el.box.addEventListener('click', function (e) {
    if (e.target.closest('.choices')) return;
    advance();
  });
  $('nameBox').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); act('nameok'); } });

  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var inGame = !el.stage.hidden && $('title').hidden;
    if (e.key === 'Escape') {
      if (!$('confirm').hidden) { $('confirm').hidden = true; return; }
      if (OVERLAYS.some(function (o) { return !$(o).hidden; })) { act('close'); return; }
      if (inGame) act('menu');
      return;
    }
    if (!inGame || anyOverlay()) return;
    if (e.key === 's' || e.key === 'S') { setSkip(!skip); return; }
    if (e.key === 'a' || e.key === 'A') { setAuto(!auto); return; }
    if (wait === 'choice' && /^[1-9]$/.test(e.key)) {
      var bs = el.txt.querySelectorAll('.choices button');
      var k = parseInt(e.key, 10) - 1;
      if (bs[k]) bs[k].click();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); advance(); }
  });

  /* ---------- 開発用（?debug=1 のときだけ） ---------- */
  var dbgEl = null;
  function dbgUpdate() {
    if (!dbgEl || !st) return;
    var ss = snd.state();
    dbgEl.querySelector('.s').textContent = st.cur + ' pc' + st.pc + ' | p1 ' + st.p.p1 + ' p2 ' + st.p.p2 + ' p3 ' + st.p.p3 + ' | f1 ' + (st.f.f1 ? 1 : 0) +
      ' | bgm ' + (ss.cur || '-') + (ss.playing ? ' play' : '') + (ss.pending ? ' wait' : '') + (ss.broken ? ' none' : '');
  }
  if (DEBUG) {
    window.__sndState = function () { return snd.state(); };
    dbgEl = document.createElement('div');
    dbgEl.className = 'dbg';
    var ids = C.ORDER.concat(C.ENDS);
    dbgEl.innerHTML = '<div class="s">-</div>' +
      '<select>' + ids.map(function (i) { return '<option>' + i + '</option>'; }).join('') + '</select>' +
      '<button data-d="jump">jump</button>' +
      ['p1', 'p2', 'p3'].map(function (p) { return '<button data-d="' + p + '+">' + p + '+2</button><button data-d="' + p + '-">' + p + '-2</button>'; }).join('') +
      '<button data-d="f1">f1</button><button data-d="ends">all ed</button><button data-d="unread">clear read</button>';
    $('app').appendChild(dbgEl);
    dbgEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var d = e.target.getAttribute('data-d');
      if (!d) return;
      if (d === 'jump') {
        var id = dbgEl.querySelector('select').value;
        snd.onEnter('gallery', id);
        mode = 'play';
        var s = st ? clone(st) : C.newState(opt.name || C.DEFAULT_NAME);
        s.cur = id; s.pc = 0;
        hideAll();
        begin(s, defaultVis(id), 0, null);
        return;
      }
      if (d === 'ends') { C.ENDS.forEach(function (k) { ends[k] = 1; }); lsSet(KEY.ends, ends); toast('ok'); return; }
      if (d === 'unread') { readMap = {}; lsSet(KEY.read, readMap); toast('ok'); return; }
      if (!st) return;
      if (d === 'f1') st.f.f1 = !st.f.f1;
      else st.p[d.slice(0, 2)] += d.charAt(2) === '+' ? 2 : -2;
      dbgUpdate();
    });
  }

  toTitle();
})();
