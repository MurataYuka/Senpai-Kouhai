/* 作品の演出。奥のレイヤー（#back / #fxLayer）と枠（#frame）だけを使う。
   本文（#box / #lines）は動かさない。名前の差し替えは表示の文字を入れ替えるだけ。
   名前はすべて記号（対応表は非公開メモ）。 */
(function () {
  'use strict';

  var LB = ['着到', '再生', '蔵', '砂嵐', '明日の分', '平成六年', '逆さ回し', '二人分',
    '夜通し', '天気予報', '帳尻', '撮り直し', '空白', '巻き戻し', '頭出し'];

  // 巻き戻しのときに奥を流れる文（後ろの章から順に）
  var RW = [
    '帳場の戸口に、走査線の縁をした人が立っている。',
    '朱の筆の先が、紙の上で止まった。',
    '「字は、ちゃんと書けているか」',
    '「明日の霞ノ谷は、雪」',
    '夜明けの帳面に、細い線が一本。',
    '二時十一分　眼鏡を外す',
    '湯呑みが二つ。手は一つ。',
    'テープが、後ろ向きに廊下を歩いてくる。',
    '「振らなくていいんだよ」',
    'ぱきん、とツメの折れる音。',
    '墨が紙に沈んでいく。',
    '「……振らなくていいです」'
  ];

  var MD = { play: ['▶', 'PLAY'], stop: ['■', 'STOP'], rec: ['●', 'REC'], rew: ['◀◀', 'REW'], ff: ['▶▶', 'FF'] };
  var KAN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

  var built = false, layer = null, back = null, frame = null;
  var osd = null, osdS = null, osdT = null, date = null, band = null, fog = null, roll = null, white = null;
  var noise = null, nctx = null, snow = null, sctx = null;
  var flakes = [], snowDir = 'down', lastN = 0, burst = 0;
  var curName = '', nmOn = false, lbPrev = null, timers = [];

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function storedName() {
    try {
      var o = JSON.parse(window.localStorage.getItem('kadv13.opt') || 'null');
      if (o && o.lastName) return o.lastName;
    } catch (e) { }
    return '';
  }
  function nameNow(ctx) {
    if (ctx && ctx.state && ctx.state.name) curName = ctx.state.name;
    return curName || storedName();
  }
  function noiseOf(s) { return new Array(Array.from(String(s)).length + 1).join('▒'); }

  /* ---------- 組み立て ---------- */

  function build(ctx) {
    if (built) return;
    built = true;
    layer = ctx.layer; back = ctx.back; frame = ctx.frame;

    el('div', 'v1', layer);                         // 走査線
    noise = el('canvas', 'v2', layer);              // 砂嵐
    noise.width = 160; noise.height = 90;
    nctx = noise.getContext ? noise.getContext('2d') : null;
    snow = el('canvas', 'v3', layer);               // 雪
    sctx = snow.getContext ? snow.getContext('2d') : null;
    el('div', 'v5', layer);                         // 走査線の濃い帯（@vis gh）
    fog = el('div', 'v4', layer);                   // 湯気（@vis fg）
    roll = el('div', 'v9', layer);                  // 巻き戻しの文
    band = el('div', 'v8', layer);                  // ラベルの帯（@vis lb）

    osd = el('div', 'v6', layer);                   // 左上のモード表示（@vis md）
    osdS = el('span', 'v6s', osd);
    osdT = el('span', 'v6t', osd);
    date = el('div', 'v7', layer);                  // 右下の日付（@vis dt）

    white = el('div', 'vw', layer);                 // 白

    // 枠：ブラウン管の縁
    el('div', 'w1', frame);
    el('div', 'w2', frame);
    el('div', 'w3', frame);

    resize();
    window.addEventListener('resize', resize);
    makeFlakes();
    requestAnimationFrame(tick);
  }

  function resize() {
    if (!snow) return;
    snow.width = Math.max(1, Math.round(window.innerWidth));
    snow.height = Math.max(1, Math.round(window.innerHeight));
  }

  function makeFlakes() {
    flakes = [];
    var n = window.innerWidth < 560 ? 46 : 84;
    for (var i = 0; i < n; i++) flakes.push(newFlake(true));
  }
  function newFlake(anywhere) {
    var w = snow ? snow.width : 800, h = snow ? snow.height : 600;
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : (snowDir === 'up' ? h + 6 : -6),
      r: 0.6 + Math.random() * 1.9,
      v: 0.18 + Math.random() * 0.45,
      s: Math.random() * Math.PI * 2,
      a: 0.25 + Math.random() * 0.5
    };
  }

  var reduce = false;
  try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { }

  function tick(t) {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    // 砂嵐（こまめには描き替えない）
    var bursting = burst > t;
    if (nctx && t - lastN > (bursting ? 40 : 120)) {
      lastN = t;
      var img = nctx.createImageData(noise.width, noise.height), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var g = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
      }
      nctx.putImageData(img, 0, 0);
    }
    if (noise) noise.classList.toggle('on', bursting);
    // 雪
    if (!sctx) return;
    var w = snow.width, h = snow.height;
    sctx.clearRect(0, 0, w, h);
    if (snowDir === 'off') return;
    var up = snowDir === 'up', sp = reduce ? 0.35 : 1;
    sctx.fillStyle = '#e9efee';
    for (var k = 0; k < flakes.length; k++) {
      var f = flakes[k];
      f.s += 0.008;
      f.x += Math.sin(f.s) * 0.25 * sp;
      f.y += (up ? -f.v * 3.2 : f.v) * sp;
      if (f.y > h + 8 || f.y < -8 || f.x < -10 || f.x > w + 10) { flakes[k] = newFlake(false); continue; }
      sctx.globalAlpha = f.a;
      sctx.beginPath();
      sctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      sctx.fill();
    }
    sctx.globalAlpha = 1;
  }

  /* ---------- ラベルの帯 ---------- */

  function label(cls, text, i) {
    var a = el('div', 'v8a' + (cls ? ' ' + cls : ''), null);
    var t = el('span', 'v8t', a);
    t.textContent = text;
    var n = el('span', 'v8n', a);
    n.textContent = noiseOf(text);
    a.style.setProperty('--i', String(i));
    return a;
  }

  function drawLabels(value, ctx) {
    var prev = lbPrev;
    lbPrev = value;
    band.innerHTML = '';
    band.className = 'v8';
    if (!value || value === 'off' || value === '0') return;
    var nm = nameNow(ctx);
    var peel = value === 'peel';
    var m = /^(\d+)(x?)$/.exec(value);
    var count = peel ? 15 : (m ? Math.min(15, Number(m[1])) : 0);
    // 一番下：最初から貼ってある一枚（ほかの手の字）
    band.appendChild(label('v8z', '平成六年十二月　' + nm, 0));
    for (var i = 1; i <= count; i++) band.appendChild(label('', KAN[i] + '　' + LB[i - 1], i));
    if (m && m[2]) band.classList.add('v8x');          // 一番上が滲む
    var tops = band.querySelectorAll('.v8a:not(.v8z)');
    var top = tops[tops.length - 1];
    if (top) top.classList.add('v8top');
    if (peel) {
      var animate = !ctx.restoring && !ctx.skipping && /^\d+x?$/.test(String(prev || ''));
      band.classList.add('v8p');
      if (animate) {
        for (var j = tops.length - 1, d = 0; j >= 0; j--, d++) tops[j].style.setProperty('--d', (0.4 + d * 0.34).toFixed(2) + 's');
        band.classList.add('v8go');
      } else band.classList.add('v8done');
      return;
    }
    if (top && !ctx.restoring && !ctx.skipping && m && String(prev || '') !== value) top.classList.add('v8new');
  }

  /* ---------- 名前の差し替え（表示だけ） ---------- */

  function maskLine(nm) {
    var lines = document.getElementById('lines');
    if (!lines || !nm) return;
    var p = lines.lastElementChild;
    if (!p) return;
    var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
    var nodes = [], nd;
    while ((nd = walker.nextNode())) if (nd.nodeValue.indexOf(nm) >= 0) nodes.push(nd);
    nodes.forEach(function (node) {
      var parts = node.nodeValue.split(nm);
      var frag = document.createDocumentFragment();
      parts.forEach(function (s, i) {
        if (i > 0) {
          var sp = document.createElement('span');
          sp.className = 'v0';
          sp.textContent = noiseOf(nm);
          frag.appendChild(sp);
        }
        if (s) frag.appendChild(document.createTextNode(s));
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  // 記録の見出しと本文の {name} を差し替える（エンジンは記録を差し替えないため）
  function watchPanel() {
    var body = document.getElementById('pbody');
    if (!body || !window.MutationObserver) return;
    var fix = function () {
      var nm = curName || storedName();
      if (!nm) return;
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null), nd, hit = [];
      while ((nd = walker.nextNode())) if (nd.nodeValue.indexOf('{name}') >= 0) hit.push(nd);
      hit.forEach(function (n) { n.nodeValue = n.nodeValue.split('{name}').join(nm); });
    };
    new MutationObserver(fix).observe(body, { childList: true, subtree: true });
  }

  /* ---------- 巻き戻しの文 ---------- */

  function rewindLines() {
    roll.innerHTML = '';
    RW.forEach(function (s, i) {
      later(function () {
        var p = el('div', 'v9a', roll);
        p.textContent = s;
        p.style.left = (6 + ((i * 37) % 44)) + '%';
        if (i === RW.length - 1) p.classList.add('v9z');
      }, 500 + i * 1150);
    });
    later(function () { white.classList.add('on'); }, 500 + RW.length * 1150 + 2400);
  }

  function resetAll() {
    clearTimers();
    if (!built) return;
    roll.innerHTML = '';
    white.classList.remove('on');
    burst = 0;
    frame.classList.remove('w-tk');
    back.classList.remove('w-tk');
  }

  window.ADV_EFFECTS = {

    init: function (ctx) {
      build(ctx);
      watchPanel();
    },

    onReset: function (ctx) {
      build(ctx);
      resetAll();
      if (snowDir !== 'down') { snowDir = 'down'; makeFlakes(); }
      nmOn = false;
      lbPrev = null;
      band.innerHTML = '';
      band.className = 'v8';
      fog.setAttribute('data-n', '0');
      osd.className = 'v6';
      osdS.textContent = ''; osdT.textContent = '';
      date.textContent = '';
    },

    onChapter: function (file, ctx) {
      nameNow(ctx);
      resetAll();
    },

    onRestore: function (ctx) { nameNow(ctx); },

    onText: function (text, ctx) {
      var nm = nameNow(ctx);
      if (nmOn && nm) maskLine(nm);
    },

    vis: {
      md: function (v) {
        var m = MD[v];
        osd.className = 'v6' + (m ? ' v6-' + v : '');
        osdS.textContent = m ? m[0] : '';
        osdT.textContent = m ? m[1] : '';
      },
      dt: function (v) {
        var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v || '');
        date.textContent = m ? (m[1] + '. ' + Number(m[2]) + '. ' + Number(m[3])) : '';
      },
      lb: function (v, ctx) { drawLabels(v, ctx); },
      fg: function (v) {
        fog.setAttribute('data-n', /^[0-3]$/.test(v) ? v : '0');
        if (v !== '3') white.classList.remove('on');
      },
      nm: function (v, ctx) { nameNow(ctx); nmOn = v === 'on'; },
      sn: function (v) {
        var next = v === 'up' || v === 'off' ? v : 'down';
        if (next !== snowDir) { snowDir = next; if (next !== 'off') makeFlakes(); }
      },
      gh: function () { }   // 見た目は CSS（body[data-v-gh="on"]）
    },

    fx: {
      // 全館のブラウン管が点く：奥が一瞬、砂嵐で満ちる
      s1: function (arg) {
        burst = performance.now() + (Number(arg) || 900);
      },
      // トラッキングのずれ：枠と奥だけ
      tk: function (arg, ctx) {
        var b = ctx.back, f = ctx.frame;
        [b, f].forEach(function (e) { e.classList.remove('w-tk'); void e.offsetWidth; e.classList.add('w-tk'); });
        later(function () { b.classList.remove('w-tk'); f.classList.remove('w-tk'); }, 900);
      },
      // 巻き戻し：奥を文が下から上へ流れて消え、最後に白くなる
      r1: function () { rewindLines(); }
    }
  };
})();
