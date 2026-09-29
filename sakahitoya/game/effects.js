/* 作品の演出。名前はすべて記号（対応表は docs/secret/notes.md）。
   本文（#box / #lines）には触れない。動かすのは #back の中（#bg と #fxLayer）と #frame だけ。 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 400, TOP = 70, MID = H / 2;
  var LAMPS = 15;
  var stage = null, lamps = [];

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // 屋根並み：決まった並び（毎回同じ形になるよう、乱数は使わない）
  var ROW = [
    [60, 30, 'g'], [40, 18, 'f'], [55, 36, 'g'], [30, 22, 'f'], [70, 44, 't'], [45, 26, 'g'],
    [38, 16, 'f'], [60, 32, 'g'], [36, 24, 'f'], [52, 40, 'g'], [26, 58, 's'], [52, 40, 'g'],
    [36, 24, 'f'], [60, 30, 'g'], [42, 20, 'f'], [48, 34, 'g'], [70, 46, 't'], [34, 20, 'f'],
    [58, 28, 'g'], [44, 36, 'g'], [30, 14, 'f'], [55, 30, 'g']
  ];

  function roofPath() {
    var x = 0, d = 'M0 ' + TOP;
    var scale = W / ROW.reduce(function (s, r) { return s + r[0]; }, 0);
    var boxes = [];
    ROW.forEach(function (r) {
      var w = r[0] * scale, h = r[1], k = r[2];
      var y = TOP - h;
      if (k === 'g') {
        d += ' L' + x + ' ' + (y + 10) + ' L' + (x + w / 2) + ' ' + y + ' L' + (x + w) + ' ' + (y + 10);
      } else if (k === 't') {
        d += ' L' + x + ' ' + (y + 12) + ' L' + (x + w * 0.3) + ' ' + (y + 12) + ' L' + (x + w * 0.3) + ' ' + (y - 6) +
          ' L' + (x + w * 0.5) + ' ' + (y - 18) + ' L' + (x + w * 0.7) + ' ' + (y - 6) + ' L' + (x + w * 0.7) + ' ' + (y + 12) +
          ' L' + (x + w) + ' ' + (y + 12);
      } else if (k === 's') {
        d += ' L' + x + ' ' + (y + 30) + ' L' + (x + w * 0.2) + ' ' + (y + 30) + ' L' + (x + w * 0.5) + ' ' + (y - 8) +
          ' L' + (x + w * 0.8) + ' ' + (y + 30) + ' L' + (x + w) + ' ' + (y + 30);
      } else {
        d += ' L' + x + ' ' + y + ' L' + (x + w) + ' ' + y;
      }
      d += ' L' + (x + w) + ' ' + TOP;
      boxes.push({ x: x, w: w, h: h, k: k });
      x += w;
    });
    return { d: d, boxes: boxes };
  }

  function build(layer) {
    if (stage) return;
    stage = document.createElement('div');
    stage.className = 'k0';
    var sky = document.createElement('div');
    sky.className = 'k3';
    layer.appendChild(sky);
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    var rp = roofPath();

    // 上の街（上都）
    var up = el('g', { 'class': 'k1' }, svg);
    el('path', { d: rp.d, 'class': 'k-ln' }, up);

    // 岩盤の線と、ひび
    el('line', { x1: 0, y1: MID, x2: W, y2: MID, 'class': 'k-rk' }, svg);
    var crack = 'M' + (W * 0.18) + ' ' + MID;
    var pts = [[0.24, -7], [0.29, 5], [0.35, -4], [0.41, 8], [0.46, -6], [0.5, 3], [0.55, -9], [0.61, 6], [0.67, -3], [0.72, 7], [0.78, -5], [0.84, 2]];
    pts.forEach(function (p) { crack += ' L' + (W * p[0]) + ' ' + (MID + p[1]); });
    el('path', { d: crack, 'class': 'k-ck k-ck1' }, svg);
    el('path', { d: 'M' + (W * 0.5) + ' ' + (MID + 3) + ' L' + (W * 0.52) + ' ' + (MID - 40) + ' L' + (W * 0.49) + ' ' + (MID - 70) + ' L' + (W * 0.51) + ' ' + (MID - 110) +
      ' M' + (W * 0.55) + ' ' + (MID - 9) + ' L' + (W * 0.57) + ' ' + (MID + 45) + ' L' + (W * 0.54) + ' ' + (MID + 90) + ' L' + (W * 0.56) + ' ' + (MID + 120), 'class': 'k-ck k-ck2' }, svg);

    // 下の街（逆さ）：同じ屋根並みを上下に返す
    var down = el('g', { 'class': 'k2', transform: 'translate(0 ' + H + ') scale(1 -1)' }, svg);
    el('path', { d: rp.d, 'class': 'k-ln' }, down);
    // 窓（灯り）：逆さの街の建物に一つずつ
    var picks = [0, 2, 4, 5, 7, 8, 9, 10, 11, 13, 15, 16, 18, 19, 21];
    lamps = [];
    picks.forEach(function (i, n) {
      var b = rp.boxes[i];
      var ww = Math.min(9, b.w * 0.22), wh = 9;
      var wx = b.x + b.w / 2 - ww / 2 + ((n % 3) - 1) * (b.w * 0.12);
      var wy = TOP - Math.min(b.h, 30) + 6;
      var r = el('rect', { x: wx, y: wy, width: ww, height: wh, 'class': 'k-w' }, down);
      lamps.push(r);
    });

    // 左右の縁の縦線
    el('line', { x1: 6, y1: 0, x2: 6, y2: H, 'class': 'k-ax' }, svg);
    el('line', { x1: W - 6, y1: 0, x2: W - 6, y2: H, 'class': 'k-ax' }, svg);

    stage.appendChild(svg);
    layer.appendChild(stage);
  }

  // ロードや初期化のときは、遷移なしで一気に状態を合わせる
  function instant() {
    document.body.classList.add('k-now');
    requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.remove('k-now'); }); });
  }

  function setLamps(n) {
    n = Math.max(0, Math.min(LAMPS, parseInt(n, 10) || 0));
    lamps.forEach(function (r, i) { r.classList.toggle('on', i < n); });
  }

  function replay(elm, cls, ms) {
    elm.classList.remove(cls); void elm.offsetWidth; elm.classList.add(cls);
    setTimeout(function () { elm.classList.remove(cls); }, ms);
  }

  window.ADV_EFFECTS = {

    init: function (ctx) { build(ctx.layer); instant(); setLamps(0); },

    onReset: function (ctx) {
      build(ctx.layer);
      instant();
      setLamps(0);
      ctx.back.classList.remove('k-x1');
    },

    onRestore: function (ctx) { instant(); },

    vis: {
      // 灯りの数
      v1: function (value, ctx) { if (ctx.restoring) instant(); setLamps(value); },
      // 以下は body の data-v-* を CSS が見る。ロードのときは遷移なしで合わせる
      v2: function (value, ctx) { if (ctx.restoring) instant(); },
      v3: function (value, ctx) { if (ctx.restoring) instant(); },
      v4: function (value, ctx) { if (ctx.restoring) instant(); },
      v5: function (value, ctx) { if (ctx.restoring) instant(); },
      v6: function (value, ctx) { if (ctx.restoring) instant(); },
      v7: function (value, ctx) { if (ctx.restoring) instant(); }
    },

    fx: {
      // 奥だけが上下に一回りする
      x1: function (arg, ctx) { replay(ctx.back, 'k-x1', 3400); },
      // 灯りがまたたく（奥だけ）
      x2: function (arg, ctx) { replay(ctx.layer, 'k-x2', 1600); }
    }
  };
})();
