/* 作品の演出。枠（#frame）の飾り、背景（#bg）、奥のレイヤー（#fxLayer）の演出。
   本文（#box / #lines）には触れない。名前はすべて記号（対応表は非公開メモ）。 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#ff4d5e', '#4da6ff', '#ffc94a', '#4dffa0', '#c77dff', '#ff8ad8', '#6ff0ff', '#ffe9a8'];

  // 上辺の印の位置（左からの割合）。最大 7 つ
  var SLOT = [.18, .29, .41, .52, .63, .74, .85];
  // 奥の図の穴の位置（viewBox 1200×700）。印 i は穴 i に嵌まる（穴は六つ。七つ目の印は穴に入らない）
  var HOLE = [[214, 236], [128, 338], [272, 392], [408, 300], [884, 306], [762, 404]];

  // 札の中身
  var CARD = {
    b01: ['本日の撃破数', '天羽 対 亜竜'],
    b02: ['<s>先に相手を名前で呼ぶのはどっち</s>', '天羽が先輩の名前を呼ぶか'],
    b03: ['今月中に', '手をつなぐか'],
    b04: ['天羽が高雲居で', '告白するか', '<em>不成立</em>'],
    b05: ['まだ付き合って', 'ないのか', '<em>賭け不成立</em>'],
    b06: ['<b>払い戻し停止</b>', '胴元不在につき']
  };

  var marks = [], card = null, wing = null, holes = [], built = false, flying = [];

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- 枠 ---------- */

  // 左辺：焦げたギザギザの線
  function leftEdge(frame) {
    var box = el('div', 'k1', frame);
    var s = svg('svg', { viewBox: '0 0 24 1000', preserveAspectRatio: 'none' }, box);
    var d = 'M12,0', y = 0, i = 0;
    while (y < 1000) {
      y += 9 + ((i * 7) % 13);
      var x = 12 + (((i * 11) % 9) - 4) * (i % 3 ? 1.4 : 2.2);
      d += ' L' + x.toFixed(1) + ',' + Math.min(y, 1000);
      i++;
    }
    svg('path', { d: d, class: 'k1a', 'vector-effect': 'non-scaling-stroke' }, s);
    svg('path', { d: d, class: 'k1b', 'vector-effect': 'non-scaling-stroke' }, s);
    // にじむ色
    [[.12, 0], [.3, 1], [.47, 2], [.63, 3], [.81, 4], [.93, 5]].forEach(function (p) {
      var g = el('i', 'k1c', box);
      g.style.top = (p[0] * 100) + '%';
      g.style.background = 'radial-gradient(closest-side, ' + COLORS[p[1]] + ', transparent)';
      g.style.animationDelay = (p[1] * 1.3) + 's';
    });
  }

  // 上辺の印
  function markSvg(kind) {
    var s = '<svg xmlns="' + NS + '" viewBox="-20 -20 40 40">';
    var ring = function (r1, r2, n, rot, w) {
      var o = '';
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + rot;
        o += '<line x1="' + (Math.cos(a) * r1).toFixed(2) + '" y1="' + (Math.sin(a) * r1).toFixed(2) +
          '" x2="' + (Math.cos(a) * r2).toFixed(2) + '" y2="' + (Math.sin(a) * r2).toFixed(2) +
          '" stroke="' + COLORS[i % COLORS.length] + '" stroke-width="' + w + '" stroke-linecap="round"/>';
      }
      return o;
    };
    if (kind === '2') {
      s += ring(10, 17, 12, 0, 1.6);
      s += ring(3.5, 8.5, 8, .2, 1.6);
    } else {
      s += ring(4, 13, 10, 0, 1.8);
    }
    s += '<circle r="1.8" fill="#fff6e0"/></svg>';
    return s;
  }

  function build(ctx) {
    if (built) return;
    built = true;
    var frame = ctx.frame;
    el('div', 'k3', frame);            // 上辺の帯
    el('div', 'k5', frame);            // 下辺の帯
    leftEdge(frame);
    el('div', 'k2', frame);            // 右辺
    el('div', 'k6', frame);            // 左右対称の線（独白）
    var row = el('div', 'k4', frame);  // 印の入れ物
    SLOT.forEach(function (t) {
      var m = el('span', 'k4a', row);
      m.style.left = (t * 100) + '%';
      marks.push(m);
    });
    card = el('div', 'k7', frame);

    // 奥の図
    wing = el('div', 'k8', ctx.layer);
    var s = svg('svg', { viewBox: '0 0 1200 700', preserveAspectRatio: 'xMidYMid meet' }, wing);
    var defs = svg('defs', {}, s);
    var g1 = svg('linearGradient', { id: 'k8g1', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    svg('stop', { offset: '0', 'stop-color': '#fff3c4' }, g1);
    svg('stop', { offset: '.35', 'stop-color': '#ff5a6e' }, g1);
    svg('stop', { offset: '.7', 'stop-color': '#5aa8ff', 'stop-opacity': '.7' }, g1);
    svg('stop', { offset: '1', 'stop-color': '#4dffa0', 'stop-opacity': '0' }, g1);
    var mask = svg('mask', { id: 'k8m' }, defs);
    svg('rect', { x: 0, y: 0, width: 1200, height: 700, fill: '#fff' }, mask);
    HOLE.forEach(function (h, i) {
      svg('ellipse', { cx: h[0], cy: h[1], rx: 16 + (i % 3) * 4, ry: 11 + (i % 2) * 4, fill: '#000' }, mask);
    });
    // 左（大きく歪）
    svg('path', {
      class: 'k8a', mask: 'url(#k8m)',
      d: 'M588,404 L470,300 L338,168 L196,132 L36,118 L58,190 L44,262 L70,334 L52,420 L104,452 L132,520 L150,566 ' +
         'L204,556 L246,584 L300,604 L352,560 L420,540 L470,488 L540,462 L590,436 Z'
    }, s);
    // 右（小さい）
    svg('path', {
      class: 'k8b', mask: 'url(#k8m)',
      d: 'M612,404 L700,318 L802,232 L906,214 L1008,210 L996,262 L1004,330 L990,382 L962,420 L944,470 ' +
         'L892,468 L852,498 L794,486 L732,470 L668,446 L612,432 Z'
    }, s);
    // 骨
    svg('path', { class: 'k8c', d: 'M588,404 L338,168 L36,118 M338,168 L52,420 M338,168 L150,566 M338,168 L300,604' }, s);
    svg('path', { class: 'k8c', d: 'M612,404 L802,232 L1008,210 M802,232 L990,382 M802,232 L852,498' }, s);
    // 穴と噴き
    HOLE.forEach(function (h, i) {
      var g = svg('g', { class: 'k8h', transform: 'translate(' + h[0] + ',' + h[1] + ')' }, s);
      svg('path', { class: 'k8j', d: 'M-12,0 Q-8,60 0,120 Q8,60 12,0 Z', fill: 'url(#k8g1)' }, g);
      svg('ellipse', { class: 'k8r', rx: 16 + (i % 3) * 4, ry: 11 + (i % 2) * 4 }, g);
      holes.push(g);
    });
  }

  /* ---------- 状態 ---------- */

  var skyVal = '';
  function setSky(v) {
    skyVal = /^[12]*$/.test(v || '') ? (v || '') : '';
    marks.forEach(function (m, i) {
      var k = skyVal.charAt(i);
      if (!k) { m.innerHTML = ''; m.className = 'k4a'; return; }
      if (m.getAttribute('data-k') !== k || !m.innerHTML) m.innerHTML = markSvg(k);
      m.setAttribute('data-k', k);
      m.className = 'k4a on' + (k === '2' ? ' dbl' : '');
    });
    holes.forEach(function (h, i) { h.setAttribute('data-k', skyVal.charAt(i) || ''); });
  }

  function setCard(v) {
    if (!card) return;
    var c = CARD[v];
    if (!c) { card.classList.remove('on'); return; }
    card.innerHTML = '<small>本日の賭け</small>' + c.map(function (t) { return '<span>' + t + '</span>'; }).join('') +
      '<small class="k7a">胴元 狸塚</small>';
    card.classList.add('on');
  }

  function clearFlying() {
    flying.forEach(function (f) { clearTimeout(f.t); if (f.e && f.e.parentNode) f.e.parentNode.removeChild(f.e); });
    flying = [];
  }

  function setWing(v, ctx) {
    clearFlying();
    if (!wing) return;
    var on = v === 'on' || v === 'fall' || v === 'hold';
    holes.forEach(function (h) { h.classList.remove('lit'); });
    if (!on) { document.body.classList.remove('k8on'); return; }
    document.body.classList.add('k8on');
    var n = Math.min(skyVal.length, holes.length);
    if (ctx.restoring || ctx.skipping) {
      for (var i = 0; i < n; i++) holes[i] && holes[i].classList.add('lit');
      return;
    }
    // 印が上辺から滑り落ちて、穴に嵌まる
    for (var j = 0; j < n; j++) (function (i) {
      var src = marks[i].getBoundingClientRect();
      var dst = holes[i].getBoundingClientRect();
      var c = el('span', 'k4b', ctx.layer);
      c.innerHTML = markSvg(skyVal.charAt(i));
      c.style.left = src.left + 'px'; c.style.top = src.top + 'px';
      c.style.width = src.width + 'px'; c.style.height = src.height + 'px';
      var f = { e: c };
      flying.push(f);
      f.t = setTimeout(function () {
        c.style.transform = 'translate(' + (dst.left + dst.width / 2 - src.left - src.width / 2) + 'px,' +
          (dst.top + dst.height / 2 - src.top - src.height / 2) + 'px) scale(1.6)';
        f.t = setTimeout(function () {
          holes[i].classList.add('lit');
          c.style.opacity = '0';
          f.t = setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 900);
        }, 1500);
      }, 900 + i * 420);
    })(j);
  }

  /* ---------- 一時の演出 ---------- */

  function jolt(ctx, cls, ms) {
    [ctx.frame, ctx.back].forEach(function (e) {
      e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls);
      setTimeout(function () { e.classList.remove(cls); }, ms);
    });
  }

  function burst(ctx, opt) {
    var b = el('div', 'k9' + (opt.cls ? ' ' + opt.cls : ''), ctx.layer);
    b.style.left = opt.x + '%'; b.style.top = opt.y + '%';
    b.style.setProperty('--k9s', opt.size + 'px');
    el('i', 'k9a', b);
    for (var i = 0; i < opt.n; i++) {
      var p = el('i', 'k9b', b);
      var a = (i / opt.n) * 360 + ((i * 17) % 11);
      p.style.setProperty('--k9r', a + 'deg');
      p.style.setProperty('--k9d', (opt.size * (.55 + ((i * 7) % 5) / 10)) + 'px');
      var col = opt.gray ? (i % 2 ? '#f4f4f4' : '#9a9a9a') : COLORS[(i + opt.seed) % COLORS.length];
      p.style.background = col; p.style.color = col;
      p.style.animationDelay = (((i * 3) % 4) * 0.02) + 's';
    }
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 2400);
  }

  var DELAY = { far: 900, mid: 450, near: 150, zero: 0 };
  var SIZE = { far: 70, mid: 140, near: 240, zero: 420 };
  var seed = 0;

  window.ADV_EFFECTS = {
    init: function (ctx) { build(ctx); },
    onReset: function (ctx) {
      clearFlying();
      setSky('');
      setCard('');
      setWing('', ctx);
    },
    vis: {
      v1: function (value) { setSky(value === 'off' ? '' : value); },
      v3: function (value) { setCard(value); },
      v4: function (value, ctx) { setWing(value, ctx); }
    },
    fx: {
      // 光が先、揺れ（音）があと。距離で遅れと大きさを変える
      f1: function (arg, ctx) {
        var k = DELAY[arg] !== undefined ? arg : 'mid';
        seed++;
        var x = k === 'zero' ? 50 : 22 + ((seed * 37) % 56);
        var y = k === 'zero' ? 42 : (k === 'far' ? 16 + (seed * 13) % 14 : 20 + (seed * 11) % 26);
        burst(ctx, { x: x, y: y, size: SIZE[k], n: k === 'far' ? 18 : 28, seed: seed });
        setTimeout(function () { jolt(ctx, 'k-c', 420); }, DELAY[k]);
      },
      // 黒色火薬：鈍い光と、すぐ来る低い揺れ
      f2: function (arg, ctx) {
        var g = el('div', 'k10', ctx.layer);
        g.style.left = (30 + (seed * 23) % 40) + '%';
        seed++;
        setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 1600);
        setTimeout(function () { jolt(ctx, 'k-t', 700); }, 40);
      },
      // 色のない閃光と、鋭い揺れ
      f3: function (arg, ctx) {
        seed++;
        burst(ctx, { x: 25 + (seed * 31) % 50, y: 22 + (seed * 7) % 20, size: 170, n: 22, seed: seed, gray: true, cls: 'k9g' });
        setTimeout(function () { jolt(ctx, 'k-c', 420); }, 380);
      }
    }
  };
})();
