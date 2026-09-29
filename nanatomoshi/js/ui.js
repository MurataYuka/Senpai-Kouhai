/*
 * ui.js — 画面表示と入力
 */
(function () {
  'use strict';

  const N = window.NANA;
  const $ = function (s) { return document.querySelector(s); };
  const el = function (tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function safeStorage() {
    try {
      const k = '__nana_probe';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      return N.MemoryStorage();
    }
  }

  const store = new N.Store(safeStorage());
  const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
  const cfg = Object.assign({ speed: 60 }, store.cfg());

  const stage = $('#stage');
  const frame = $('#frame');
  const bones = $('#bones');
  const candlesEl = $('#candles');
  const win = $('#win');
  const textEl = $('#text');
  const choicesEl = $('#choices');
  const card = $('#card');
  const modal = $('#modal');
  const mbox = $('.m-box');

  let runner = null;
  let waiting = null;       // 'text' | 'choice' | 'card' | 'wait' | 'fin'
  let typing = null;
  let replayMode = false;   // エンディング再生中
  let cardTimer = null;
  let creakTimer = null;
  let shownBones = 0;
  let finEvent = null;

  /* ---------------- 蝋燭 ---------------- */

  function buildCandles(box) {
    box.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const c = el('div', 'cd');
      c.appendChild(el('div', 'glow'));
      c.appendChild(el('div', 'flame'));
      c.appendChild(el('div', 'wick'));
      c.appendChild(el('div', 'wax'));
      c.appendChild(el('div', 'smoke'));
      box.appendChild(c);
    }
  }
  buildCandles($('#candles'));
  buildCandles($('.t-candles'));

  function setCandles(str) {
    const cs = $('#candles').children;
    for (let i = 0; i < 7; i++) cs[i].classList.toggle('off', str[i] !== '1');
  }

  function animCandle(i, on, hard) {
    const c = $('#candles').children[i];
    c.classList.remove('lighting', 'smoking', 'snuffed');
    void c.offsetWidth;
    if (on) {
      c.classList.remove('off');
      c.classList.add('lighting');
    } else if (hard) {
      c.classList.add('snuffed');
      setTimeout(function () { c.classList.remove('snuffed'); c.classList.add('off', 'smoking'); }, 520);
    } else {
      c.classList.add('off', 'smoking');
    }
  }

  /* ---------------- 骨の枠 ---------------- */

  function boneCount(ch) { return 6 + Math.max(1, ch || 1); }

  function buildBones(st, animate) {
    const spine = $('#spine');
    const base = $('#base');
    const n = boneCount(st.ch);
    const names = st.names || [];
    spine.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const b = el('div', 'bone');
      b.appendChild(el('i'));
      const nm = names[i] || '';
      b.appendChild(el('span', 'nm', nm));
      if (!nm) b.classList.add('blank');
      if (nm && i === names.length - 1) b.classList.add('fresh');
      if (animate && i >= shownBones && shownBones > 0) b.classList.add('grow');
      spine.appendChild(b);
    }
    shownBones = n;
    if (!base.children.length) {
      for (let i = 0; i < 7; i++) { const b = el('div', 'bone'); b.appendChild(el('i')); base.appendChild(b); }
    }
    frame.classList.toggle('named', !!st.names);
  }

  function applyVisuals(animate) {
    const st = runner.state;
    setCandles(st.candles);
    buildBones(st, animate);
    document.body.classList.toggle('night', !!st.night);
    scheduleCreak();
  }

  function scheduleCreak() {
    clearTimeout(creakTimer);
    if (!runner || !runner.state.night || stage.hidden) return;
    const ch = runner.state.ch || 1;
    // 章が進むほど軋みの間隔が短くなる
    const base = Math.max(5000, 30000 - ch * 2100);
    const delay = base * (0.7 + Math.random() * 0.6);
    creakTimer = setTimeout(function () { fx('creak'); scheduleCreak(); }, delay);
  }

  function fx(k) {
    const retrig = function (node, cls) {
      node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
      setTimeout(function () { node.classList.remove(cls); }, 3200);
    };
    switch (k) {
      case 'creak': retrig(bones, 'creak'); break;
      case 'shake': retrig(bones, 'shake'); retrig(candlesEl, 'shake'); break;
      case 'quake': retrig(bones, 'quake'); retrig(candlesEl, 'quake'); break;
      case 'flash': retrig($('#flash'), 'on'); break;
      case 'red': retrig($('#vignette'), 'on'); break;
      case 'dark': retrig(stage, 'dark'); break;
      case 'gold': {
        const b = $('#spine .bone.blank') || $('#spine .bone:last-child');
        if (b) retrig(b, 'gold');
        break;
      }
    }
  }

  /* ---------------- 本文 ---------------- */

  function tokenize(s) {
    const out = [];
    const re = /<<(.+?)>>/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ text: s.slice(last, m.index), cls: '' });
      out.push({ text: m[1], cls: 'seal' });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ text: s.slice(last), cls: '' });
    return out;
  }

  function msPerChar() { return Math.round(90 * (1 - cfg.speed / 100)); }

  function scrollDown() { win.scrollTop = win.scrollHeight; }

  function clearText() {
    finishTyping();
    textEl.innerHTML = '';
    choicesEl.innerHTML = '';
    win.scrollTop = 0;
  }

  function showText(ev, instant) {
    const p = el('p', 'ln ' + ev.kind);
    const segs = tokenize(ev.s).map(function (sg) {
      const sp = el('span', sg.cls || null);
      p.appendChild(sp);
      return { sp: sp, text: Array.from(sg.text), cls: sg.cls };
    });
    textEl.appendChild(p);
    const done = function () {
      segs.forEach(function (x) {
        x.sp.textContent = x.text.join('');
        if (x.cls === 'seal') x.sp.classList.add('on');
      });
      typing = null;
      win.classList.add('ready');
      scrollDown();
    };
    win.classList.remove('ready');
    const ms = msPerChar();
    if (instant || ms <= 0) { done(); return; }
    let si = 0, ci = 0;
    const tick = function () {
      while (si < segs.length && ci >= segs[si].text.length) {
        if (segs[si].cls === 'seal') segs[si].sp.classList.add('on');
        si++; ci = 0;
      }
      if (si >= segs.length) { clearInterval(timer); done(); return; }
      segs[si].sp.textContent += segs[si].text[ci++];
      scrollDown();
    };
    const timer = setInterval(tick, ms);
    typing = { finish: function () { clearInterval(timer); done(); } };
  }

  function finishTyping() { if (typing) typing.finish(); }

  function showChoice(ev) {
    choicesEl.innerHTML = '';
    win.classList.remove('ready');
    ev.opts.forEach(function (o, i) {
      const b = el('button', null, o.text);
      b.addEventListener('click', function (e) { e.stopPropagation(); pick(i); });
      choicesEl.appendChild(b);
    });
    scrollDown();
  }

  function pick(i) {
    if (waiting !== 'choice') return;
    runner.choose(i);
    waiting = null;
    clearText();
    pump();
  }

  /* ---------------- 進行 ---------------- */

  function pump() {
    for (;;) {
      const ev = runner.next();
      switch (ev.type) {
        case 'page': clearText(); continue;
        case 'text': showText(ev, false); waiting = 'text'; updateDebug(); return;
        case 'choice':
          if (!replayMode) store.saveAuto(runner.saveData());
          showChoice(ev); waiting = 'choice'; updateDebug(); return;
        case 'chapter': applyVisuals(true); showCard(ev.title); return;
        case 'visual': applyVisuals(false); continue;
        case 'candle': animCandle(ev.i, ev.on, ev.hard); continue;
        case 'fx': fx(ev.k); continue;
        case 'wait':
          waiting = 'wait';
          setTimeout(function () { if (waiting === 'wait') { waiting = null; pump(); } }, ev.ms);
          return;
        case 'fin': finish(ev); return;
        case 'eof': toTitle(); return;
      }
    }
  }

  function advance() {
    if (!modal.hidden) return;
    if (typing) { finishTyping(); return; }
    if (waiting === 'text') { waiting = null; pump(); return; }
    if (waiting === 'card') { hideCard(); return; }
    if (waiting === 'fin') { afterFin(); return; }
  }

  function showCard(title, sub) {
    waiting = 'card';
    const inner = card.querySelector('.c-inner');
    inner.innerHTML = '';
    if (sub) inner.appendChild(el('small', null, sub));
    inner.appendChild(document.createTextNode(title));
    card.hidden = false;
    clearTimeout(cardTimer);
    cardTimer = setTimeout(function () { if (waiting === 'card') hideCard(); }, 3000);
  }

  function hideCard() {
    clearTimeout(cardTimer);
    card.hidden = true;
    waiting = null;
    pump();
  }

  function finish(ev) {
    finEvent = ev;
    store.addEnding(ev.id);
    waiting = 'fin';
    const inner = card.querySelector('.c-inner');
    inner.innerHTML = '';
    inner.appendChild(el('small', null, 'ENDING'));
    inner.appendChild(document.createTextNode(ev.title));
    card.hidden = false;
    clearTimeout(cardTimer);
  }

  function afterFin() {
    card.hidden = true;
    waiting = null;
    if (replayMode) { toTitle(); openGallery(); } else { toTitle(); }
  }

  function startPlay() {
    $('#title').hidden = true;
    stage.hidden = false;
    card.hidden = true;
    shownBones = 0;
    clearText();
    $('#bar [data-act=save]').disabled = replayMode;
    $('#bar [data-act=load]').disabled = replayMode;
    $('#bar [data-act=back]').disabled = replayMode;
    win.focus();
  }

  function newGame(name) {
    replayMode = false;
    const meta = store.meta();
    meta.name = name;
    store.saveMeta(meta);
    runner = N.newGame(name);
    startPlay();
    applyVisuals(false);
    pump();
  }

  function resume(save) {
    if (!save) return;
    replayMode = false;
    closeModal();
    const r = N.resume(save);
    runner = r.runner;
    startPlay();
    applyVisuals(false);
    let n = r.count;
    if (n === 0) { pump(); return; }
    // 保存時点までを即時に再現する
    for (let guard = 0; guard < 5000; guard++) {
      const ev = runner.next();
      if (ev.type === 'page') { clearText(); continue; }
      if (ev.type === 'text') {
        showText(ev, true);
        if (--n === 0) break;
        continue;
      }
      if (ev.type === 'choice' || ev.type === 'fin' || ev.type === 'eof') { break; }
      if (ev.type === 'visual' || ev.type === 'chapter' || ev.type === 'candle') applyVisuals(false);
    }
    applyVisuals(false);
    waiting = 'text';
    win.classList.add('ready');
    updateDebug();
  }

  function replayEnding(id) {
    replayMode = true;
    closeModal();
    runner = N.replayEnding(id, store.meta().name || '');
    startPlay();
    applyVisuals(false);
    pump();
  }

  function toTitle() {
    clearTimeout(creakTimer);
    finishTyping();
    waiting = null;
    runner = null;
    replayMode = false;
    stage.hidden = true;
    card.hidden = true;
    document.body.classList.remove('night');
    $('#title').hidden = false;
    $('#title [data-act=continue]').disabled = !store.hasAny();
    updateDebug();
  }

  /* ---------------- ダイアログ ---------------- */

  function openModal(title) {
    mbox.innerHTML = '';
    if (title) mbox.appendChild(el('h2', null, title));
    modal.hidden = false;
    return mbox;
  }
  function closeModal() { modal.hidden = true; mbox.innerHTML = ''; if (!stage.hidden) win.focus(); }
  function foot(box, buttons) {
    const f = el('div', 'foot');
    buttons.forEach(function (b) {
      const bt = el('button', null, b[0]);
      bt.addEventListener('click', b[1]);
      f.appendChild(bt);
    });
    box.appendChild(f);
    return f;
  }
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  function confirmBox(msg, ok) {
    const box = openModal('確認');
    box.appendChild(el('p', null, msg));
    foot(box, [['いいえ', closeModal], ['はい', function () { closeModal(); ok(); }]]);
  }

  function fmtTime(t) {
    const d = new Date(t);
    const z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  function slotButton(label, data, cls) {
    const b = el('button', 'slot' + (cls ? ' ' + cls : '') + (data ? '' : ' empty'));
    b.appendChild(el('span', 'no', label));
    b.appendChild(el('span', 'meta', data ? fmtTime(data.t) + '　' + N.placeLabel(data) : '――'));
    b.appendChild(el('span', 'head', data ? (data.head || '').replace(/^[\s　]+/, '').replace(/<<|>>/g, '') : '空き'));
    return b;
  }

  function openSave() {
    if (!runner || replayMode || (waiting !== 'text' && waiting !== 'choice')) return;
    const box = openModal('セーブ');
    store.slots().forEach(function (d, i) {
      const n = i + 1;
      const b = slotButton(String(n), d);
      b.addEventListener('click', function () {
        const doSave = function () {
          store.saveSlot(n, runner.saveData());
          openSave();
        };
        if (d) confirmBox(n + '番に上書きしますか？', doSave);
        else doSave();
      });
      box.appendChild(b);
    });
    foot(box, [['閉じる', closeModal]]);
  }

  function openLoad() {
    const box = openModal('ロード');
    const auto = store.auto();
    const ab = slotButton('直前', auto, 'auto');
    ab.disabled = !auto;
    ab.addEventListener('click', function () { resume(auto); });
    box.appendChild(ab);
    store.slots().forEach(function (d, i) {
      const b = slotButton(String(i + 1), d);
      b.disabled = !d;
      b.addEventListener('click', function () { resume(d); });
      box.appendChild(b);
    });
    foot(box, [['閉じる', closeModal]]);
  }

  function backToChoice() {
    const auto = store.auto();
    if (!auto || replayMode) return;
    resume(auto);
  }

  function openConfig() {
    const box = openModal('設定');
    const row = el('div', 'cfg-row');
    const lb = el('label', null, '文字送りの速さ');
    const r = el('input');
    r.type = 'range'; r.min = 0; r.max = 100; r.step = 5; r.value = cfg.speed;
    const hint = el('p', null, '');
    const upd = function () { hint.textContent = cfg.speed >= 100 ? '瞬間表示' : '1文字 ' + msPerChar() + 'ms'; };
    r.addEventListener('input', function () { cfg.speed = +r.value; store.saveCfg(cfg); upd(); });
    upd();
    row.appendChild(lb); row.appendChild(r); row.appendChild(hint);
    box.appendChild(row);
    foot(box, [['閉じる', closeModal]]);
  }

  function openName() {
    const box = openModal('あなたの名前');
    const inp = el('input');
    inp.type = 'text'; inp.maxLength = 10;
    inp.value = store.meta().name || '';
    inp.placeholder = '名前を入力';
    box.appendChild(inp);
    const warn = el('p', null, '');
    box.appendChild(warn);
    const go = function () {
      const v = inp.value.trim();
      if (!v) { warn.textContent = '名前を入れてください。'; return; }
      closeModal();
      newGame(v);
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) go(); });
    foot(box, [['やめる', closeModal], ['はじめる', go]]);
    setTimeout(function () { inp.focus(); }, 30);
  }

  function openGallery() {
    const box = openModal('エンディング');
    store.gallery().forEach(function (it, i) {
      const row = el('div', 'ed-item');
      row.appendChild(el('span', 'nm' + (it.open ? '' : ' locked'), (i + 1) + '．' + it.title));
      const b = el('button', null, '再生');
      b.disabled = !it.open;
      b.addEventListener('click', function () { replayEnding(it.id); });
      row.appendChild(b);
      box.appendChild(row);
    });
    foot(box, [['閉じる', closeModal]]);
  }

  /* ---------------- 入力 ---------------- */

  win.addEventListener('click', function () { if (waiting !== 'choice') advance(); });
  card.addEventListener('click', advance);

  document.addEventListener('keydown', function (e) {
    if (!modal.hidden) { if (e.key === 'Escape') closeModal(); return; }
    if (stage.hidden && card.hidden) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target && e.target.tagName === 'BUTTON' && waiting === 'choice') return;
      e.preventDefault();
      if (waiting === 'choice') return;
      advance();
    } else if (waiting === 'choice' && /^[1-9]$/.test(e.key)) {
      const i = +e.key - 1;
      if (i < choicesEl.children.length) pick(i);
    }
  });

  $('#bar').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    switch (b.dataset.act) {
      case 'save': openSave(); break;
      case 'load': openLoad(); break;
      case 'back': backToChoice(); break;
      case 'config': openConfig(); break;
      case 'title': confirmBox('タイトルに戻りますか？（セーブしていない進行は失われます）', toTitle); break;
    }
  });

  $('#title').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    switch (b.dataset.act) {
      case 'new': openName(); break;
      case 'continue': openLoad(); break;
      case 'gallery': openGallery(); break;
      case 'config': openConfig(); break;
    }
  });

  /* ---------------- デバッグ ---------------- */

  const dbg = $('#debug');
  function updateDebug() {
    if (!DEBUG) return;
    dbg.hidden = false;
    const st = runner ? runner.state : null;
    let html = '<b>DEBUG</b>';
    if (st) {
      html += '<div class="row">p1=' + st.p1 + ' p2=' + st.p2 + ' p3=' + st.p3 + '</div>' +
        '<div>f1=' + st.f1 + ' f2=' + st.f2 + ' f3=' + st.f3 + ' fin=' + (st.fin || '-') + '</div>' +
        '<div>' + runner.file + ':' + runner.pc + ' ch=' + st.ch + '</div>';
    } else {
      html += '<div class="row">(title)</div>';
    }
    html += '<div class="row"><select id="dbg-jump">' + N.FILES.map(function (f) { return '<option>' + f + '</option>'; }).join('') + '</select>' +
      '<button id="dbg-go">jump</button></div>' +
      '<div class="row">' + ['p1', 'p2', 'p3'].map(function (p) { return '<button data-p="' + p + '">' + p + '+1</button>'; }).join('') + '</div>' +
      '<div class="row">' + ['f1', 'f2', 'f3'].map(function (f) { return '<button data-f="' + f + '">' + f + '</button>'; }).join('') + '</div>' +
      '<div class="row"><button id="dbg-reset">reset endings</button></div>';
    dbg.innerHTML = html;
  }

  if (DEBUG) {
    dbg.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'dbg-go') {
        const f = $('#dbg-jump').value;
        const st = runner ? runner.state : N.initState(store.meta().name || 'テスト');
        if (/^ed/.test(f)) { st.ch = 12; st.candles = '1011010'; }
        replayMode = false;
        closeModal();
        runner = new N.Runner(st, f, 0);
        startPlay();
        applyVisuals(false);
        pump();
      } else if (b.id === 'dbg-reset') {
        store.resetEndings();
        const box = openModal('DEBUG');
        box.appendChild(el('p', null, 'エンディング到達記録を消去しました'));
        foot(box, [['閉じる', closeModal]]);
      } else if (b.dataset.p && runner) {
        runner.state[b.dataset.p]++;
      } else if (b.dataset.f && runner) {
        runner.state[b.dataset.f] = runner.state[b.dataset.f] ? 0 : 1;
      }
      updateDebug();
    });
  }

  /* ---------------- 起動 ---------------- */
  toTitle();
})();
