/* engine.js — テキストADVエンジン（素のJS / file:// で動作） */
(function () {
  'use strict';

  /* ============================================================
   * 登録口（シナリオファイルから呼ぶ）
   * ============================================================ */
  const SNW = (window.SNW = window.SNW || {});
  const SCN = {};
  const CHS = {};
  SNW.scenes = (o) => Object.assign(SCN, o);
  SNW.chapter = (n, info) => { CHS[n] = info; };

  const LIMIT = { p1: [0, 100], p2: [0, 100], a1: [0, 100], a2: [0, 3] };
  const INIT_P = { p1: 20, p2: 0, p3: 0 };
  const DEFAULT_NAME = '遥';
  const LOG_MAX = 240;
  const DEBUG = /[?&]debug=1(?:&|$)/.test(location.search);
  const KEY = { cfg: 'snw_cfg', read: 'snw_read', end: 'snw_end', save: 'snw_save_', name: 'snw_name' };
  const SLOTS = ['1', '2', '3'];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ============================================================
   * 保存領域（localStorage が使えなくても動く）
   * ============================================================ */
  const mem = {};
  const Store = {
    get(k, d) {
      let v = null;
      try { v = localStorage.getItem(k); } catch (e) { /* 使えない環境 */ }
      if (v == null) return k in mem ? clone(mem[k]) : d;
      try { return JSON.parse(v); } catch (e) { return d; }
    },
    set(k, val) {
      mem[k] = clone(val);
      try { localStorage.setItem(k, JSON.stringify(val)); } catch (e) { /* 容量超過・無効 */ }
    },
    has(k) { return this.get(k, null) != null; },
  };

  /* ============================================================
   * 設定
   * ============================================================ */
  const reducedMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const cfg = Object.assign({ spd: 45, auto: 100, size: 'm', skipAll: false, calm: false }, Store.get(KEY.cfg, {}));
  const msPerChar = () => (cfg.spd >= 100 ? 0 : Math.round(8 + (100 - cfg.spd) * 0.72));
  function applyCfg() {
    document.documentElement.dataset.size = cfg.size;
    document.body.classList.toggle('calm', !!cfg.calm || reducedMQ.matches);
  }
  function saveCfg() { Store.set(KEY.cfg, cfg); applyCfg(); }

  /* ============================================================
   * 既読管理
   * ============================================================ */
  const readMap = Store.get(KEY.read, {});
  let readTimer = 0;
  function isRead(sc, i) { const s = readMap[sc]; return !!s && s.charCodeAt(i) === 49; }
  function markRead(sc, i) {
    if (isRead(sc, i)) return;
    let s = readMap[sc] || '';
    while (s.length <= i) s += '0';
    readMap[sc] = s.slice(0, i) + '1' + s.slice(i + 1);
    clearTimeout(readTimer);
    readTimer = setTimeout(() => Store.set(KEY.read, readMap), 400);
  }

  /* ============================================================
   * 文字列の整形
   *   {name}        … 主人公の名前
   *   ｜漢字《よみ》 / 漢字《よみ》 … ルビ
   *   《《語》》      … 傍点
   *   〈〈語〉〉      … 白い語（状態によって見えなくなる）
   *   \n            … 改行
   * ============================================================ */
  const RX = /《《(.+?)》》|｜([^《｜\n]+)《([^》]+)》|([々〆一-鿿]+)《([^》]+)》|〈〈(.+?)〉〉|\n/g;
  function units(src) {
    const s = String(src).replace(/\{name\}/g, G ? G.name : DEFAULT_NAME);
    const out = [];
    const plain = (str) => { for (const ch of str) out.push({ h: esc(ch), c: ch }); };
    let last = 0, m;
    RX.lastIndex = 0;
    while ((m = RX.exec(s))) {
      plain(s.slice(last, m.index));
      if (m[0] === '\n') out.push({ h: '<br>', c: '\n', br: 1 });
      else if (m[1]) for (const ch of m[1]) out.push({ h: '<em class="dot">' + esc(ch) + '</em>', c: ch });
      else if (m[6]) for (const ch of m[6]) out.push({ h: '<span class="w">' + esc(ch) + '</span>', c: ch });
      else {
        const b = m[2] || m[4], r = m[3] || m[5];
        out.push({ h: '<ruby>' + esc(b) + '<rt>' + esc(r) + '</rt></ruby>', c: b });
      }
      last = RX.lastIndex;
    }
    plain(s.slice(last));
    return out;
  }
  const html = (s) => units(s).map((u) => u.h).join('');
  const plainText = (s) => units(s).map((u) => (u.br ? ' ' : u.c)).join('');
  function cost(c) {
    if ('。！？'.includes(c)) return 7;
    if ('、，'.includes(c)) return 3.4;
    if (c === '…' || c === '―' || c === '—') return 2.2;
    return 1;
  }
  function norm(node) {
    const o = typeof node === 'string' ? { t: node } : Object.assign({}, node);
    let t = String(o.t);
    if (!o.k) o.k = /^▷/.test(t) ? 'm' : t[0] === '「' ? 'd' : 'n';
    if (o.k === 'm') t = t.replace(/^▷\s*/, '');
    o.t = t;
    return o;
  }

  /* ============================================================
   * 状態
   * ============================================================ */
  let G = null;
  const R = { state: 'idle', skip: false, auto: false, tAdv: 0, tWait: 0, tCard: 0, cardAt: 0 };
  let TY = null;
  let els = {};

  function newState(name, mode) {
    const s = {
      v: 1, name, sc: null, ip: 0, ch: 0, tone: '', mode: mode || '',
      p: Object.assign({}, INIT_P), f: {}, st: { me: [], tsu: [] },
      page: [], log: [], last: null,
    };
    // 後日談は専用の初期状態（シナリオ側の SNW.afterInit）から始める
    if (mode === 'af' && SNW.afterInit) {
      const a = SNW.afterInit;
      s.p = Object.assign({}, a.p);
      ['me', 'tsu'].forEach((w) => (a.st[w] || []).forEach((x) => {
        s.st[w].push(Object.assign({ note: '', cls: '' }, x));
        s.f[x.id] = 1;
      }));
    }
    return s;
  }
  const isAf = () => !!(G && G.mode === 'af');
  function applyMode() { document.body.classList.toggle('af', isAf()); }
  function lim(k, v) {
    const L = LIMIT[k];
    return L ? Math.max(L[0], Math.min(L[1], v)) : v;
  }
  function test(fn) {
    try { return !!fn(G); } catch (e) { console.error(e); return false; }
  }
  function chOf(sc) {
    const m = /^(ch|af)(\d+)_/.exec(sc || '');
    if (!m) return 0;
    return m[1] === 'af' ? 'a' + m[2] : +m[2];
  }

  /* ============================================================
   * 進行
   * ============================================================ */
  const STOP = 1;
  const isText = (n) => typeof n === 'string' || (n && n.t != null);
  const isChoice = (n) => n && n.o;

  function run() {
    clearTimeout(R.tAdv);
    for (let guard = 0; guard < 5000; guard++) {
      const list = SCN[G.sc];
      if (!list || G.ip >= list.length) { if (list) console.warn('scene ended without jump:', G.sc); showTBC(); return; }
      const node = list[G.ip];
      if (node && typeof node === 'object' && node.when && !test(node.when)) { G.ip++; continue; }
      if (exec(node) === STOP) { dbgInfo(); return; }
    }
    console.error('run: loop guard');
  }

  function exec(node) {
    if (isText(node)) {
      if (typeof node === 'object') apply(node);
      showText(node);
      return STOP;
    }
    if (isChoice(node)) { showChoice(node); return STOP; }
    apply(node);
    if (node.go) { G.sc = node.go; G.ip = 0; G.ch = chOf(node.go) || G.ch; return; }
    if (node.card != null) { showCard(node); return STOP; }
    if (node.wait) {
      R.state = 'busy';
      R.tWait = setTimeout(() => { G.ip++; run(); }, R.skip ? 40 : node.wait);
      return STOP;
    }
    if (node.gameover != null) { showGameOver(node); return STOP; }
    if (node.ending) { showEnding(node); return STOP; }
    if (node.end) { showTBC(); return STOP; }
    G.ip++;
  }

  // パラメータ変更・フラグ・状態異常・演出などの副作用
  function apply(n) {
    let rope = false;
    if (n.set) for (const k in n.set) { G.p[k] = lim(k, n.set[k]); rope = rope || k === 'p2' || k === 'a2'; }
    if (n.add) for (const k in n.add) { G.p[k] = lim(k, (G.p[k] || 0) + n.add[k]); rope = rope || k === 'p2' || k === 'a2'; }
    if (n.flag) [].concat(n.flag).forEach((f) => { G.f[f] = 1; });
    if (n.unflag) [].concat(n.unflag).forEach((f) => { delete G.f[f]; });
    if (n.lose) [].concat(n.lose).forEach(addStatus);
    if (n.tone !== undefined) setTone(n.tone);
    if (n.clear) clearPage();
    if (n.fx) doFx(n.fx, n);
    if (n.js) { try { n.js(G, SNW); } catch (e) { console.error(e); } }
    if (rope) Rope.update();
  }

  /* ---------- 本文 ---------- */
  function renderPara(n, instant) {
    const p = document.createElement('p');
    p.className = 'k-' + n.k + (n.cls ? ' ' + n.cls : '');
    const us = units(n.t);
    let h = n.k === 'm' ? '<span class="mk" aria-hidden="true">▷</span>' : '';
    const costs = [];
    for (const u of us) {
      if (u.br) { h += '<br>'; continue; }
      h += '<span class="u' + (instant ? ' on' : '') + '">' + u.h + '</span>';
      costs.push(cost(u.c));
    }
    p.innerHTML = h;
    p._costs = costs;
    return p;
  }

  // 溢れたら改ページ
  function fitPage(el, textEntry) {
    const pg = els.page;
    if (pg.scrollHeight > pg.clientHeight + 2 && pg.firstChild !== el) {
      if (!textEntry) {
        // 選択肢は、直前の文をできるだけ残して上から削る
        while (pg.scrollHeight > pg.clientHeight + 2 && pg.firstChild !== el) {
          pg.removeChild(pg.firstChild);
          G.page.shift();
        }
        pg.scrollTop = 0;
        return;
      }
      while (pg.firstChild && pg.firstChild !== el) pg.removeChild(pg.firstChild);
      G.page = textEntry ? G.page.slice(-1) : [];
      pg.scrollTop = 0;
    }
  }
  function clearPage() {
    if (els.page) els.page.innerHTML = '';
    if (G) G.page = [];
  }
  function trimPage() {
    const pg = els.page;
    while (pg.scrollHeight > pg.clientHeight + 2 && pg.children.length > 1) {
      pg.removeChild(pg.firstChild);
      G.page.shift();
    }
  }

  function showText(node) {
    const n = norm(node);
    const sc = G.sc, ip = G.ip;
    const was = isRead(sc, ip);
    markRead(sc, ip);
    if (R.skip && !was && !cfg.skipAll) stopSkip();
    const p = renderPara(n, false);
    els.page.appendChild(p);
    G.page.push({ k: n.k, t: n.t, cls: n.cls || '' });
    fitPage(p, true);
    pushLog(n.k, n.t);
    R.state = 'type';
    typeOut(p, n.spd || 1, R.skip, () => {
      R.state = 'wait';
      p.insertAdjacentHTML('beforeend', '<span class="wm" aria-hidden="true"></span>');
      scheduleNext(n);
    });
  }

  function typeOut(p, mul, instant, done) {
    const spans = p.querySelectorAll('.u');
    const per = msPerChar() * mul;
    if (instant || per <= 0 || !spans.length) {
      spans.forEach((s) => s.classList.add('on'));
      done();
      return;
    }
    const cum = [];
    let sum = 0;
    for (const c of p._costs) { cum.push(sum); sum += c; }
    let i = 0;
    const t0 = performance.now();
    TY = { spans, done, raf: 0 };
    const tick = (now) => {
      const el = (now - t0) / per;
      while (i < spans.length && cum[i] <= el) spans[i++].classList.add('on');
      if (i >= spans.length) { TY = null; done(); }
      else TY.raf = requestAnimationFrame(tick);
    };
    TY.raf = requestAnimationFrame(tick);
  }
  function finishTyping() {
    if (!TY) return;
    cancelAnimationFrame(TY.raf);
    TY.spans.forEach((s) => s.classList.add('on'));
    const d = TY.done;
    TY = null;
    d();
  }
  function cancelTyping() {
    if (TY) cancelAnimationFrame(TY.raf);
    TY = null;
  }

  function scheduleNext(n) {
    clearTimeout(R.tAdv);
    if (R.skip) R.tAdv = setTimeout(() => advance(true), 42);
    else if (n.auto) R.tAdv = setTimeout(() => advance(true), n.auto);
    else if (R.auto) {
      const len = plainText(n.t).length;
      R.tAdv = setTimeout(() => advance(true), (700 + len * 60) * cfg.auto / 100);
    }
  }
  function advance(fromTimer) {
    if (R.state !== 'wait') return;
    if (fromTimer && anyModal()) { R.tAdv = setTimeout(() => advance(true), 400); return; }
    $$('.wm', els.page).forEach((e) => e.remove());
    G.ip++;
    run();
  }

  function pushLog(k, t) {
    G.log.push({ k, t });
    if (G.log.length > LOG_MAX) G.log.splice(0, G.log.length - LOG_MAX);
  }

  /* ---------- 選択肢 ---------- */
  function showChoice(node) {
    stopSkip();
    G.last = null;
    G.last = clone(G);
    autosave();
    R.state = 'choice';
    const box = document.createElement('div');
    box.className = 'choice';
    if (node.c) box.innerHTML = '<p class="cq"><span class="cm" aria-hidden="true">▶</span>' + html(node.c) + '</p>';
    const ol = document.createElement('ol');
    node.o.forEach((o) => {
      if (o.when && !test(o.when)) return;
      const ok = !o.need || test(o.need);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.innerHTML = html(o.t) + (ok ? '' : '<span class="why">' + html(o.why || '') + '</span>');
      if (ok) b.addEventListener('click', (e) => { e.stopPropagation(); pick(o); });
      else b.disabled = true;
      li.appendChild(b);
      ol.appendChild(li);
    });
    box.appendChild(ol);
    els.page.appendChild(box);
    fitPage(box, false);
    box.scrollIntoView({ block: 'nearest' });
    dbgInfo();
  }
  function pick(o) {
    if (R.state !== 'choice') return;
    const box = $('.choice', els.page);
    if (box) box.remove();
    pushLog('c', o.t);
    apply(o);
    if (o.go) { G.sc = o.go; G.ip = 0; G.ch = chOf(o.go) || G.ch; }
    else G.ip++;
    run();
  }
  function choiceButtons() { return $$('.choice .opt:not(:disabled)', els.page); }

  /* ---------- 章扉 ---------- */
  function showCard(node) {
    const ch = CHS[node.card] || {};
    G.ch = node.card;
    clearPage();
    autosave();
    els.card.innerHTML = '<div><p class="cd-l">' + esc(ch.label || '') + '</p><h2 class="cd-t">' + esc(ch.title || '') + '</h2></div>';
    els.card.classList.add('on');
    R.state = 'card';
    R.cardAt = performance.now();
    R.tCard = setTimeout(() => closeCard(true), R.skip ? 700 : 4200);
  }
  function closeCard(force) {
    if (R.state !== 'card') return;
    if (!force && performance.now() - R.cardAt < 700) return;
    clearTimeout(R.tCard);
    els.card.classList.remove('on');
    G.ip++;
    run();
  }

  /* ---------- ゲームオーバー／エンディング／つづく ---------- */
  function overlay(inner, buttons) {
    stopSkip(); stopAuto(); cancelTyping();
    els.over.innerHTML = '<div>' + inner + '<div class="ov-act"></div></div>';
    const act = $('.ov-act', els.over);
    buttons.forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      act.appendChild(b);
    });
    els.over.classList.add('on');
    setTimeout(() => { const b = $('button', act); if (b) b.focus({ preventScroll: true }); }, 50);
  }
  function showGameOver(node) {
    R.state = 'over';
    const body = node.gameover ? '<p class="ov-b">' + html(node.gameover) + '</p>' : '';
    const btns = [];
    if (G.last) btns.push(['直前の選択肢からやり直す', retry]);
    btns.push(['タイトルへ', toTitle]);
    overlay('<p class="ov-mark">──</p><h2 class="ov-h">' + html(node.title || 'ここで途切れた') + '</h2>' + body, btns);
  }
  function retry() {
    if (!G || !G.last) return;
    const snap = G.last;
    G = clone(snap);
    G.last = snap;
    restoreView();
  }
  function showEnding(node) {
    R.state = 'over';
    const rec = Store.get(KEY.end, {});
    if (!rec[node.ending]) rec[node.ending] = { title: node.title || '', t: Date.now() };
    Store.set(KEY.end, rec);
    const body = node.note ? '<p class="ov-b">' + html(node.note) + '</p>' : '';
    overlay('<p class="ov-mark">終</p><h2 class="ov-h">' + html(node.title || '') + '</h2>' + body, [['タイトルへ', toTitle]]);
  }
  function showTBC() {
    R.state = 'over';
    autosave();
    overlay('<p class="ov-mark">つづく</p><p class="ov-b">いま遊べるのはここまでです。<br>つづきが追加されたら、タイトルの「つづきから」で再開できます。</p>', [['タイトルへ', toTitle]]);
  }
  function closeOverlays() {
    els.over.classList.remove('on');
    els.card.classList.remove('on');
    clearTimeout(R.tCard);
  }

  /* ---------- 状態異常 ---------- */
  function addStatus(s) {
    const who = s.who === 'tsu' ? 'tsu' : 'me';
    if (G.st[who].some((x) => x.id === s.id)) return;
    G.st[who].push({ id: s.id, name: s.name, note: s.note || '', cls: s.cls || '' });
    G.f[s.id] = 1;
    renderStatus();
    const b = els.bSt;
    b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping');
  }
  function renderStatus() {
    const me = G ? G.st.me : [], tsu = G ? G.st.tsu : [];
    els.bSt.hidden = !(me.length + tsu.length);
    const sec = (title, arr) => arr.length
      ? '<h3>' + esc(title) + '</h3><ul>' + arr.map((x) => '<li><b>' + html(x.name) + '</b>' + (x.note ? '<span>' + html(x.note) + '</span>' : '') + '</li>').join('') + '</ul>'
      : '';
    $('#st-list').innerHTML = G ? sec(G.name, me) + sec('綴', tsu) : '';
    // 状態による画面への影響（クラス名は x- で始める）
    document.body.className.split(/\s+/).filter((c) => /^x-/.test(c)).forEach((c) => document.body.classList.remove(c));
    me.concat(tsu).forEach((x) => { if (x.cls) document.body.classList.add(x.cls); });
  }

  /* ---------- 演出 ---------- */
  function setTone(t) {
    if (G) G.tone = t || '';
    document.body.dataset.tone = t || '';
  }
  function pulse(el, cls, ms) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  const calm = () => document.body.classList.contains('calm');
  function doFx(fx, n) {
    if (R.skip) return;
    switch (fx) {
      case 'shake': if (!calm()) pulse(els.stage, 'fx-shake', 520); break;
      case 'blank': pulse(els.stage, 'fx-blank', n.ms || 180); break;
      case 'dim': pulse(els.stage, 'fx-dim', n.ms || 1400); break;
      case 'glitch': if (!calm()) glitch(n.ms || 110); break;
      // 後日談の枠：from → to へ糸を動かす（back なら元に戻す）
      case 'twine': Rope.animate(n.from, n.to, n.ms || 2400, !!n.back); break;
      // 後日談の枠：一瞬光って、消えたように見える
      case 'glow': pulse(els.stage, 'fx-glow', n.ms || 2600); break;
    }
  }
  function glitch(ms) {
    const all = $$('.u.on', els.page);
    if (!all.length) return;
    let round = 0;
    const once = () => {
      const pick = [];
      for (let i = 0; i < Math.min(8, all.length); i++) pick.push(all[(Math.random() * all.length) | 0]);
      pick.forEach((s) => s.classList.add('gone'));
      setTimeout(() => { pick.forEach((s) => s.classList.remove('gone')); if (++round < 3) setTimeout(once, 70 + Math.random() * 160); }, ms);
    };
    setTimeout(once, 60);
  }

  /* ============================================================
   * 縄（SVG）
   * ============================================================ */
  const Rope = (() => {
    function hash(i, k) {
      let x = Math.imul(i + 1, 374761393) ^ Math.imul(k + 7, 668265263);
      x = Math.imul(x ^ (x >>> 13), 1274126177);
      x ^= x >>> 16;
      return (x >>> 0) / 4294967296;
    }
    function piece(L, at) { return { L, at }; }
    function line(x0, y0, x1, y1) {
      const L = Math.hypot(x1 - x0, y1 - y0), tx = (x1 - x0) / L, ty = (y1 - y0) / L;
      return piece(L, (t) => ({ x: x0 + tx * t, y: y0 + ty * t, tx, ty }));
    }
    function arc(cx, cy, r, a0) {
      return piece(Math.PI / 2 * r, (t) => {
        const a = a0 + t / r;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a) };
      });
    }
    function rrect(w, h, r) {
      const H = Math.PI / 2;
      return [
        line(r, 0, w - r, 0), arc(w - r, r, r, -H),
        line(w, r, w, h - r), arc(w - r, h - r, r, 0),
        line(w - r, h, r, h), arc(r, h - r, r, H),
        line(0, h - r, 0, r), arc(r, r, r, Math.PI),
      ];
    }
    function sampler(P) {
      const L = P.reduce((s, p) => s + p.L, 0);
      return {
        L,
        at(d) {
          for (const p of P) { if (d <= p.L) return p.at(d); d -= p.L; }
          const q = P[P.length - 1];
          return q.at(q.L);
        },
      };
    }
    const f1 = (v) => (Math.round(v * 10) / 10).toString();

    // opt: W（太さ）, step（撚りの間隔）, fray(t)→0..1, inward（内向きの毛羽の割合）, tail（末端をほぐすか）
    function draw(svg, P, opt) {
      const S = sampler(P);
      const n = Math.max(8, Math.round(S.L / opt.step));
      const step = S.L / n;
      const W = opt.W, half = W / 2, k = W * 0.42;
      let dA = '', dB = '', dS = '', dC = '', dL = '', dF = '';
      let open = false;
      for (let i = 0; i < n; i++) {
        const t = i / n, q = S.at(i * step), nx = q.ty, ny = -q.tx, f = opt.fray(t);
        const u = hash(i, 1);
        if (u < f * 0.26) { open = false; continue; } // 切れている
        dC += (open ? 'L' : 'M') + f1(q.x) + ' ' + f1(q.y);
        open = true;
        const loose = u < f * 0.62;
        const off = loose ? (hash(i, 2) - 0.25) * W * 0.55 * f : 0;
        const jit = loose ? (hash(i, 3) - 0.5) * 1.3 * f : 0;
        const cx = q.x + nx * off, cy = q.y + ny * off;
        const ax = -nx * half - q.tx * k * (1 + jit), ay = -ny * half - q.ty * k * (1 + jit);
        const x1 = cx + ax, y1 = cy + ay, x2 = cx - ax, y2 = cy - ay;
        const seg = 'M' + f1(x1) + ' ' + f1(y1) + 'L' + f1(x2) + ' ' + f1(y2);
        dS += 'M' + f1(x1 + 0.8) + ' ' + f1(y1 + 1.3) + 'L' + f1(x2 + 0.8) + ' ' + f1(y2 + 1.3);
        if (loose) dL += seg; else if (i % 2) dA += seg; else dB += seg;
      }
      if (opt.closed && open) dC += 'Z';
      // 毛羽
      const nf = Math.round(S.L / 13);
      for (let j = 0; j < nf; j++) {
        const t = hash(j, 11), f = opt.fray(t);
        if (hash(j, 12) > 0.035 + f * 0.95) continue;
        const q = S.at(t * S.L), nx = q.ty, ny = -q.tx;
        const side = hash(j, 13) < (opt.inward || 0.18) ? -1 : 1;
        const len = (3 + hash(j, 14) * (6 + 28 * f)) * (side < 0 ? 0.45 : 1);
        const curl = (hash(j, 15) - 0.5) * len * 1.5;
        const sx = q.x + nx * side * half * 0.5, sy = q.y + ny * side * half * 0.5;
        const mx = q.x + nx * side * len * 0.55 + q.tx * curl * 0.35, my = q.y + ny * side * len * 0.55 + q.ty * curl * 0.35;
        const ex = q.x + nx * side * len + q.tx * curl, ey = q.y + ny * side * len + q.ty * curl;
        dF += 'M' + f1(sx) + ' ' + f1(sy) + 'Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(ex) + ' ' + f1(ey);
      }
      // ほぐれた末端
      if (opt.tail) {
        const e = S.at(S.L), bx = e.x, by = e.y;
        for (let j = 0; j < 26; j++) {
          const spread = (hash(j, 21) - 0.5) * 2;
          const len = 10 + hash(j, 22) * 46;
          const ex = bx + spread * len * 0.45, ey = by + len;
          const mx = bx + spread * len * 0.12 + (hash(j, 23) - 0.5) * 6, my = by + len * 0.5;
          dF += 'M' + f1(bx + spread * half * 0.6) + ' ' + f1(by - 4) + 'Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(ex) + ' ' + f1(ey);
        }
      }
      const sw = f1(step * 0.74);
      svg.innerHTML =
        '<path class="r-s" stroke-width="' + sw + '" d="' + dS + '"/>' +
        '<path class="r-c" stroke-width="' + f1(W * 0.78) + '" d="' + dC + '"/>' +
        '<path class="r-b" stroke-width="' + sw + '" d="' + dB + '"/>' +
        '<path class="r-a" stroke-width="' + sw + '" d="' + dA + '"/>' +
        '<path class="r-l" stroke-width="' + f1(step * 0.6) + '" d="' + dL + '"/>' +
        '<path class="r-f" stroke-width="0.7" d="' + dF + '"/>';
    }

    // ほつれを場所ごとに偏らせる
    const lumpy = (f) => (t) => {
      if (f <= 0) return 0;
      const w = 0.5 + 0.5 * Math.sin(t * Math.PI * 6 + 1.3) * Math.sin(t * Math.PI * 2.4 + 0.4);
      return Math.min(1, f * (0.35 + 1.3 * w * w + 0.15));
    };

    /* ---------- 後日談の枠：二本の糸 ----------
     * t = 0 平行 / 0〜1 近づく / 1〜2 片方がほつれて切れかける / 2〜3 縒り合わさって一本の紐 */
    function threads(svg, w, h, t) {
      const S = sampler(rrect(w, h, w < 480 ? 9 : 12));
      const n = Math.max(40, Math.round(S.L / 2.4)), ds = S.L / n;
      const cl = (v) => Math.max(0, Math.min(1, v));
      const near = t < 1 ? t : 0;
      const fray = t <= 2 ? cl(t - 1) : cl(1 - (t - 2) * 1.6);
      const tw = cl(t - 2);
      const g = 3.4 * (1 - 0.25 * tw);
      const period = 15;
      const gapC = 0.71 * S.L, gapHalf = fray > 0.45 ? (fray - 0.45) * 90 : 0;
      const buf = { aF: '', aB: '', bF: '', bB: '' };
      let fib = '';
      const T = { a: { key: null, last: null }, b: { key: null, last: null } };
      const add = (th, key, x, y) => {
        const st = T[th];
        if (key === null) { st.key = null; st.last = null; return; }
        const pt = f1(x) + ' ' + f1(y);
        if (st.key !== key) { buf[th + key] += 'M' + (st.last || pt) + 'L' + pt; st.key = key; }
        else buf[th + key] += 'L' + pt;
        st.last = pt;
      };
      const curl = (x, y, nx, ny, tx, ty, j, len) => {
        const c = (hash(j, 41) - 0.5) * len * 1.4, side = hash(j, 42) < 0.7 ? 1 : -1;
        fib += 'M' + f1(x) + ' ' + f1(y) +
          'Q' + f1(x + nx * side * len * 0.5 + tx * c * 0.4) + ' ' + f1(y + ny * side * len * 0.5 + ty * c * 0.4) +
          ' ' + f1(x + nx * side * len + tx * c) + ' ' + f1(y + ny * side * len + ty * c);
      };
      let bWas = true;
      for (let i = 0; i <= n; i++) {
        const s = i * ds, q = S.at(Math.min(s, S.L)), nx = q.ty, ny = -q.tx;
        const bump = Math.pow(Math.max(0, Math.sin((s / S.L) * Math.PI * 10 + 0.6)), 8);
        const base = g * (1 - near * 0.95 * bump);
        const phi = (s / period) * Math.PI * 2, tww = g * 0.85 * Math.cos(phi);
        const oA = base * (1 - tw) + tww * tw, oB = -base * (1 - tw) - tww * tw;
        const sp = Math.sin(phi);
        add('a', tw > 0 && sp < 0 ? 'B' : 'F', q.x + nx * oA, q.y + ny * oA);
        let gone = false;
        if (fray > 0) gone = Math.abs(s - gapC) < gapHalf || hash(i, 31) < fray * 0.025;
        const bx = q.x + nx * oB, by = q.y + ny * oB;
        if (gone) {
          add('b', null);
          if (bWas) for (let j = 0; j < 3; j++) curl(bx, by, nx, ny, q.tx, q.ty, i * 7 + j, 3 + hash(i * 7 + j, 43) * 10 * fray);
        } else {
          if (!bWas && i > 0) for (let j = 0; j < 3; j++) curl(bx, by, nx, ny, q.tx, q.ty, i * 11 + j, 3 + hash(i * 11 + j, 44) * 10 * fray);
          add('b', tw > 0 && sp > 0 ? 'B' : 'F', bx, by);
          if (fray > 0 && hash(i, 33) < fray * 0.02) curl(bx, by, nx, ny, q.tx, q.ty, i, 3 + hash(i, 45) * 8);
        }
        bWas = !gone;
      }
      const sw = f1(1.25 + 0.95 * tw);
      svg.innerHTML =
        '<path class="t-a" stroke-width="' + sw + '" d="' + buf.aB + '"/>' +
        '<path class="t-b" stroke-width="' + sw + '" d="' + buf.bB + '"/>' +
        '<path class="t-a" stroke-width="' + sw + '" d="' + buf.aF + '"/>' +
        '<path class="t-b" stroke-width="' + sw + '" d="' + buf.bF + '"/>' +
        '<path class="t-f" stroke-width="0.6" d="' + fib + '"/>';
    }
    let anim = null;
    function afDraw(v) {
      const win = els.win;
      if (win && win.clientWidth) threads(els.rope, win.clientWidth, win.clientHeight, v);
    }
    function animate(from, to, ms, back) {
      if (!isAf()) return;
      if (anim) cancelAnimationFrame(anim.raf);
      const a = from == null ? G.p.a2 || 0 : from;
      const t0 = performance.now();
      const me = (anim = { raf: 0, t0, ms });
      const tick = (now) => {
        if (anim !== me) return;
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        afDraw(back ? a + (to - a) * Math.sin(Math.PI * k) : a + (to - a) * e);
        if (k < 1) anim.raf = requestAnimationFrame(tick);
        else { anim = null; update(true); }
      };
      anim.raf = requestAnimationFrame(tick);
    }

    let lastKey = '';
    function update(force) {
      const svg = els.rope, win = els.win;
      if (!svg || !win) return;
      const w = win.clientWidth, h = win.clientHeight;
      if (!w || !h) return;
      if (isAf()) {
        if (anim) {
          // 描画が止まっていた（非表示のタブなど）ら、動きを諦めて最終形を描く
          if (performance.now() - anim.t0 < anim.ms + 300) return;
          cancelAnimationFrame(anim.raf);
          anim = null;
        }
        const k2 = w + 'x' + h + ':af' + G.p.a2;
        if (!force && k2 === lastKey) return;
        lastKey = k2;
        threads(svg, w, h, G.p.a2 || 0);
        return;
      }
      const f = G ? (G.p.p2 || 0) / 100 : 0;
      const key = w + 'x' + h + ':' + f;
      if (!force && key === lastKey) return;
      lastKey = key;
      const small = w < 480;
      draw(svg, rrect(w, h, small ? 9 : 12), {
        W: small ? 5.6 : 7, step: small ? 3.5 : 4.2, fray: lumpy(f), closed: true, inward: 0.16,
      });
    }
    function title() {
      const svg = $('#t-rope');
      if (!svg) return;
      const h = svg.clientHeight || 400, x = 22;
      draw(svg, [line(x, -12, x, h - 58)], {
        W: 7, step: 4.2, inward: 0.5, tail: true,
        fray: (t) => (t > 0.8 ? Math.pow((t - 0.8) / 0.2, 1.4) : 0),
      });
    }
    return { update, title, animate };
  })();

  /* ============================================================
   * セーブ／ロード
   * ============================================================ */
  function snippet() {
    const e = G && G.page[G.page.length - 1];
    if (!e) return '';
    const s = plainText(e.t);
    return (e.k === 'm' ? '▷ ' : '') + (s.length > 34 ? s.slice(0, 34) + '…' : s);
  }
  function writeSave(slot) {
    if (!G || !G.sc) return;
    const d = clone(G);
    d.time = Date.now();
    d.snip = snippet();
    Store.set(KEY.save + slot, d);
  }
  function autosave() { writeSave('auto'); }
  function readSave(slot) {
    const d = Store.get(KEY.save + slot, null);
    return d && d.v === 1 && d.sc ? d : null;
  }
  function loadSlot(slot) {
    const d = readSave(slot);
    if (!d) return;
    delete d.time; delete d.snip;
    G = d;
    enterPlay();
    restoreView();
  }
  function fmtDate(t) {
    const d = new Date(t), z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function chLabel(n) {
    const c = CHS[n];
    if (c) return c.label + '　' + c.title;
    // まだ追加されていない章（「つづく」で止まったセーブ）
    const k = '〇一二三四五六七八九';
    if (typeof n === 'string' && n[0] === 'a') return '後日談　第' + (k[+n.slice(1)] || '') + '章';
    return n ? '第' + (k[n] || '') + '章' : '';
  }

  function openSL(mode) {
    if (mode === 'save' && !canSave()) { toast('いまはセーブできません'); return; }
    $('#m-sl-h').textContent = mode === 'save' ? 'セーブ' : 'ロード';
    $('#sl-note').textContent = mode === 'save' ? '' : 'オートセーブは、選択肢と章の始まりで記録されます。';
    const list = $('#sl-list');
    list.innerHTML = '';
    const slots = mode === 'load' ? ['auto'].concat(SLOTS) : SLOTS;
    slots.forEach((s) => {
      const d = readSave(s);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot' + (d ? '' : ' empty');
      b.innerHTML =
        '<span class="sn">' + (s === 'auto' ? 'オート' : 'その' + '一二三'[+s - 1]) + '</span>' +
        (d
          ? '<span class="sm">' + esc(chLabel(d.ch)) + '　' + fmtDate(d.time) + '</span><span class="sx">' + esc(d.snip || '') + '</span>'
          : '<span class="sm">　</span><span class="sx">── 空き ──</span>');
      if (mode === 'load' && !d) b.disabled = true;
      b.addEventListener('click', async () => {
        if (mode === 'save') {
          if (d && !(await ask('上書きしますか？'))) return;
          writeSave(s);
          toast('セーブしました');
          openSL('save');
        } else {
          if (inPlay() && !(await ask('ロードしますか？\nいまの進行で保存していない部分は失われます。'))) return;
          closeModal();
          loadSlot(s);
        }
      });
      list.appendChild(b);
    });
    openModal('m-sl');
  }
  function canSave() { return inPlay() && ['wait', 'type', 'choice'].includes(R.state); }

  function restoreView() {
    closeOverlays();
    stopSkip(); stopAuto(); cancelTyping();
    clearTimeout(R.tAdv); clearTimeout(R.tWait);
    setTone(G.tone || '');
    applyMode();
    renderStatus();
    Rope.update(true);
    els.page.innerHTML = '';
    G.page.forEach((e) => els.page.appendChild(renderPara(e, true)));
    trimPage();
    const list = SCN[G.sc];
    const node = list && list[G.ip];
    if (isText(node) && G.page.length) {
      R.state = 'wait';
      els.page.lastChild.insertAdjacentHTML('beforeend', '<span class="wm" aria-hidden="true"></span>');
      dbgInfo();
    } else {
      run();
    }
  }

  /* ============================================================
   * 画面遷移
   * ============================================================ */
  const inPlay = () => els.game.classList.contains('on');
  function enterPlay() {
    closeModal();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    els.title.classList.remove('on');
    els.game.classList.add('on');
    requestAnimationFrame(() => Rope.update(true));
  }
  function startNew(name, mode) {
    G = newState(name, mode);
    const first = mode === 'af' ? CHS.a1 && CHS.a1.start : CHS[1] && CHS[1].start;
    G.sc = first || Object.keys(SCN)[0];
    G.ip = 0;
    G.ch = chOf(G.sc);
    Store.set(KEY.name, name);
    applyMode();
    enterPlay();
    clearPage();
    setTone('');
    renderStatus();
    Rope.update(true);
    run();
  }
  function toTitle() {
    stopSkip(); stopAuto(); cancelTyping();
    clearTimeout(R.tAdv); clearTimeout(R.tWait);
    closeOverlays(); closeModal();
    R.state = 'idle';
    G = null;
    applyMode();
    renderStatus();
    setTone('');
    els.game.classList.remove('on');
    els.title.classList.add('on');
    refreshTitle();
    requestAnimationFrame(Rope.title);
  }
  function refreshTitle() {
    $('#t-cont').hidden = !readSave('auto');
    const rec = Store.get(KEY.end, {});
    $('#t-rec').hidden = !Object.keys(rec).length;
    // 後日談は、トゥルーエンド到達後だけ（デバッグ時は常に）
    $('#t-af').hidden = !CHS.a1 || !(DEBUG || (SNW.afterGate && rec[SNW.afterGate]));
  }

  /* ============================================================
   * 操作
   * ============================================================ */
  function userAdvance() {
    if (!inPlay() || anyModal()) return;
    if (R.skip || R.auto) { stopSkip(); stopAuto(); if (R.state === 'wait') return; }
    if (R.state === 'type') finishTyping();
    else if (R.state === 'wait') advance(false);
    else if (R.state === 'card') closeCard(false);
  }
  function syncBar() {
    els.bAuto.classList.toggle('act', R.auto);
    els.bSkip.classList.toggle('act', R.skip);
  }
  function stopSkip() { if (R.skip) { R.skip = false; clearTimeout(R.tAdv); syncBar(); } }
  function stopAuto() { if (R.auto) { R.auto = false; clearTimeout(R.tAdv); syncBar(); } }
  function toggleSkip() {
    R.skip = !R.skip;
    if (R.skip) R.auto = false;
    syncBar();
    clearTimeout(R.tAdv);
    if (!R.skip) return;
    if (R.state === 'type') finishTyping();
    else if (R.state === 'wait') R.tAdv = setTimeout(() => advance(true), 60);
    else if (R.state === 'card') closeCard(true);
  }
  function toggleAuto() {
    R.auto = !R.auto;
    if (R.auto) R.skip = false;
    syncBar();
    clearTimeout(R.tAdv);
    if (R.auto && R.state === 'wait') R.tAdv = setTimeout(() => advance(true), 500);
  }

  /* ---------- モーダル ---------- */
  let lastFocus = null;
  const anyModal = () => !!$('.modal.on');
  function openModal(id) {
    const m = document.getElementById(id);
    if (!anyModal()) lastFocus = document.activeElement;
    $$('.modal.on').forEach((x) => x.classList.remove('on'));
    m.classList.add('on');
    const f = $('input, button:not([data-close]):not(:disabled), [data-close]', m);
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
  }
  function closeModal() {
    const was = anyModal();
    $$('.modal.on').forEach((x) => x.classList.remove('on'));
    if (askResolve) { askResolve(false); askResolve = null; }
    if (was && lastFocus && lastFocus.focus && !lastFocus.closest('#bar')) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  let askResolve = null;
  function ask(msg) {
    return new Promise((res) => {
      const prev = $('.modal.on');
      $('#ask-msg').innerHTML = esc(msg).replace(/\n/g, '<br>');
      const m = $('#m-ask');
      m.classList.add('on');
      setTimeout(() => $('#ask-yes').focus({ preventScroll: true }), 30);
      askResolve = (v) => { m.classList.remove('on'); if (prev) prev.classList.add('on'); res(v); };
    });
  }

  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 1600);
  }

  function openLog() {
    if (!G) return;
    const list = $('#log-list');
    list.innerHTML = G.log.length
      ? G.log.map((e) => '<p class="k-' + e.k + '">' + (e.k === 'm' ? '<span class="mk">▷</span>' : '') + html(e.t) + '</p>').join('')
      : '<p class="empty">まだ何もありません。</p>';
    openModal('m-log');
    const box = list.closest('.mbox');
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }

  function openCfg() {
    $('#c-spd').value = cfg.spd;
    $('#c-auto').value = cfg.auto;
    $('#c-calm').checked = !!cfg.calm;
    syncSeg();
    openModal('m-cfg');
    samplePlay();
  }
  function syncSeg() {
    $$('#c-size button').forEach((b) => b.classList.toggle('sel', b.dataset.v === cfg.size));
    $$('#c-skip button').forEach((b) => b.classList.toggle('sel', (b.dataset.v === '1') === !!cfg.skipAll));
  }
  let sampleT = 0;
  function samplePlay() {
    const el = $('#c-sample');
    const src = 'バスが去ると、音が全部なくなった。';
    cancelAnimationFrame(sampleT);
    const n = { k: 'n', t: src };
    const p = renderPara(n, false);
    el.innerHTML = p.innerHTML;
    const spans = el.querySelectorAll('.u');
    const per = msPerChar();
    if (!per) { spans.forEach((s) => s.classList.add('on')); return; }
    const cum = []; let sum = 0;
    for (const c of p._costs) { cum.push(sum); sum += c; }
    let i = 0; const t0 = performance.now();
    const tick = (now) => {
      const e = (now - t0) / per;
      while (i < spans.length && cum[i] <= e) spans[i++].classList.add('on');
      if (i < spans.length) sampleT = requestAnimationFrame(tick);
    };
    sampleT = requestAnimationFrame(tick);
  }

  function openRec() {
    const rec = Store.get(KEY.end, {});
    const ids = Object.keys(rec).sort((a, b) => rec[a].t - rec[b].t);
    $('#rec-list').innerHTML = ids.length
      ? ids.map((id) => '<li><span>' + html(rec[id].title) + '</span><span class="d">' + fmtDate(rec[id].t) + '</span></li>').join('')
      : '<li class="empty">まだ記録はありません。</li>';
    openModal('m-rec');
  }

  let nameMode = '';
  function openName(mode) {
    nameMode = mode === 'af' ? 'af' : '';
    $('#nm-def').textContent = DEFAULT_NAME;
    const i = $('#nm-in');
    // 後日談は、前に使った名前を入れておく
    i.value = nameMode === 'af' ? Store.get(KEY.name, '') : '';
    i.placeholder = DEFAULT_NAME;
    openModal('m-name');
  }
  function submitName() {
    let v = $('#nm-in').value.replace(/[《》｜{}<>\n\r\t]/g, '').trim();
    if (!v) v = DEFAULT_NAME;
    closeModal();
    startNew(v, nameMode);
  }

  /* ============================================================
   * デバッグ（?debug=1 のときだけ）
   * ============================================================ */
  let dbgEl = null;
  function dbgInfo() {
    if (!dbgEl || !G) return;
    $('.info', dbgEl).textContent =
      G.sc + ' : ' + G.ip + '  [' + R.state + ']\n' +
      Object.keys(G.p).map((k) => k + '=' + G.p[k]).join(' ') + '\n' +
      Object.keys(G.f).join(' ');
  }
  function setupDebug() {
    if (!DEBUG) return;
    window.SNWDBG = { Rope, get G() { return G; }, R };
    dbgEl = document.createElement('div');
    dbgEl.id = 'dbg';
    const opts = Object.keys(SCN).map((s) => '<option>' + esc(s) + '</option>').join('');
    dbgEl.innerHTML =
      '<select class="sc">' + opts + '</select><button type="button" class="go">jump</button>' +
      'p1<input class="p1" type="number">p2<input class="p2" type="number">p3<input class="p3" type="number">a1<input class="a1" type="number">a2<input class="a2" type="number" step="0.1">f<input class="fl" type="text" style="width:8em">' +
      '<button type="button" class="set">set</button><div class="info"></div>';
    document.body.appendChild(dbgEl);
    const val = (c) => { const v = $('.' + c, dbgEl).value; return v === '' ? null : +v; };
    const applyP = () => {
      ['p1', 'p2', 'p3', 'a1', 'a2'].forEach((k) => { const v = val(k); if (v != null) G.p[k] = lim(k, v); });
      $('.fl', dbgEl).value.split(/[\s,]+/).filter(Boolean).forEach((f) => { if (f[0] === '-') delete G.f[f.slice(1)]; else G.f[f] = 1; });
      Rope.update(true);
      dbgInfo();
    };
    $('.go', dbgEl).addEventListener('click', () => {
      const sc = $('.sc', dbgEl).value;
      stopSkip(); stopAuto(); cancelTyping();
      clearTimeout(R.tAdv); clearTimeout(R.tWait);
      closeOverlays(); closeModal();
      const af = /^af/.test(sc);
      if (!G || isAf() !== af) G = newState(Store.get(KEY.name, DEFAULT_NAME), af ? 'af' : '');
      applyMode();
      applyP();
      G.sc = sc; G.ip = 0; G.ch = chOf(sc);
      enterPlay();
      clearPage();
      renderStatus();
      run();
    });
    $('.set', dbgEl).addEventListener('click', () => { if (G) applyP(); });
    ['click', 'keydown', 'wheel'].forEach((ev) => dbgEl.addEventListener(ev, (e) => e.stopPropagation()));
  }

  /* ============================================================
   * 起動
   * ============================================================ */
  function bind() {
    // タイトル
    $('#t-new').addEventListener('click', () => openName(''));
    $('#t-af').addEventListener('click', () => openName('af'));
    $('#t-cont').addEventListener('click', () => loadSlot('auto'));
    $('#t-load').addEventListener('click', () => openSL('load'));
    $('#t-rec').addEventListener('click', openRec);
    $('#t-cfg').addEventListener('click', openCfg);
    $('#nm-ok').addEventListener('click', submitName);
    $('#nm-in').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitName(); }
    });

    // 本編のメニュー
    const barAct = {
      'b-log': openLog, 'b-auto': toggleAuto, 'b-skip': toggleSkip,
      'b-save': () => openSL('save'), 'b-load': () => openSL('load'),
      'b-st': () => openModal('m-st'), 'b-cfg': openCfg,
      'b-title': async () => { if (await ask('タイトルに戻りますか？\nセーブしていない進行は失われます。')) toTitle(); },
    };
    Object.keys(barAct).forEach((id) => {
      document.getElementById(id).addEventListener('click', (e) => {
        e.stopPropagation();
        e.currentTarget.blur();
        barAct[id]();
      });
    });

    // 送り
    els.game.addEventListener('click', (e) => {
      if (e.target.closest('#bar, .choice, button, a, input')) return;
      userAdvance();
    });
    els.card.addEventListener('click', () => closeCard(false));
    els.game.addEventListener('wheel', (e) => {
      if (anyModal() || R.state === 'card') return;
      if (e.deltaY < 0 && els.page.scrollTop <= 0) openLog();
    }, { passive: true });

    // モーダル
    $$('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m && m.id !== 'm-ask') closeModal(); }));
    $('#ask-yes').addEventListener('click', () => { const r = askResolve; askResolve = null; if (r) r(true); });
    $('#ask-no').addEventListener('click', () => { const r = askResolve; askResolve = null; if (r) r(false); });

    // 設定
    $('#c-spd').addEventListener('input', (e) => { cfg.spd = +e.target.value; saveCfg(); samplePlay(); });
    $('#c-auto').addEventListener('input', (e) => { cfg.auto = +e.target.value; saveCfg(); });
    $('#c-calm').addEventListener('change', (e) => { cfg.calm = e.target.checked; saveCfg(); });
    $$('#c-size button').forEach((b) => b.addEventListener('click', () => {
      cfg.size = b.dataset.v; saveCfg(); syncSeg(); samplePlay();
      requestAnimationFrame(() => { Rope.update(true); if (G && inPlay()) { trimPage(); } });
    }));
    $$('#c-skip button').forEach((b) => b.addEventListener('click', () => { cfg.skipAll = b.dataset.v === '1'; saveCfg(); syncSeg(); }));
    if (reducedMQ.addEventListener) reducedMQ.addEventListener('change', applyCfg);

    // キーボード
    document.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        if ($('#m-ask.on')) { const r = askResolve; askResolve = null; if (r) r(false); }
        else if (anyModal()) closeModal();
        e.preventDefault();
        return;
      }
      if (anyModal() || !inPlay()) return;
      if (els.over.classList.contains('on')) return;
      if (R.state === 'choice') {
        const bs = choiceButtons();
        const idx = bs.indexOf(document.activeElement);
        if (/^[1-9]$/.test(e.key)) { const b = bs[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const d = e.key === 'ArrowDown' ? 1 : -1;
          const nx = idx < 0 ? (d > 0 ? 0 : bs.length - 1) : (idx + d + bs.length) % bs.length;
          if (bs[nx]) bs[nx].focus();
          return;
        }
        if ((e.key === 'Enter' || e.key === ' ') && idx < 0) { e.preventDefault(); if (bs[0]) bs[0].focus(); }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.tagName === 'BUTTON' && e.target.closest('#game') && !e.target.closest('#bar')) return;
        e.preventDefault();
        if (e.repeat && R.state === 'type') return;
        userAdvance();
      }
    });

    // 大きさの変化
    let rT = 0;
    const onResize = () => { clearTimeout(rT); rT = setTimeout(() => { Rope.update(); if (els.title.classList.contains('on')) Rope.title(); }, 80); };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(els.win);
  }

  function boot() {
    els = {
      title: $('#title'), game: $('#game'), stage: $('#stage'), win: $('#win'), page: $('#page'),
      rope: $('#rope'), card: $('#card'), over: $('#over'),
      bAuto: $('#b-auto'), bSkip: $('#b-skip'), bSt: $('#b-st'),
    };
    applyCfg();
    bind();
    setupDebug();
    toTitle();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => Rope.title());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
