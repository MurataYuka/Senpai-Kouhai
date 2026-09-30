/* 作品の演出。枠（#frame）の飾りと、背景（#bg）の切り替え。
   本文（#box / #lines）には触れない。名前はすべて記号（対応表は非公開メモ）。 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var N = 15;                     // 小さい花の数
  var DARK = 6;                   // 始めから入っている分のうち、暗い色の数
  var START = 8;                  // 始めに色の入っている数
  // 色が入っていく順（位置の番号）
  var ORDER = [2, 9, 5, 12, 0, 7, 10, 3, 14, 6, 11, 1, 13, 4, 8];
  // 位置：[辺, 割合]  b = 下辺（左から）、r = 右辺（下から）
  var POS = [
    ['b', .07], ['b', .16], ['b', .25], ['b', .34], ['b', .42],
    ['b', .58], ['b', .66], ['b', .75], ['b', .84],
    ['r', .12], ['r', .25], ['r', .38], ['r', .52], ['r', .66], ['r', .80]
  ];

  var small = [], big = null, built = false;

  function flowerSvg(size, rot) {
    var s = '<svg xmlns="' + NS + '" viewBox="-22 -22 44 44" width="' + size + '" height="' + size + '">';
    s += '<g transform="rotate(' + rot + ')">';
    s += '<path class="zs" d="M0,3 C1,9 -1,14 0,21"/>';
    for (var i = 0; i < 6; i++) {
      var a = i * 60 + (i % 2 ? 8 : -4);
      s += '<g transform="rotate(' + a + ')">';
      s += '<path class="zp" d="M0,0 C-3,-4 -4,-9 -1.5,-13 C-0.5,-15 2,-15.5 3.2,-13.6 C1.4,-13.4 0.6,-12 1,-10 C2,-6 1.6,-3 0,0 Z"/>';
      s += '<path class="zt" d="M0.4,0 C2.5,-7 7,-13 6,-19.5"/><circle class="zd" cx="6" cy="-19.5" r="0.9"/>';
      s += '</g>';
    }
    s += '</g></svg>';
    return s;
  }

  function placeFlower(el, side, t, size) {
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    if (side === 'b') { el.style.left = 'calc(' + (t * 100) + '% - ' + (size / 2) + 'px)'; el.style.bottom = (-size * 0.18) + 'px'; }
    else if (side === 'r') { el.style.right = (-size * 0.18) + 'px'; el.style.bottom = 'calc(' + (t * 100) + '% - ' + (size / 2) + 'px)'; }
    else if (side === 't') { el.style.left = 'calc(' + (t * 100) + '% - ' + (size / 2) + 'px)'; el.style.top = (-size * 0.18) + 'px'; }
    else if (side === 'l') { el.style.left = (-size * 0.18) + 'px'; el.style.bottom = 'calc(' + (t * 100) + '% - ' + (size / 2) + 'px)'; }
  }

  function rotFor(side, i) {
    var j = ((i * 37) % 23) - 11;
    if (side === 'b') return j;
    if (side === 'r') return -90 + j;
    if (side === 't') return 180 + j;
    return 90 + j;
  }

  function tailsSvg() {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 80 1000');
    svg.setAttribute('preserveAspectRatio', 'none');
    var mid = null;
    for (var i = 0; i < 9; i++) {
      var endY = 70 + i * 92;
      var sway = (i % 2 ? 1 : -1);
      var x1 = 18 + (i % 3) * 9, x2 = 40 + sway * 16, x3 = 22 + ((i * 7) % 5) * 6;
      var y0 = 1000, y1 = 1000 - (1000 - endY) * 0.3, y2 = 1000 - (1000 - endY) * 0.62, y3 = endY;
      var d = 'M2,' + y0 + ' C' + x1 + ',' + (y0 - 60) + ' ' + (x2 + 10) + ',' + y1 + ' ' + x2 + ',' + ((y1 + y2) / 2) +
        ' S' + (x3 - 8) + ',' + (y2 + 40) + ' ' + x3 + ',' + y3;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', 'zl');
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(p);
      var tip = document.createElementNS(NS, 'path');
      tip.setAttribute('d', 'M' + x3 + ',' + y3 + ' c' + (sway * 6) + ',-10 ' + (sway * 2) + ',-22 ' + (-sway * 4) + ',-30');
      tip.setAttribute('class', 'zl zf');
      tip.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(tip);
      if (i === 5) mid = { x: x2, y: (y1 + y2) / 2 };
    }
    // 尾の一本に入る斜めの線（@vis v2）
    var c = document.createElementNS(NS, 'path');
    c.setAttribute('d', 'M' + (mid.x - 14) + ',' + (mid.y - 34) + ' L' + (mid.x + 12) + ',' + (mid.y + 30));
    c.setAttribute('class', 'zc');
    c.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(c);
    return svg;
  }

  function build(frame) {
    if (built) return;
    built = true;
    var t = document.createElement('div');
    t.className = 'z1';
    t.appendChild(tailsSvg());
    frame.appendChild(t);

    var fl = document.createElement('div');
    fl.className = 'z2';
    POS.forEach(function (p, i) {
      var e = document.createElement('span');
      e.className = 'z3';
      e.innerHTML = flowerSvg(26, rotFor(p[0], i));
      placeFlower(e, p[0], p[1], 26);
      fl.appendChild(e);
      small.push(e);
    });
    big = document.createElement('span');
    big.className = 'z4';
    big.innerHTML = flowerSvg(60, 0);
    placeFlower(big, 'b', .5, 60);
    fl.appendChild(big);

    // 右辺のもう一輪（@vis v5）
    var b2 = document.createElement('span');
    b2.className = 'z7';
    b2.innerHTML = flowerSvg(58, -90);
    placeFlower(b2, 'r', .45, 58);
    fl.appendChild(b2);

    // 縁全体に広がる花（@vis v6）
    var ov = document.createElement('div');
    ov.className = 'z6';
    var k = 0;
    [['t', 14], ['l', 11], ['b', 8], ['r', 7]].forEach(function (s) {
      for (var i = 0; i < s[1]; i++) {
        var e = document.createElement('span');
        e.className = 'z3 zb';
        var tt = (i + 0.5) / s[1] + (((i * 13) % 7) - 3) * 0.006;
        var sz = 18 + ((i * 11 + k) % 4) * 4;
        e.innerHTML = flowerSvg(sz, rotFor(s[0], i + k));
        placeFlower(e, s[0], tt, sz);
        e.style.transitionDelay = (((k * 7) % 31) * 0.28) + 's';
        ov.appendChild(e);
        k++;
      }
    });
    fl.appendChild(ov);
    frame.appendChild(fl);

    // 下辺の線（@vis v7）
    var rv = document.createElement('div');
    rv.className = 'z5';
    frame.appendChild(rv);
  }

  function setRed(n) {
    n = Math.max(0, Math.min(N, Number(n) || 0));
    small.forEach(function (e) { e.classList.remove('zd1', 'zb1'); });
    for (var i = 0; i < n; i++) {
      var e = small[ORDER[i]];
      e.classList.add(i < DARK ? 'zd1' : 'zb1');
    }
  }

  window.ADV_EFFECTS = {
    init: function (ctx) {
      build(ctx.frame);
      setRed(START);
    },
    onReset: function (ctx) {
      setRed(START);
    },
    vis: {
      v1: function (value, ctx) { setRed(value === '' || value === 'off' ? START : value); }
    }
  };
})();
