/* 画面と操作 */
(function () {
  'use strict';
  var C = window.ASANAGI;
  var META = window.ASANAGI_META || { ends: {}, chapters: {} };
  var $ = function (id) { return document.getElementById(id); };
  var DEBUG = /[?&]debug=1(&|$)/.test(location.search);

  /* ---------- 保存（使えなくても動く） ---------- */
  var mem = {};
  var KEY = 'asanagi.';
  function sget(k, def) {
    try {
      var v = window.localStorage.getItem(KEY + k);
      if (v === null || v === undefined) return mem[k] !== undefined ? mem[k] : def;
      return JSON.parse(v);
    } catch (e) { return mem[k] !== undefined ? mem[k] : def; }
  }
  function sset(k, v) {
    mem[k] = v;
    try { window.localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても続ける */ }
  }
  function sdel(k) {
    delete mem[k];
    try { window.localStorage.removeItem(KEY + k); } catch (e) { }
  }

  var SLOTS = 11;
  var cfg = sget('cfg', { vol: 70, mute: false, lastName: '' });
  var readSet = sget('read', {});   // 既読：{ ファイル名: { pc: 1 } }
  var ends = sget('ends', {});      // 到達記録：{ edNN: { name, vars, t } }

  function isRead(key) { var p = key.split(':'); return !!(readSet[p[0]] && readSet[p[0]][p[1]]); }
  var readDirty = false;
  function markRead(key) {
    var p = key.split(':');
    (readSet[p[0]] = readSet[p[0]] || {})[p[1]] = 1;
    readDirty = true;
  }
  setInterval(function () { if (readDirty) { readDirty = false; sset('read', readSet); } }, 1500);
  window.addEventListener('beforeunload', function () { if (readDirty) sset('read', readSet); });

  /* ---------- 音 ---------- */
  var audio = null;
  function effVol() { return cfg.mute ? 0 : Math.max(0, Math.min(1, cfg.vol / 100)); }
  function bgmPlay(name) {
    if (audio && audio._name === name) return;
    bgmFade();
    try {
      var a = new Audio();
      a._name = name;
      a.loop = true;
      a.volume = effVol();
      a.addEventListener('error', function () { if (audio === a) audio = null; });
      a.src = 'assets/bgm/' + name + '.mp3';
      audio = a;
      var p = a.play();
      if (p && p.catch) p.catch(function () { /* 音源が無い・再生できないときは無音で続ける */ });
    } catch (e) { audio = null; }
  }
  function bgmFade() {
    if (!audio) return;
    var a = audio; audio = null;
    var v = a.volume;
    var iv = setInterval(function () {
      v -= 0.04;
      if (v <= 0) { clearInterval(iv); try { a.pause(); } catch (e) { } }
      else { try { a.volume = v; } catch (e) { clearInterval(iv); } }
    }, 60);
  }
  function bgmApplyVol() { if (audio) { try { audio.volume = effVol(); } catch (e) { } } }

  /* ---------- 状態 ---------- */
  var st = null;
  var waiting = null;
  var skipping = false;
  var log = [];
  var inGame = false;
  var cardTimer = null;

  var elLines = $('lines'), elBox = $('box'), elChoices = $('choices'), elFrame = $('frame');

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 画面効果の反映 ---------- */
  function applyCrew(v, jump) {
    var el = $('crew');
    el.textContent = v;
    el.classList.toggle('small', !/^\d+$/.test(v));
    if (jump) { el.classList.add('jump'); setTimeout(function () { el.classList.remove('jump'); }, 400); }
  }
  function applyBgA(v, instant) {
    var ly = $('lyA'), sp = $('space');
    if (instant) { ly.style.transition = 'none'; sp.style.transition = 'none'; }
    ly.classList.remove('shut', 'open');
    sp.classList.toggle('on', v === 'shut' || v === 'open');
    if (v === 'shut') ly.classList.add('shut');
    if (v === 'open') ly.classList.add('open');
    if (instant) { void ly.offsetWidth; ly.style.transition = ''; sp.style.transition = ''; }
  }
  function applyVis(vis, instant) {
    FX.setWave(vis.wave);
    applyCrew(vis.crew, false);
    applyBgA(vis.bgA, instant);
    FX.setRings(vis.bgB);
    $('dimmer').classList.toggle('on', vis.dim === 'on');
    elFrame.classList.toggle('alert', vis.alert === 'on');
    $('hudChap').textContent = vis.chap || '';
  }
  function transient(cls, target) {
    var el = target || elFrame;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 1200);
  }

  var hooks = {
    cmd: function (c, a, s) {
      if (skipping && (c === 'fx')) return;
      switch (c) {
        case 'wave': FX.setWave(a); break;
        case 'crew': applyCrew(a, true); break;
        case 'bgA': applyBgA(a, skipping || a === 'shut'); break;
        case 'bgB': FX.setRings(a); break;
        case 'dim': $('dimmer').classList.toggle('on', a === 'on'); break;
        case 'alert': elFrame.classList.toggle('alert', a === 'on'); break;
        case 'fx':
          if (a === 'quake') { transient('quake'); transient('quake', $('back')); }
          else if (a === 'flash') transient('flash');
          break;
        case 'page': elLines.innerHTML = ''; break;
        case 'title': showCard(a); break;
        case 'bgm':
          if (a === 'stop') bgmFade(); else bgmPlay(a);
          break;
      }
    }
  };

  function showCard(a) {
    var p = a.split('|');
    $('hudChap').textContent = p[0];
    elLines.innerHTML = '';
    st.page = [];
    $('cardNo').textContent = p[0] || '';
    $('cardName').textContent = p[1] || '';
    var card = $('card');
    card.hidden = false;
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    clearTimeout(cardTimer);
    cardTimer = setTimeout(function () { card.hidden = true; }, skipping ? 600 : 3800);
  }

  /* ---------- 本文 ---------- */
  function addLine(text, me, fresh) {
    var p = document.createElement('p');
    p.innerHTML = esc(text);
    if (me) p.className = 'me';
    if (fresh) p.classList.add('new');
    elLines.appendChild(p);
    return p;
  }
  function renderPage() {
    elLines.innerHTML = '';
    (st.page || []).forEach(function (l) { addLine(l.s, l.me, false); });
    elBox.scrollTop = elBox.scrollHeight;
  }
  function pushText(ins) {
    var s = C.subst(ins.s, st);
    var me = s.charAt(0) === '▷';
    var p = addLine(s, me, !skipping);
    // 収まらなければ改ページ
    if (elBox.scrollHeight > elBox.clientHeight + 2 && elLines.children.length > 1) {
      elLines.innerHTML = '';
      st.page = [];
      p = addLine(s, me, !skipping);
    }
    st.page.push({ s: s, me: me });
    elBox.scrollTop = elBox.scrollHeight;
    elFrame.classList.toggle('tint', !!ins.tint);
    log.push({ s: s, me: me });
    if (log.length > 400) log.shift();
  }

  function proceed() {
    var ev;
    try { ev = C.run(st, hooks); }
    catch (e) { console.error(e); toast('本文の読み込みに失敗しました'); return; }
    waiting = ev;
    if (ev.type === 'text') {
      var was = isRead(ev.key);
      if (skipping && !was) setSkip(false);
      pushText(ev.ins);
      markRead(ev.key);
      if (!$('card').hidden && !skipping) { /* 章題表示中 */ }
    } else if (ev.type === 'choice') {
      setSkip(false);
      elFrame.classList.remove('tint');
      sset('qsave', snap());
      showChoices(ev.ins);
    } else if (ev.type === 'end') {
      setSkip(false);
      elFrame.classList.remove('tint');
      finish(ev.ed);
    }
    dbgRefresh();
  }

  function next() {
    if (!inGame || !waiting || waiting.type !== 'text') return;
    if (!$('panel').hidden) return;
    C.advance(st);
    proceed();
  }

  function showChoices(ins) {
    elChoices.innerHTML = '';
    ins.opts.forEach(function (o, i) {
      var b = document.createElement('button');
      b.textContent = C.subst(o.text, st);
      b.addEventListener('click', function (e) { e.stopPropagation(); pick(i); });
      elChoices.appendChild(b);
    });
    elChoices.hidden = false;
    // Enter の押しっぱなしで選んでしまわないよう、フォーカスは外しておく（数字キーで選べる）
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function pick(i) {
    if (!waiting || waiting.type !== 'choice') return;
    elChoices.hidden = true;
    var o = C.choose(st, i);
    log.push({ s: C.subst(o.text, st), me: true });
    proceed();
  }

  /* ---------- スキップ ---------- */
  var skipTimer = null;
  function setSkip(on) {
    skipping = !!on && inGame;
    $('btnSkip').classList.toggle('on', skipping);
    elBox.classList.toggle('skipping', skipping);
    clearInterval(skipTimer);
    if (skipping) {
      skipTimer = setInterval(function () {
        if (!skipping) return;
        if (!$('panel').hidden) return;
        if (waiting && waiting.type === 'text') next();
        else setSkip(false);
      }, 45);
    }
  }

  /* ---------- 画面切り替え ---------- */
  function show(id) {
    ['titleScr', 'nameScr', 'endScr'].forEach(function (s) { $(s).hidden = s !== id; });
    $('game').hidden = id !== 'game';
    inGame = id === 'game';
    if (!inGame) setSkip(false);
  }

  function resetVis() {
    applyVis({ wave: '0', crew: '7', bgA: 'off', bgB: 'off', dim: 'off', alert: 'off', chap: '' }, true);
    elFrame.classList.remove('tint');
  }

  function toTitle() {
    closePanel();
    show('titleScr');
    resetVis();
    $('tQload').disabled = !sget('qsave', null);
    waiting = null;
  }

  function begin(state) {
    st = state;
    log = [];
    elChoices.hidden = true;
    $('card').hidden = true;
    show('game');
    applyVis(st.vis, true);
    renderPage();
    proceed();
  }

  function newGame(name) {
    bgmFade();
    cfg.lastName = name; sset('cfg', cfg);
    begin(C.newState(name));
  }

  function snap() {
    var s = C.clone(st);
    var ins = C.files[st.file] && C.files[st.file].code[st.pc];
    s._t = Date.now();
    s._line = ins && ins.t === 'text' ? C.subst(ins.s, st) : (ins && ins.t === 'choice' ? '（選択肢）' : '');
    return s;
  }
  function loadState(s) {
    if (!s) return;
    bgmFade();
    closePanel();
    var copy = C.clone(s);
    delete copy._t; delete copy._line;
    if (!C.files[copy.file]) { toast('このセーブは読み込めません'); return; }
    begin(copy);
  }

  function finish(ed) {
    ends[ed] = { name: st.name, vars: C.clone(st.vars), t: Date.now() };
    sset('ends', ends);
    var m = META.ends[ed];
    $('endSub').textContent = m ? m.title : '';
    show('endScr');
    $('endOk').focus();
  }

  function openEnding(ed) {
    if (ed !== 'ed07') bgmFade();
    closePanel();
    var rec = ends[ed];
    var s = C.newState(rec ? rec.name : (cfg.lastName || '先輩'));
    if (rec && rec.vars) s.vars = C.clone(rec.vars);
    s.file = ed; s.pc = 0;
    begin(s);
  }

  /* ---------- パネル ---------- */
  function openPanel(title, build) {
    $('ptitle').textContent = title;
    var body = $('pbody');
    body.innerHTML = '';
    build(body);
    $('panel').hidden = false;
  }
  function closePanel() { $('panel').hidden = true; }
  $('pclose').addEventListener('click', closePanel);

  function fmtDate(t) {
    var d = new Date(t);
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  function slotPanel(mode) {
    openPanel(mode === 'save' ? 'セーブ' : 'ロード', function (body) {
      for (var i = 1; i <= SLOTS; i++) (function (n) {
        var s = sget('save' + n, null);
        var b = document.createElement('button');
        b.className = 'slot' + (s ? '' : ' empty');
        var no = (n < 10 ? '0' : '') + n;
        b.innerHTML = '<span class="no">' + no + '</span><span class="inf">' +
          (s ? esc((s.vis && s.vis.chap ? s.vis.chap + '　' : '') + (s._line || '')) : '――') +
          '</span><span class="dt">' + (s ? fmtDate(s._t) : '') + '</span>';
        b.addEventListener('click', function () {
          if (mode === 'save') {
            if (!inGame) return;
            sset('save' + n, snap());
            toast('スロット' + no + 'に保存しました');
            slotPanel('save');
          } else if (s) {
            loadState(s);
          }
        });
        if (mode === 'load' && !s) b.disabled = true;
        body.appendChild(b);
      })(i);
      var nt = document.createElement('div');
      nt.className = 'note';
      nt.textContent = '選択肢が出るたびに、手動スロットとは別に自動で保存されます（「直前の選択肢」から戻れます）。';
      body.appendChild(nt);
    });
  }

  function galleryPanel() {
    openPanel('エンディング一覧', function (body) {
      C.MAIN_ENDS.forEach(function (ed) { body.appendChild(edRow(ed)); });
      if (C.extraUnlocked(ends)) {
        var sep = document.createElement('div');
        sep.className = 'edsep';
        sep.textContent = '――　追加　――';
        body.appendChild(sep);
        C.EXTRA_ENDS.forEach(function (ed) { body.appendChild(edRow(ed, true)); });
      }
      var got = C.MAIN_ENDS.filter(function (e) { return ends[e]; }).length;
      var nt = document.createElement('div');
      nt.className = 'note';
      nt.textContent = '回収：' + got + ' / ' + C.MAIN_ENDS.length;
      body.appendChild(nt);
    });
  }
  function edRow(ed, extra) {
    var b = document.createElement('button');
    var open = extra || !!ends[ed];
    var m = META.ends[ed] || {};
    b.className = 'edrow' + (open ? '' : ' locked');
    b.innerHTML = '<span class="no">' + ed.slice(2) + '</span><span>' + (open ? esc(m.title || ed) : '？？？') + '</span>';
    if (open) b.addEventListener('click', function () { openEnding(ed); });
    else b.disabled = true;
    return b;
  }

  function configPanel() {
    openPanel('設定', function (body) {
      body.innerHTML =
        '<div class="cfg">' +
        '<label for="cVol">音量</label><input type="range" id="cVol" min="0" max="100" step="1">' +
        '<label for="cMute">消音</label><div><input type="checkbox" id="cMute"></div>' +
        '</div>' +
        '<div class="note">クリック／Enter／Space：次へ　S：スキップ（既読のみ・未読と選択肢で止まります）　Esc：閉じる<br>本作は基本的に無音です。</div>';
      var v = $('cVol'), m = $('cMute');
      v.value = cfg.vol; m.checked = !!cfg.mute;
      v.addEventListener('input', function () { cfg.vol = Number(v.value); bgmApplyVol(); sset('cfg', cfg); });
      m.addEventListener('change', function () { cfg.mute = m.checked; bgmApplyVol(); sset('cfg', cfg); });
    });
  }

  function logPanel() {
    openPanel('ログ', function (body) {
      body.className = 'log';
      log.slice(-200).forEach(function (l) {
        var p = document.createElement('p');
        p.textContent = l.s;
        if (l.me) p.className = 'me';
        body.appendChild(p);
      });
      setTimeout(function () { body.scrollTop = body.scrollHeight; }, 0);
    });
  }
  // ログ以外ではクラスを戻す
  var _open = openPanel;
  openPanel = function (t, b) { $('pbody').className = ''; _open(t, b); };

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1800);
  }

  /* ---------- 入力 ---------- */
  function act(a) {
    switch (a) {
      case 'new':
        show('nameScr');
        $('nameIn').value = cfg.lastName || '';
        $('nameIn').focus();
        break;
      case 'load': slotPanel('load'); break;
      case 'save': slotPanel('save'); break;
      case 'qload':
        var q = sget('qsave', null);
        if (q) loadState(q); else toast('記録がありません');
        break;
      case 'gallery': galleryPanel(); break;
      case 'config': configPanel(); break;
      case 'log': logPanel(); break;
      case 'skip': setSkip(!skipping); break;
      case 'title': toTitle(); break;
    }
  }
  document.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); act(b.getAttribute('data-act')); });
  });

  $('nameOk').addEventListener('click', function () {
    var n = $('nameIn').value.trim();
    if (!n) { toast('名前を入力してください'); return; }
    newGame(n);
  });
  $('nameBack').addEventListener('click', toTitle);
  $('nameIn').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('nameOk').click(); }
  });
  $('endOk').addEventListener('click', toTitle);

  elBox.addEventListener('click', function () { if (skipping) setSkip(false); else next(); });
  $('game').addEventListener('click', function (e) {
    if (e.target === $('game') && waiting && waiting.type === 'text') { if (skipping) setSkip(false); else next(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { closePanel(); return; }
    if (!inGame) return;
    if (e.key === 's' || e.key === 'S') { if ($('panel').hidden) setSkip(!skipping); return; }
    if (!$('panel').hidden) return;
    if (waiting && waiting.type === 'choice' && /^[1-9]$/.test(e.key)) {
      var i = Number(e.key) - 1;
      if (i < waiting.ins.opts.length) pick(i);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && waiting && waiting.type === 'text') {
      e.preventDefault();
      if (skipping) setSkip(false); else next();
    }
  });

  /* ---------- デバッグ（?debug=1 のときだけ） ---------- */
  var dbgRefresh = function () { };
  if (DEBUG) (function () {
    var d = $('dbg');
    d.hidden = false;
    var names = Object.keys(C.files);
    d.innerHTML =
      '<div id="dbgV"></div>' +
      '<div><select id="dbgJ">' + names.map(function (n) { return '<option>' + n + '</option>'; }).join('') + '</select><button id="dbgGo">移動</button></div>' +
      '<div>' + C.VAR_NAMES.map(function (v) { return v + '<input id="dbg_' + v + '" type="number">'; }).join(' ') + '<button id="dbgSet">反映</button></div>' +
      '<div><button id="dbgAll">全エンディング解放</button> <button id="dbgRd">既読消去</button></div>';
    dbgRefresh = function () {
      if (!st) { $('dbgV').textContent = '(未開始)'; return; }
      $('dbgV').textContent = st.file + ':' + st.pc + '  ' + C.VAR_NAMES.map(function (v) { return v + '=' + st.vars[v]; }).join(' ');
      C.VAR_NAMES.forEach(function (v) { var el = $('dbg_' + v); if (document.activeElement !== el) el.value = st.vars[v]; });
    };
    $('dbgGo').addEventListener('click', function () {
      var f = $('dbgJ').value;
      var s = st ? C.clone(st) : C.newState(cfg.lastName || 'テスト');
      s.file = f; s.pc = 0; s.page = [];
      if (!s.name) s.name = cfg.lastName || 'テスト';
      closePanel();
      begin(s);
    });
    $('dbgSet').addEventListener('click', function () {
      if (!st) return;
      C.VAR_NAMES.forEach(function (v) { st.vars[v] = Number($('dbg_' + v).value) || 0; });
      dbgRefresh();
    });
    $('dbgAll').addEventListener('click', function () {
      C.ALL_ENDS.forEach(function (e) { if (!ends[e]) ends[e] = { name: cfg.lastName || 'テスト', vars: C.newState('').vars, t: Date.now() }; });
      sset('ends', ends);
      toast('全エンディングを解放しました');
    });
    $('dbgRd').addEventListener('click', function () { readSet = {}; sset('read', readSet); toast('既読を消去しました'); });
    dbgRefresh();
  })();

  toTitle();
})();
