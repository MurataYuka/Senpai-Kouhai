/* ADV エンジン：画面と操作、保存、音、作品の演出の呼び出し */
(function () {
  'use strict';
  var C = window.ADV;
  var CFG = window.ADV_CONFIG;
  var E = window.ADV_EFFECTS || {};
  var $ = function (id) { return document.getElementById(id); };
  var DEBUG = /[?&]debug=1(&|$)/.test(location.search);

  if (!$('fatal').hidden) return; // 読み込み中にエラーが出ていたら始めない
  var missing = CFG.files.filter(function (n) { return !C.files[n]; });
  if (missing.length) { window.ADV_FATAL('シナリオが登録されていません（ADV.add の名前を確かめてください）：' + missing.join(', ')); return; }

  var NAME = CFG.name || {};
  var SELF = CFG.selfMark === undefined ? '▷' : CFG.selfMark;
  var SLOTS = CFG.saveSlots || 11;
  var REC_ON = !!(CFG.records && CFG.records.enabled);
  var BGM = CFG.bgm || {};

  /* ---------- 保存（名前の頭に作品ID。localStorage が使えなくても動く） ---------- */
  var PREFIX = C.storagePrefix();
  var mem = {};
  function sget(k, def) {
    try {
      var v = window.localStorage.getItem(PREFIX + k);
      if (v === null || v === undefined) return mem[k] !== undefined ? mem[k] : def;
      return JSON.parse(v);
    } catch (e) { return mem[k] !== undefined ? mem[k] : def; }
  }
  function sset(k, v) {
    mem[k] = v;
    try { window.localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても続ける */ }
  }

  var opt = sget('opt', { vol: 70, mute: false, lastName: '' });   // 設定
  var readSet = sget('read', {});      // 既読：{ ファイル名: { 鍵: 1 } }（セーブとは別）
  var ends = sget('ends', {});         // 到達記録：{ edNN: { name, vars, t } }（セーブとは別）
  var recs = sget('records', {});      // 記録の解放：{ rNN: 時刻 }（セーブとは別）

  function isRead(key) { var i = key.indexOf(':'); var f = key.slice(0, i); return !!(readSet[f] && readSet[f][key.slice(i + 1)]); }
  var readDirty = false;
  function markRead(key) {
    var i = key.indexOf(':'); var f = key.slice(0, i);
    (readSet[f] = readSet[f] || {})[key.slice(i + 1)] = 1;
    readDirty = true;
  }
  function flushRead() { if (readDirty) { readDirty = false; sset('read', readSet); } }
  setInterval(flushRead, 1500);
  window.addEventListener('beforeunload', flushRead);
  window.addEventListener('pagehide', flushRead);

  /* ---------- 音 ----------
     @bgm 名前 で鳴らし始め、止めるのは「はじめから」「ロード」「別のエンディングを開く」と @bgm stop だけ。
     音源ファイルが無い・再生できないときは何もしない（無音で続ける）。 */
  var bgm = { a: null, name: null, owner: null };
  function effVol() { return opt.mute ? 0 : Math.max(0, Math.min(1, opt.vol / 100)); }
  function bgmPlay(name, owner) {
    if (bgm.a && bgm.name === name) { bgm.owner = owner; return; }
    bgmFade();
    var exts = BGM.ext || ['.mp3', '.ogg'];
    var dir = BGM.dir || 'assets/bgm/';
    var k = 0, a;
    try { a = new Audio(); } catch (e) { return; }
    a.loop = true;
    a.volume = effVol();
    bgm = { a: a, name: name, owner: owner };
    function tryNext() {
      if (bgm.a !== a) return;
      if (k >= exts.length) { bgm = { a: null, name: null, owner: null }; return; }
      try {
        a.src = dir + name + exts[k++];
        var p = a.play();
        if (p && p.catch) p.catch(function () { /* 自動再生の制限など。無音で続ける */ });
      } catch (e) { tryNext(); }
    }
    a.addEventListener('error', tryNext);
    tryNext();
  }
  function bgmFade() {
    if (!bgm.a) return;
    var a = bgm.a;
    bgm = { a: null, name: null, owner: null };
    var ms = BGM.fadeMs || 1500, step = 50;
    var v = a.volume, dv = Math.max(0.01, v * step / ms);
    var iv = setInterval(function () {
      v -= dv;
      if (v <= 0) { clearInterval(iv); try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { } }
      else { try { a.volume = v; } catch (e) { clearInterval(iv); } }
    }, step);
  }
  function bgmApplyVol() { if (bgm.a) { try { bgm.a.volume = effVol(); } catch (e) { } } }

  /* ---------- 状態 ---------- */
  var st = null;
  var waiting = null;
  var skipping = false;
  var log = [];
  var inGame = false;
  var cardTimer = null;
  var elLines = $('lines'), elBox = $('box'), elChoices = $('choices');

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1800);
  }

  /* ---------- 作品の演出の呼び出し ---------- */
  function transient(el, cls, ms) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms || 1200);
  }
  // 揺れと光は枠と奥のレイヤーだけ。本文には触れない
  function shake() { transient($('frame'), 'fx-shake'); transient($('back'), 'fx-shake'); }
  function flash() { transient($('frame'), 'fx-flash'); transient($('back'), 'fx-flash'); }

  function ctx(extra) {
    var c = {
      state: st, vars: st ? st.vars : null, file: st ? st.file : null,
      skipping: skipping, restoring: false, debug: DEBUG,
      back: $('back'), bg: $('bg'), layer: $('fxLayer'), frame: $('frame'),
      shake: shake, flash: flash, toast: toast
    };
    if (extra) for (var k in extra) c[k] = extra[k];
    return c;
  }
  function callE(fn, obj, args) {
    obj = obj || E;
    if (!obj || typeof obj[fn] !== 'function') return undefined;
    try { return obj[fn].apply(E, args); }
    catch (e) { console.error('[effects] ' + fn, e); if (DEBUG) toast('演出エラー: ' + fn); }
    return undefined;
  }

  // @vis：状態として残る見た目。body に data-v-名前 を付ける（CSS だけでも使える）＋ effects.vis[名前] を呼ぶ
  function applyVis(key, val, restoring) {
    if (val === '' || val === 'off') document.body.removeAttribute('data-v-' + key);
    else document.body.setAttribute('data-v-' + key, val);
    callE(key, E.vis, [val, ctx({ restoring: !!restoring })]);
  }
  function resetVis() {
    Array.prototype.slice.call(document.body.attributes).forEach(function (a) {
      if (a.name.indexOf('data-v-') === 0) document.body.removeAttribute(a.name);
    });
    $('chapLabel').textContent = '';
    callE('onReset', E, [ctx()]);
  }
  function restoreVis() {
    Object.keys(st.vis || {}).forEach(function (k) { if (k !== 'chap') applyVis(k, st.vis[k], true); });
    $('chapLabel').textContent = st.vis.chap || '';
  }

  var coreHooks = {
    chapter: function (file) { callE('onChapter', E, [file, ctx()]); },
    param: function (name, v, prev) { callE('onParam', E, [name, v, prev, ctx()]); },
    cmd: function (c, a, s) {
      var sp = a.search(/\s/), head = sp < 0 ? a : a.slice(0, sp), rest = sp < 0 ? '' : a.slice(sp + 1).trim();
      switch (c) {
        case 'set': break;
        case 'page': elLines.innerHTML = ''; break;
        case 'title': showCard(a); break;
        case 'vis': applyVis(head, rest, false); break;
        case 'fx':
          if (skipping) return;   // 一時的な演出はスキップ中は省く
          if (E.fx && typeof E.fx[head] === 'function') callE(head, E.fx, [rest, ctx()]);
          else if (head === 'shake') shake();
          else if (head === 'flash') flash();
          else console.warn('未定義の @fx: ' + head);
          break;
        case 'bgm':
          if (a === 'stop') bgmFade(); else bgmPlay(a, s.file);
          break;
        case 'mark': callE('onMark', E, [head, rest, ctx()]); break;
        case 'record': unlockRecord(a); break;
        default:
          if (E.commands && typeof E.commands[c] === 'function') callE(c, E.commands, [a, ctx()]);
          else console.warn('作品独自の命令 @' + c + ' の処理が effects.js にありません');
      }
    }
  };

  function showCard(a) {
    var p = a.split('|');
    $('chapLabel').textContent = p[0] || '';
    elLines.innerHTML = '';
    st.page = [];
    $('cardNo').textContent = p[0] || '';
    $('cardName').textContent = p[1] || '';
    var card = $('card');
    card.hidden = false;
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    clearTimeout(cardTimer);
    cardTimer = setTimeout(function () { card.hidden = true; }, skipping ? 600 : 3200);
  }

  /* ---------- 本文 ---------- */
  function isSelf(s) { return !!SELF && s.indexOf(SELF) === 0; }
  function addLine(text, fresh) {
    var p = document.createElement('p');
    p.textContent = text;
    if (isSelf(text)) p.className = 'me';
    if (fresh) p.classList.add('new');
    elLines.appendChild(p);
    return p;
  }
  function renderPage() {
    elLines.innerHTML = '';
    (st.page || []).forEach(function (s) { addLine(s, false); });
    elBox.scrollTop = elBox.scrollHeight;
  }
  function pushText(ins, key) {
    var s = C.subst(ins.s, st);
    addLine(s, !skipping);
    // 収まらなければ改ページ
    if (elBox.scrollHeight > elBox.clientHeight + 2 && elLines.children.length > 1) {
      elLines.innerHTML = '';
      st.page = [];
      addLine(s, !skipping);
    }
    st.page.push(s);
    elBox.scrollTop = elBox.scrollHeight;
    log.push(s);
    if (log.length > 400) log.shift();
    callE('onText', E, [s, ctx({ key: key })]);
  }

  function proceed() {
    var ev;
    try { ev = C.run(st, coreHooks); }
    catch (e) { console.error(e); toast(DEBUG ? e.message : '本文の読み込みに失敗しました'); return; }
    waiting = ev;
    if (ev.type === 'text') {
      if (skipping && !isRead(ev.key)) setSkip(false);   // 未読で止まる
      pushText(ev.ins, ev.key);
      markRead(ev.key);
    } else if (ev.type === 'choice') {
      setSkip(false);                                    // 選択肢で止まる
      sset('qsave', snap());                             // 直前の選択肢セーブ
      showChoices(ev.ins);
    } else if (ev.type === 'end') {
      setSkip(false);
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

  // 選択肢はデータに書いた順のまま出す（並べ替えない）
  function showChoices(ins) {
    elChoices.innerHTML = '';
    ins.opts.forEach(function (o, i) {
      var b = document.createElement('button');
      b.textContent = C.subst(o.text, st);
      b.addEventListener('click', function (e) { e.stopPropagation(); pick(i); });
      elChoices.appendChild(b);
    });
    elChoices.hidden = false;
    // Enter の押しっぱなしで選んでしまわないよう、フォーカスは外す（数字キーで選べる）
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function pick(i) {
    if (!waiting || waiting.type !== 'choice') return;
    elChoices.hidden = true;
    var o = C.choose(st, i, coreHooks);
    log.push(C.subst(o.text, st));
    proceed();
  }

  /* ---------- スキップ（既読だけ。未読と選択肢で止まる） ---------- */
  var skipTimer = null;
  function setSkip(on) {
    skipping = !!on && inGame;
    $('btnSkip').classList.toggle('on', skipping);
    elBox.classList.toggle('skipping', skipping);
    clearInterval(skipTimer);
    if (skipping) {
      skipTimer = setInterval(function () {
        if (!skipping || !$('panel').hidden) return;
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

  function toTitle() {       // 曲は止めない
    closePanel();
    show('titleScr');
    resetVis();
    $('tQload').disabled = !sget('qsave', null);
    waiting = null;
    dbgRefresh();
  }

  function begin(state, fresh) {
    st = state;
    log = [];
    elChoices.hidden = true;
    $('card').hidden = true;
    show('game');
    resetVis();
    restoreVis();
    renderPage();
    if (fresh) coreHooks.chapter(st.file);
    else callE('onRestore', E, [ctx({ restoring: true })]);
    proceed();
  }

  function newGame(name) {
    bgmFade();
    opt.lastName = name; sset('opt', opt);
    begin(C.newState(name), true);
  }

  function snap() {
    var s = C.clone(st);
    var ins = C.files[st.file] && C.files[st.file].code[st.pc];
    // 表示中の行はロード後にもう一度出るので、ページの控えからは外しておく
    if (ins && ins.t === 'text' && s.page.length) s.page.pop();
    s._t = Date.now();
    s._line = ins && ins.t === 'text' ? C.subst(ins.s, st) : (ins && ins.t === 'choice' ? '（選択肢）' : '');
    return s;
  }
  function loadState(s) {
    if (!s) return;
    var copy = C.clone(s);
    delete copy._t; delete copy._line;
    var F = C.files[copy.file];
    if (!F || !F.code[copy.pc]) { toast('このセーブは読み込めません'); return; }
    bgmFade();
    closePanel();
    begin(copy, false);
  }

  function finish(ed) {
    if (C.allEnds().indexOf(ed) < 0) console.warn('設定にないエンディング: ' + ed);
    ends[ed] = { name: st.name, vars: C.clone(st.vars), t: Date.now() };
    sset('ends', ends);
    $('endMark').textContent = CFG.endMark || '終';
    $('endSub').textContent = C.endTitle(ed);
    show('endScr');
    $('endOk').focus();
  }

  function openEnding(ed) {
    if (!(bgm.a && bgm.owner === ed)) bgmFade();   // 別のエンディングを開いたら曲を止める
    closePanel();
    var rec = ends[ed];
    var s = C.newState(rec ? rec.name : (opt.lastName || NAME.default || ''));
    if (rec && rec.vars) for (var k in rec.vars) s.vars[k] = rec.vars[k];
    s.file = ed; s.pc = 0;
    begin(s, true);
  }

  /* ---------- 記録（任意機能） ---------- */
  function unlockRecord(id) {
    if (!REC_ON) return;
    if (!C.records[id]) { console.warn('未定義の記録: ' + id); return; }
    if (recs[id]) return;
    recs[id] = Date.now();
    sset('records', recs);
    toast((CFG.records && CFG.records.toast) || '記録が追加されました');
  }

  /* ---------- パネル ---------- */
  function openPanel(title, build, cls) {
    $('ptitle').textContent = title;
    var body = $('pbody');
    body.innerHTML = '';
    body.className = cls || '';
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
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function note(body, text) {
    var nt = document.createElement('div');
    nt.className = 'note';
    nt.textContent = text;
    body.appendChild(nt);
  }

  function slotPanel(mode) {
    openPanel(mode === 'save' ? 'セーブ' : 'ロード', function (body) {
      for (var i = 1; i <= SLOTS; i++) (function (n) {
        var no = pad2(n);
        var s = sget('save' + no, null);
        var b = document.createElement('button');
        b.className = 'slot' + (s ? '' : ' empty');
        b.innerHTML = '<span class="no">' + no + '</span><span class="inf">' +
          (s ? esc((s.vis && s.vis.chap ? s.vis.chap + '　' : '') + (s._line || '')) : '――') +
          '</span><span class="dt">' + (s ? fmtDate(s._t) : '') + '</span>';
        b.addEventListener('click', function () {
          if (mode === 'save') {
            if (!inGame || !st) return;
            sset('save' + no, snap());
            toast('スロット' + no + 'に保存しました');
            slotPanel('save');
          } else if (s) loadState(s);
        });
        if (mode === 'load' && !s) b.disabled = true;
        if (mode === 'save' && !inGame) b.disabled = true;
        body.appendChild(b);
      })(i);
      note(body, '選択肢が出るたびに、手動スロットとは別に自動で保存されます（「直前の選択肢」から戻れます）。');
    });
  }

  function galleryPanel() {
    openPanel('エンディング一覧', function (body) {
      var main = C.mainEnds(), extra = C.extraEnds();
      main.forEach(function (ed) { body.appendChild(edRow(ed, !!ends[ed])); });
      if (extra.length && C.extraUnlocked(ends)) {
        var sep = document.createElement('div');
        sep.className = 'edsep';
        sep.textContent = '――　追加　――';
        body.appendChild(sep);
        extra.forEach(function (ed) { body.appendChild(edRow(ed, true)); });
      }
      note(body, '回収：' + main.filter(function (e) { return ends[e]; }).length + ' / ' + main.length);
    });
  }
  function edRow(ed, open) {
    var b = document.createElement('button');
    b.className = 'edrow' + (open ? '' : ' locked');
    b.innerHTML = '<span class="no">' + esc(ed.replace(/^\D+/, '')) + '</span><span>' + (open ? esc(C.endTitle(ed)) : '？？？') + '</span>';
    if (open) b.addEventListener('click', function () { openEnding(ed); });
    else b.disabled = true;
    return b;
  }

  function recordsPanel() {
    openPanel('記録', function (body) {
      var ids = C.recordIds();
      ids.forEach(function (id) {
        var r = C.records[id], open = !!recs[id];
        var b = document.createElement('button');
        b.className = 'edrow' + (open ? '' : ' locked');
        b.innerHTML = '<span class="no">' + esc(id.slice(1)) + '</span><span>' + (open ? esc(r.title || id) : '？？？') + '</span>';
        if (open) b.addEventListener('click', function () { recordView(id); });
        else b.disabled = true;
        body.appendChild(b);
      });
      note(body, '解放：' + ids.filter(function (id) { return recs[id]; }).length + ' / ' + ids.length);
    });
  }
  function recordView(id) {
    var r = C.records[id];
    openPanel('記録　' + id.slice(1), function (body) {
      var h = document.createElement('div');
      h.className = 'rechead';
      h.textContent = r.title || '';
      body.appendChild(h);
      String(r.body || '').split(/\n/).forEach(function (line) {
        var p = document.createElement('p');
        p.textContent = line;
        body.appendChild(p);
      });
      var back = document.createElement('button');
      back.textContent = '一覧へ';
      back.className = 'recback';
      back.addEventListener('click', recordsPanel);
      body.appendChild(back);
    }, 'rec');
  }

  function configPanel() {
    openPanel('設定', function (body) {
      body.innerHTML =
        '<div class="cfg">' +
        '<label for="cVol">音量</label><input type="range" id="cVol" min="0" max="100" step="1">' +
        '<label for="cMute">消音</label><div><input type="checkbox" id="cMute"></div>' +
        '</div>';
      note(body, 'クリック／Enter／Space：次へ　1〜9：選択肢　S：スキップ（既読のみ・未読と選択肢で止まります）　Esc：閉じる');
      var v = $('cVol'), m = $('cMute');
      v.value = opt.vol; m.checked = !!opt.mute;
      v.addEventListener('input', function () { opt.vol = Number(v.value); bgmApplyVol(); sset('opt', opt); });
      m.addEventListener('change', function () { opt.mute = m.checked; bgmApplyVol(); sset('opt', opt); });
    });
  }

  function logPanel() {
    openPanel('ログ', function (body) {
      log.slice(-200).forEach(function (s) {
        var p = document.createElement('p');
        p.textContent = s;
        if (isSelf(s)) p.className = 'me';
        body.appendChild(p);
      });
      setTimeout(function () { body.scrollTop = body.scrollHeight; }, 0);
    }, 'log');
  }

  /* ---------- 入力 ---------- */
  function act(a) {
    switch (a) {
      case 'new':
        if (NAME.ask === false) { newGame(NAME.default || ''); break; }
        show('nameScr');
        $('nameIn').value = opt.lastName || '';
        $('nameIn').focus();
        break;
      case 'load': slotPanel('load'); break;
      case 'save': slotPanel('save'); break;
      case 'qload':
        var q = sget('qsave', null);
        if (q) loadState(q); else toast('記録がありません');
        break;
      case 'gallery': galleryPanel(); break;
      case 'records': if (REC_ON) recordsPanel(); break;
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
    var vn = C.varNames();
    d.innerHTML =
      '<div>保存名：' + esc(PREFIX) + '*</div>' +
      '<div id="dbgV"></div><div id="dbgA"></div>' +
      '<div><select id="dbgJ">' + names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<input id="dbgL" placeholder="ラベル" style="width:5em"><button id="dbgGo">移動</button></div>' +
      '<div>' + vn.map(function (v) { return esc(v) + '<input id="dbg_' + esc(v) + '" type="number">'; }).join(' ') + (vn.length ? '<button id="dbgSet">反映</button>' : '') + '</div>' +
      '<div><button id="dbgAll">全エンディング解放</button> <button id="dbgRec">全記録解放</button></div>' +
      '<div><button id="dbgRd">既読消去</button> <button id="dbgClr">到達・記録消去</button></div>';
    dbgRefresh = function () {
      $('dbgA').textContent = '曲：' + (bgm.a ? bgm.name + (bgm.a.paused ? '（停止中）' : '（再生中）') + ' vol=' + bgm.a.volume.toFixed(2) : 'なし');
      if (!st) { $('dbgV').textContent = '(未開始)'; return; }
      $('dbgV').textContent = st.file + ':' + st.pc + '  ' + vn.map(function (v) { return v + '=' + st.vars[v]; }).join(' ');
      vn.forEach(function (v) { var el = $('dbg_' + v); if (document.activeElement !== el) el.value = st.vars[v]; });
    };
    setInterval(dbgRefresh, 500);
    $('dbgGo').addEventListener('click', function () {
      var f = $('dbgJ').value, lb = $('dbgL').value.trim();
      var s = st ? C.clone(st) : C.newState(opt.lastName || NAME.default || 'テスト');
      try { var r = C.resolve(lb ? f + ':' + lb : f, f); s.file = r.file; s.pc = r.pc; }
      catch (e) { toast(e.message); return; }
      s.page = [];
      if (!s.name) s.name = opt.lastName || NAME.default || 'テスト';
      closePanel();
      begin(s, !lb);
    });
    if (vn.length) $('dbgSet').addEventListener('click', function () {
      if (!st) return;
      vn.forEach(function (v) { st.vars[v] = Number($('dbg_' + v).value) || 0; });
      dbgRefresh();
    });
    $('dbgAll').addEventListener('click', function () {
      C.allEnds().forEach(function (e) { if (!ends[e]) ends[e] = { name: opt.lastName || NAME.default || 'テスト', vars: C.newState('').vars, t: Date.now() }; });
      sset('ends', ends);
      toast('全エンディングを解放しました');
    });
    $('dbgRec').addEventListener('click', function () {
      C.recordIds().forEach(function (id) { if (!recs[id]) recs[id] = Date.now(); });
      sset('records', recs);
      toast(REC_ON ? '全記録を解放しました' : '記録機能はオフです（config.records.enabled）');
    });
    $('dbgRd').addEventListener('click', function () { readSet = {}; sset('read', readSet); toast('既読を消去しました'); });
    $('dbgClr').addEventListener('click', function () {
      ends = {}; recs = {}; sset('ends', ends); sset('records', recs);
      toast('到達記録と記録の解放を消去しました');
    });
    window.ADV_DEBUG = { state: function () { return st; }, bgm: function () { return bgm; }, storage: { get: sget, set: sset } };
  })();

  /* ---------- 起動 ---------- */
  document.title = CFG.title || document.title;
  $('titleMain').textContent = CFG.title || '';
  $('titleSub').textContent = CFG.subtitle || '';
  $('namePrompt').textContent = NAME.prompt || 'あなたの名前を入力してください。';
  $('nameIn').maxLength = NAME.max || 10;
  document.querySelectorAll('.needRecords').forEach(function (b) { b.hidden = !REC_ON; });
  callE('init', E, [ctx()]);
  window.ADV_READY = true;
  toTitle();
})();
