/* 作品の演出。枠（#frame）の飾り、背景（#bg）、奥のレイヤー（#fxLayer）の演出。
   本文（#box / #lines）には触れない。名前はすべて記号（対応表は非公開メモ）。 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var DROPS = 64;

  var drops = [], card = null, built = false, timers = [];

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* ---------- 天守の図（viewBox 0 0 200 250） ---------- */

  function roof(y, xl, xr, h, f) {
    return 'M' + (xl - f) + ',' + (y - 5) +
      ' Q' + (xl - f * 0.4) + ',' + y + ' ' + (xl + 4) + ',' + y +
      ' L' + (xr - 4) + ',' + y +
      ' Q' + (xr + f * 0.4) + ',' + y + ' ' + (xr + f) + ',' + (y - 5) +
      ' L' + (xr - 7) + ',' + (y - h) + ' L' + (xl + 7) + ',' + (y - h) + ' Z';
  }
  function gable(cx, y, w, h) {
    return 'M' + (cx - w) + ',' + y + ' L' + cx + ',' + (y - h) + ' L' + (cx + w) + ',' + y + ' Z';
  }
  function castleSvg() {
    var s = '<svg xmlns="' + NS + '" viewBox="0 0 200 250" preserveAspectRatio="xMidYMax meet">';
    // 石垣
    s += '<path class="k6c1" d="M14,250 Q30,222 44,196 L156,196 Q170,222 186,250 Z"/>';
    s += '<path class="k6c9" d="M22,238 L178,238 M32,222 L168,222 M40,208 L160,208"/>';
    // 一重目
    s += '<rect class="k6c2" x="48" y="164" width="104" height="32"/>';
    s += '<path class="k6c4" d="M58,176 h8 v8 h-8 Z M80,176 h8 v8 h-8 Z M112,176 h8 v8 h-8 Z M134,176 h8 v8 h-8 Z"/>';
    s += '<path class="k6c3" d="' + roof(166, 40, 160, 16, 16) + '"/>';
    // 二重目
    s += '<rect class="k6c2" x="60" y="128" width="80" height="24"/>';
    s += '<path class="k6c4" d="M72,136 h7 v7 h-7 Z M96,136 h7 v7 h-7 Z M121,136 h7 v7 h-7 Z"/>';
    s += '<path class="k6c3" d="' + roof(130, 52, 148, 14, 14) + '"/>';
    s += '<path class="k6c3" d="' + gable(100, 118, 18, 12) + '"/>';
    // 三重目
    s += '<rect class="k6c2" x="70" y="94" width="60" height="22"/>';
    s += '<path class="k6c4" d="M82,101 h6 v6 h-6 Z M112,101 h6 v6 h-6 Z"/>';
    s += '<path class="k6c3" d="' + roof(96, 62, 138, 13, 13) + '"/>';
    // 最上階
    s += '<rect class="k6c2" x="80" y="62" width="40" height="22"/>';
    s += '<path class="k6c5" d="M88,68 h24 v9 h-24 Z"/>';
    s += '<path class="k6c3" d="' + roof(64, 70, 130, 16, 14) + '"/>';
    // 鯱
    s += '<path class="k6c3" d="M78,48 q-3,-8 2,-11 q1,5 4,7 Z M122,48 q3,-8 -2,-11 q-1,5 -4,7 Z"/>';
    s += '</svg>';
    return s;
  }

  /* ---------- 組み立て ---------- */

  function build(ctx) {
    if (built) return;
    built = true;
    var frame = ctx.frame, layer = ctx.layer;

    // 奥：窓と天守
    var win = el('div', 'k6', layer);
    el('div', 'k6s', win);                       // 空
    el('div', 'k6e', win);                       // 海
    var cz = el('div', 'k6c', win);              // 天守
    cz.innerHTML = castleSvg();
    el('div', 'k6t', win);                       // 町の屋根
    var lan = el('div', 'k6l', win);             // 遠くの提灯
    el('i', '', lan);
    el('div', 'k6f', win);                       // 窓の枠

    // 奥：蔵
    var kura = el('div', 'k8', layer);
    el('div', 'k8a', kura);
    el('div', 'k8b', kura);

    // 奥：峠から見た盆地
    var pass = el('div', 'k9', layer);
    var pc = el('div', 'k9c', pass);
    pc.innerHTML = castleSvg();
    el('div', 'k9t', pass);
    el('div', 'k9m', pass);

    // 奥：天守から見下ろす町
    var down = el('div', 'kB', layer);
    el('div', 'kBa', down);
    el('div', 'kBb', down);

    // 奥：曇り
    el('div', 'kA', layer);

    // 奥：盃
    var cup = el('div', 'k7', layer);
    var a = el('div', 'k7a', cup);
    var r = el('div', 'k7r', a);
    r.innerHTML = castleSvg();
    var p = el('div', 'k7p', a);
    p.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 200 200"><path d="M36,92 Q90,70 168,84"/>' +
      '<path d="M44,118 Q98,96 150,124"/><path d="M92,176 Q84,120 112,58"/></svg>';
    var sp = el('div', 'k7s', a);
    for (var i = 0; i < 26; i++) {
      var d = el('i', '', sp);
      d.style.left = (12 + ((i * 37) % 76)) + '%';
      d.style.top = (14 + ((i * 53) % 70)) + '%';
      d.style.animationDelay = ((i * 0.37) % 2.4).toFixed(2) + 's';
      d.style.setProperty('--k7h', String((i * 47) % 360));
    }
    el('div', 'k7m', a);                         // 縁の張り
    el('div', 'k7w', cup);                       // こぼれる筋
    var b = el('div', 'k7b', cup);               // もう一つの盃
    el('div', 'k7m', b);
    el('div', 'k7g', cup);                       // 朝日

    // 枠：暖簾
    var noren = el('div', 'k1', frame);
    for (var n = 0; n < 4; n++) el('div', 'k1a', noren);
    var mark = el('div', 'k1t', noren);
    mark.innerHTML = '<i class="k1d"></i><span>ひとしずく</span>';

    // 枠：カウンター
    el('div', 'k2', frame);

    // 枠：曇り
    el('div', 'k4', frame);

    // 枠：結露
    var dz = el('div', 'k3', frame);
    for (var j = 0; j < DROPS; j++) {
      var e = el('i', 'k3a', dz);
      var side = j % 3;
      var t = (j * 53) % 97;
      var size = 3 + ((j * 7) % 6);
      if (side === 0) { e.style.left = (3 + (j * 5) % 10) + 'px'; e.style.top = (9 + t * 0.84) + '%'; }
      else if (side === 1) { e.style.right = (3 + (j * 3) % 10) + 'px'; e.style.top = (9 + ((t * 7) % 97) * 0.84) + '%'; }
      else { e.style.left = (6 + ((j * 29) % 89)) + '%'; e.style.top = (44 + (j * 11) % 18) + 'px'; }
      e.style.width = size + 'px';
      e.style.height = (size * 1.25).toFixed(1) + 'px';
      e.style.setProperty('--k3d', ((j * 0.13) % 0.9).toFixed(2) + 's');
      drops.push(e);
    }

    // 枠：利き会の札
    card = el('div', 'k5', frame);
  }

  /* ---------- 状態 ---------- */

  function setScene(v) {
    var n = parseInt(v, 10);
    var z = isNaN(n) ? 12 : Math.max(1, Math.min(12, n));
    document.body.style.setProperty('--k6z', String(z));
  }

  function setDrops(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) n = 0;
    drops.forEach(function (d, i) { d.classList.toggle('on', i < n); });
  }

  var CARD = {
    t1: ['神無月 利き会', null, '上の下'],
    t2: ['霜月 利き会', null, '特上'],
    t3: ['利き会', '真砂 汀', '特上']
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function setCard(v, ctx) {
    if (!card) return;
    var c = CARD[v];
    if (!c) { card.classList.remove('on'); return; }
    var who = c[1] || (ctx.state && ctx.state.name) || '';
    card.innerHTML = '<small>' + esc(c[0]) + '</small><b>' + esc(who) + '</b><em>' + esc(c[2]) + '</em>';
    card.classList.add('on');
  }

  /* ---------- 記録の中の名前 ---------- */
  // 記録の本文の {name} を、遊んでいる名前に差し替える（記録はタイトル画面からも読めるので、控えの名前も使う）
  var curName = '';
  function playerName() {
    if (curName) return curName;
    try {
      var o = JSON.parse(window.localStorage.getItem('kadv11.opt') || '{}');
      if (o && o.lastName) return o.lastName;
    } catch (e) { }
    var c = window.ADV_CONFIG || {};
    return (c.name && c.name.default) || '';
  }
  function fillNames(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n, list = [];
    while ((n = w.nextNode())) if (n.nodeValue.indexOf('{name}') >= 0) list.push(n);
    list.forEach(function (t) { t.nodeValue = t.nodeValue.split('{name}').join(playerName()); });
  }
  function watchPanel() {
    var body = document.getElementById('pbody');
    if (!body || !window.MutationObserver) return;
    new MutationObserver(function () { fillNames(body); }).observe(body, { childList: true, subtree: true });
  }
  function noteName(ctx) { if (ctx && ctx.state && ctx.state.name) curName = ctx.state.name; }

  /* ---------- 一時の演出 ---------- */

  // 曇りが一瞬で晴れて、結露が一斉に流れ落ちる
  function release(ctx) {
    var f = ctx.frame, bk = ctx.back;
    [f, bk].forEach(function (e) {
      e.classList.remove('k-clear'); void e.offsetWidth; e.classList.add('k-clear');
    });
    f.classList.remove('k-re');
    f.classList.add('k-run');
    later(function () {
      f.classList.remove('k-run', 'k-clear');
      bk.classList.remove('k-clear');
      f.classList.add('k-re');
    }, 2600);
    later(function () { f.classList.remove('k-re'); }, 6000);
  }

  window.ADV_EFFECTS = {
    init: function (ctx) { build(ctx); setScene('1'); watchPanel(); },
    onChapter: function (file, ctx) { noteName(ctx); },
    onRestore: function (ctx) { noteName(ctx); },
    onReset: function (ctx) {
      curName = '';
      clearTimers();
      ctx.frame.classList.remove('k-run', 'k-clear', 'k-re');
      ctx.back.classList.remove('k-clear');
      setScene('1');
      setDrops(0);
      setCard('', ctx);
    },
    vis: {
      v1: function (value) { setScene(value); },
      v2: function (value) { setDrops(value); },
      v4: function (value, ctx) { setCard(value, ctx); }
    },
    fx: {
      f1: function (arg, ctx) { release(ctx); }
    }
  };
})();
