/* 演出：画面下辺の線（v1 現在地／v2 点線／v3 線の形）。すべてテキストボックスの後ろ（#fxLayer）に描く。
   本文（#box / #lines）には触れない。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var ST = { v1: 0, v2: '', v3: '' };
  var svg = null, G = {}, layer = null, timers = [];
  var LAST = 12;                                   // v1 の最大（王都の門前）

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function geom() {
    var W = window.innerWidth, H = window.innerHeight;
    var cs = getComputedStyle(document.documentElement);
    var bb = num(cs.getPropertyValue('--box-bottom'), 52);
    var gut = num(cs.getPropertyValue('--gut'), 16);
    var bw = Math.min(780, W - 2 * gut - 12);
    var y = H - bb + 9;
    var x0 = 30, x1 = W - 30;
    return { W: W, H: H, y: y, x0: x0, x1: x1, bw: bw };
  }
  function sx(g, i) { return g.x0 + (g.x1 - g.x0) * i / (LAST + 1); }

  /* 羊の巻き角の渦：道の端から持ち上がって、内へ巻き込む */
  function hornPath(g, side, scale) {
    var R = Math.min(g.H * 0.36, g.W * 0.27, 330);
    var cxL = g.W / 2 - Math.max(g.bw * 0.36, R * 0.9);
    var cx = side < 0 ? cxL : g.W - cxL;
    var cy = g.y - R;
    var end = side < 0 ? g.x0 : g.x1;
    var d = 'M' + end.toFixed(1) + ' ' + g.y.toFixed(1) + ' L' + cx.toFixed(1) + ' ' + g.y.toFixed(1);
    var turns = 4.3 * Math.PI, steps = 150;
    for (var k = 1; k <= steps; k++) {
      var t = k / steps;
      var th = Math.PI / 2 + t * turns;
      var r = R * (1 - 0.86 * Math.pow(t, 0.85));
      var px = cx + side * r * Math.cos(th) * -1;
      var py = cy + r * Math.sin(th);
      d += ' L' + px.toFixed(1) + ' ' + py.toFixed(1);
    }
    return { d: d, cx: cx, cy: cy };
  }

  function drawOn(path, ms, delay) {
    var L = path.getTotalLength ? path.getTotalLength() : 3000;
    path.style.transition = 'none';
    path.style.strokeDasharray = L + ' ' + L;
    path.style.strokeDashoffset = L;
    void path.getBoundingClientRect();
    later(function () {
      path.style.transition = 'stroke-dashoffset ' + ms + 'ms ease-in-out';
      path.style.strokeDashoffset = 0;
    }, delay || 30);
  }
  function drawOff(path, ms, delay) {
    var L = path.getTotalLength ? path.getTotalLength() : 3000;
    path.style.strokeDasharray = L + ' ' + L;
    path.style.strokeDashoffset = 0;
    void path.getBoundingClientRect();
    later(function () {
      path.style.transition = 'stroke-dashoffset ' + ms + 'ms ease-in-out, opacity ' + ms + 'ms';
      path.style.strokeDashoffset = L;
    }, delay || 30);
  }

  /* 通常の道：線・両端の印・刻み・現在地・点線 */
  function drawRoad(g, opt) {
    opt = opt || {};
    var road = mk('g', { 'class': 'road' }, svg);
    var right = opt.open ? g.W + 40 : g.x1;
    var line = mk('path', { 'class': 'line', d: 'M' + g.x0 + ' ' + g.y + ' L' + right + ' ' + g.y }, road);
    if (!opt.noCastle) {
      var c = mk('g', { 'class': 'mark castle', transform: 'translate(' + g.x0 + ' ' + g.y + ')' }, road);
      mk('path', { d: 'M-6 0 V-9 H-4 V-7 H-1 V-10 H1 V-7 H4 V-9 H6 V0 Z' }, c);
    }
    if (!opt.open && !opt.noCapital) {
      var k = mk('g', { 'class': 'mark capital', transform: 'translate(' + g.x1 + ' ' + g.y + ')' }, road);
      mk('path', { d: 'M-7 0 V-6 Q0 -13 7 -6 V0 Z' }, k);
      mk('path', { 'class': 'gate', d: 'M-2.5 0 V-4 Q0 -6.5 2.5 -4 V0 Z' }, k);
    }
    var upto = opt.ticks === undefined ? ST.v1 : opt.ticks;
    for (var i = 1; i <= LAST; i++) {
      var x = sx(g, i);
      mk('path', { 'class': 'tick' + (i <= upto ? ' on' : ''), d: 'M' + x.toFixed(1) + ' ' + (g.y - 4) + ' V' + (g.y + 4) }, road);
    }
    if (!opt.noDot) {
      var at = opt.dotAt === undefined ? ST.v1 : opt.dotAt;
      var dot = mk('circle', { 'class': 'dot', cx: at <= 0 ? g.x0 : sx(g, at), cy: g.y, r: 3.6 }, road);
      G.dot = dot;
    }
    if (!opt.noLoop && (ST.v2 === 'on' || ST.v2 === 'deep')) {
      var d = 'M' + (g.x1 + 10) + ' ' + g.y + ' H' + (g.W - 18) + ' Q' + (g.W - 11) + ' ' + g.y + ' ' + (g.W - 11) + ' ' + (g.y + 7) +
        ' V' + (g.H - 18) + ' Q' + (g.W - 11) + ' ' + (g.H - 11) + ' ' + (g.W - 18) + ' ' + (g.H - 11) + ' H18';
      mk('path', { 'class': 'loopline ' + ST.v2, d: d }, road);
    }
    G.road = road; G.line = line;
    return road;
  }

  function drawHorns(g, animate, cls) {
    var grp = mk('g', { 'class': 'horns ' + (cls || '') }, svg);
    var L = hornPath(g, -1), R = hornPath(g, 1);
    var pl = mk('path', { 'class': 'horn', d: L.d }, grp);
    var pr = mk('path', { 'class': 'horn', d: R.d }, grp);
    G.horns = grp; G.hl = pl; G.hr = pr; G.hc = [L, R];
    if (animate) { drawOn(pl, 5200, 60); drawOn(pr, 5200, 60); }
    return grp;
  }

  function clear() {
    clearTimers();
    if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
    G = {};
    if (layer) Array.prototype.slice.call(layer.querySelectorAll('.bit')).forEach(function (b) { b.remove(); });
  }

  /* v3 の各形。animate が false なら最終の形をそのまま置く */
  var SHAPES = {
    horns: function (g, a) {
      drawRoad(g, { noDot: false });
      G.road.classList.add(a ? 'fading' : 'gone');
      drawHorns(g, a);
    },
    straight: function (g, a) {
      if (a) {
        drawHorns(g, false); drawOff(G.hl, 3600); drawOff(G.hr, 3600);
        later(function () {
          var r = drawRoad(g, { open: true, noCapital: true, noDot: true, noLoop: true, ticks: LAST });
          drawOn(G.line, 3000);
          r.classList.add('rise');
          var dot = mk('circle', { 'class': 'dot travel', cx: sx(g, LAST), cy: g.y, r: 3.6 }, r);
          later(function () { dot.style.transform = 'translateX(' + (g.W - sx(g, LAST) + 60) + 'px)'; }, 3200);
        }, 3000);
      } else {
        drawRoad(g, { open: true, noCapital: true, noDot: true, noLoop: true, ticks: LAST });
      }
    },
    crown: function (g, a) {
      drawHorns(g, false, a ? '' : 'crown');
      if (a) later(function () { G.horns.classList.add('crown'); }, 60);
    },
    stray: function (g, a) {
      var x = sx(g, LAST);
      var d = 'M' + x + ' ' + g.y + ' C' + (x - 40) + ' ' + (g.y + 14) + ' ' + (x - 150) + ' ' + (g.H - 8) + ' ' + (x - 300) + ' ' + (g.H + 40);
      if (a) {
        drawHorns(g, false); drawOff(G.hl, 3200); drawOff(G.hr, 3200);
        later(function () {
          var p = mk('path', { 'class': 'stray', d: d }, svg);
          drawOn(p, 4200);
          svg.classList.add('vignette');
        }, 3000);
      } else {
        mk('path', { 'class': 'stray', d: d }, svg);
      }
    },
    loop: function (g, a) {
      var cx = g.W / 2, cy = g.H / 2, rx = g.W / 2 - 30, ry = g.H / 2 - 30;
      var d = 'M' + (cx - rx) + ' ' + cy + ' A' + rx + ' ' + ry + ' 0 1 1 ' + (cx + rx) + ' ' + cy + ' A' + rx + ' ' + ry + ' 0 1 1 ' + (cx - rx) + ' ' + cy;
      function ring() {
        var grp = mk('g', { 'class': 'ring' }, svg);
        var p = mk('path', { 'class': 'line', d: d }, grp);
        var c = mk('g', { 'class': 'mark castle', transform: 'translate(' + (cx - rx) + ' ' + cy + ')' }, grp);
        mk('path', { d: 'M-6 0 V-9 H-4 V-7 H-1 V-10 H1 V-7 H4 V-9 H6 V0 Z' }, c);
        mk('circle', { 'class': 'dot', cx: cx - rx, cy: cy, r: 3.6 }, grp);
        return p;
      }
      if (a) {
        drawHorns(g, false);
        G.horns.classList.add('closing');
        later(function () { G.horns.remove(); drawOn(ring(), 4200); }, 2600);
      } else ring();
    },
    halt: function (g, a) {
      if (a) {
        drawHorns(g, false); drawOff(G.hl, 3600); drawOff(G.hr, 3600);
        later(function () {
          drawRoad(g, { ticks: 1, dotAt: 1, noLoop: true });
          G.road.classList.add('rise');
        }, 3200);
      } else drawRoad(g, { ticks: 1, dotAt: 1, noLoop: true });
    },
    half: function (g, a) {
      var x = g.W / 2;
      var d = 'M' + x + ' ' + g.y + ' L' + (g.W + 40) + ' ' + g.y;
      if (a) {
        drawHorns(g, false);
        later(function () { G.hl.classList.add('ash'); ashes(g, G.hl, 46); }, 400);
        drawOff(G.hr, 3400, 400);
        later(function () { var p = mk('path', { 'class': 'line', d: d }, svg); drawOn(p, 3200); }, 3400);
      } else mk('path', { 'class': 'line', d: d }, svg);
    },
    night: function (g, a) {
      if (a) { drawHorns(g, false); G.horns.classList.add('fadeout'); }
      var grp = mk('g', { 'class': 'stars' + (a ? ' slow' : '') }, svg);
      var n = Math.max(18, Math.round(g.W / 34));
      for (var i = 0; i <= n; i++) {
        var x = 20 + (g.W - 40) * i / n;
        var yy = g.y + Math.sin(i * 1.7) * 3;
        var s = mk('circle', { cx: x.toFixed(1), cy: yy.toFixed(1), r: (i % 3 === 0 ? 1.9 : 1.2) }, grp);
        s.style.animationDelay = (-(i * 0.73) % 5).toFixed(2) + 's';
      }
    },
    shatter: function (g, a) {
      if (!a) return;
      drawHorns(g, false);
      later(function () {
        shards(g, G.hl, 40); shards(g, G.hr, 40);
        G.horns.classList.add('broken');
      }, 300);
    }
  };

  function samples(path, n) {
    var L = path.getTotalLength(), out = [];
    for (var i = 0; i < n; i++) {
      var p = path.getPointAtLength(L * (0.12 + 0.88 * i / n));
      out.push(p);
    }
    return out;
  }
  function ashes(g, path, n) {
    samples(path, n).forEach(function (p, i) {
      var b = document.createElement('i');
      b.className = 'bit ash';
      b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
      layer.appendChild(b);
      later(function () {
        b.style.transform = 'translate(' + ((Math.random() - 0.5) * 40).toFixed(0) + 'px,' + (60 + Math.random() * 140).toFixed(0) + 'px)';
        b.style.opacity = 0;
      }, 200 + i * 45);
    });
  }
  function shards(g, path, n) {
    samples(path, n).forEach(function (p, i) {
      var b = document.createElement('i');
      b.className = 'bit shard';
      b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
      b.style.transform = 'rotate(' + (Math.random() * 180).toFixed(0) + 'deg)';
      layer.appendChild(b);
      var ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 360;
      later(function () {
        b.style.transform = 'translate(' + (Math.cos(ang) * dist).toFixed(0) + 'px,' + (Math.sin(ang) * dist).toFixed(0) + 'px) rotate(' + (Math.random() * 720).toFixed(0) + 'deg)';
        b.classList.add('lit');
        b.style.opacity = 0;
      }, 60 + (i % 12) * 30);
    });
  }

  function render(animate) {
    if (!svg) return;
    clear();
    var g = geom();
    svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
    svg.setAttribute('class', '');
    if (ST.v3 && SHAPES[ST.v3]) SHAPES[ST.v3](g, !!animate);
    else drawRoad(g);
  }

  window.ADV_EFFECTS = {
    init: function (ctx) {
      layer = ctx.layer;
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('id', 'way');
      svg.setAttribute('aria-hidden', 'true');
      layer.appendChild(svg);
      var rt = null;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () { render(false); }, 150);
      });
    },
    onReset: function () {
      ST = { v1: 0, v2: '', v3: '' };
      clear();
    },
    onChapter: function () { if (!svg || !svg.firstChild) render(false); },
    onRestore: function () { render(false); },
    vis: {
      v1: function (value, ctx) {
        ST.v1 = Math.max(0, Math.min(LAST, parseInt(value, 10) || 0));
        if (ST.v3) return render(false);
        var prevX = G.dot ? parseFloat(G.dot.getAttribute('cx')) : null;
        render(false);
        if (!ctx.restoring && !ctx.skipping && G.dot && prevX !== null) {
          var nx = parseFloat(G.dot.getAttribute('cx'));
          G.dot.style.transition = 'none';
          G.dot.style.transform = 'translateX(' + (prevX - nx) + 'px)';
          void G.dot.getBoundingClientRect();
          G.dot.style.transition = 'transform 2.4s ease-in-out';
          G.dot.style.transform = 'translateX(0)';
        }
      },
      v2: function (value) { ST.v2 = value === 'off' ? '' : value; render(false); },
      v3: function (value, ctx) {
        ST.v3 = (!value || value === 'off') ? '' : value;
        render(!ctx.restoring && !ctx.skipping);
      }
    }
  };
})();
