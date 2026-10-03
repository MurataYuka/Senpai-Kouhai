/* 演出。名前の対応は docs/secret/notes.md（非公開）。
   本文（#box / #lines）は揺らさない。動くのは #frame（枠）と #back（#fxLayer の canvas）だけ。 */
(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }

  var S = { lv: 1, pov: '', end: '', open: false, hold: 0, spin: 1 };
  var el = {};
  var raf = 0, last = 0, rot = 0, tm = 0;

  /* ---------- 乱数（毎回同じ並びにする） ---------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function pins(n, seed) {
    var r = rng(seed), out = [];
    for (var i = 0; i < n; i++) out.push({ x: r(), a: r() * Math.PI * 2, s: 0.6 + r() * 0.6 });
    return out;
  }
  var PN = pins(340, 7), PO = pins(760, 23);

  /* ---------- canvas の大きさ ---------- */
  function fit(cv) {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) {
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    }
    var g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    return { g: g, w: w, h: h };
  }

  /* ---------- 上辺の円筒 ---------- */
  function drumMode() {
    if (S.pov === 'k' || S.end === 'b') return 'o';
    return 'n';
  }
  function drawCylinder(g, x, y, w, h, old, list, n, r) {
    var gr = g.createLinearGradient(0, y, 0, y + h);
    if (old) {
      gr.addColorStop(0, '#2c2414'); gr.addColorStop(.3, '#7d6434'); gr.addColorStop(.42, '#a68b55');
      gr.addColorStop(.6, '#6c5530'); gr.addColorStop(1, '#221b0f');
    } else {
      gr.addColorStop(0, '#3e3118'); gr.addColorStop(.3, '#b48e48'); gr.addColorStop(.42, '#ecd296');
      gr.addColorStop(.62, '#a9843f'); gr.addColorStop(1, '#33280f');
    }
    g.fillStyle = gr;
    g.beginPath();
    var rr = h / 2;
    g.moveTo(x + rr, y); g.lineTo(x + w - rr, y);
    g.ellipse(x + w - rr, y + rr, rr * .45, rr, 0, -Math.PI / 2, Math.PI / 2);
    g.lineTo(x + rr, y + h);
    g.ellipse(x + rr, y + rr, rr * .45, rr, 0, Math.PI / 2, Math.PI * 1.5);
    g.fill();
    var m = Math.min(n, list.length);
    for (var i = 0; i < m; i++) {
      var p = list[i], a = p.a + r, c = Math.cos(a);
      if (c <= 0.08) continue;
      var px = x + rr + p.x * (w - rr * 2), py = y + h / 2 - Math.sin(a) * (h / 2 - 2);
      g.globalAlpha = 0.35 + 0.65 * c;
      g.fillStyle = old ? '#e6d3a4' : '#fff4d6';
      g.beginPath(); g.arc(px, py, Math.min(h / 16, 1.7) * (0.6 + c * 0.7) * p.s, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }
  function drawDrum() {
    if (!el.drum) return;
    var f = fit(el.drum), g = f.g;
    g.clearRect(0, 0, f.w, f.h);
    var old = drumMode() === 'o';
    var n;
    if (old) n = PO.length;
    else if (S.end === 'c') n = 3;
    else n = Math.round(S.lv * S.lv * 1.4) + 3;
    drawCylinder(g, 0, 0, f.w, f.h, old, old ? PO : PN, n, rot);
  }

  /* ---------- 下辺の櫛 ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  var BENT = 15;
  function buildComb() {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'k4');
    s.setAttribute('viewBox', '0 0 240 20');
    s.setAttribute('preserveAspectRatio', 'none');
    var b = document.createElementNS(NS, 'rect');
    b.setAttribute('class', 'b'); b.setAttribute('x', '0'); b.setAttribute('y', '15'); b.setAttribute('width', '240'); b.setAttribute('height', '5');
    s.appendChild(b);
    el.teeth = [];
    for (var i = 0; i < 24; i++) {
      var x = 3 + i * 10, len = 13 - i * 0.28;
      if (i === BENT) {
        var p1 = document.createElementNS(NS, 'path');
        p1.setAttribute('class', 't x1');
        p1.setAttribute('d', 'M' + x + ' 15 L' + x + ' ' + (15 - len * 0.55) + ' Q' + x + ' ' + (15 - len * 0.8) + ' ' + (x + 2.6) + ' ' + (15 - len) +
          ' L' + (x + 4.4) + ' ' + (15 - len) + ' Q' + (x + 4) + ' ' + (15 - len * 0.8) + ' ' + (x + 4) + ' ' + (15 - len * 0.55) + ' L' + (x + 4) + ' 15 Z');
        s.appendChild(p1);
        var p2 = document.createElementNS(NS, 'rect');
        p2.setAttribute('class', 't x2');
        p2.setAttribute('x', x); p2.setAttribute('y', 15 - len); p2.setAttribute('width', '4'); p2.setAttribute('height', len);
        s.appendChild(p2);
        el.teeth.push(p1);
      } else {
        var t = document.createElementNS(NS, 'rect');
        t.setAttribute('class', 't');
        t.setAttribute('x', x); t.setAttribute('y', 15 - len); t.setAttribute('width', '4'); t.setAttribute('height', len);
        s.appendChild(t);
        el.teeth.push(t);
      }
    }
    return s;
  }

  /* ---------- 奥：窓の雨 ---------- */
  var streaks = [], drops = [];
  function seedRain(w, h) {
    var r = rng(91);
    var n = Math.max(40, Math.round(130 * Math.min(1.4, (w * h) / (1280 * 800))));
    if (reduce) n = Math.round(n / 3);
    streaks = [];
    for (var i = 0; i < n; i++) streaks.push({ x: r() * (w + 200) - 100, y: r() * h, l: 14 + r() * 26, v: 9 + r() * 9, a: .06 + r() * .14 });
    drops = [];
    var m = Math.max(12, Math.round(n / 4));
    for (var j = 0; j < m; j++) drops.push({ x: r() * w, y: r() * h, r: 1.2 + r() * 2.4, v: 0, t: r() * 200, path: [] });
    el.rw = w; el.rh = h;
  }
  function drawRain(dt) {
    if (!el.rain) return;
    var f = fit(el.rain), g = f.g, w = f.w, h = f.h;
    if (el.rw !== w || el.rh !== h) seedRain(w, h);
    var frozen = S.hold > tm || S.end === 'g';
    g.clearRect(0, 0, w, h);
    var k = reduce ? .35 : 1;
    g.lineWidth = 1;
    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      if (!frozen) {
        s.y += s.v * dt * 60 * k; s.x += s.v * .22 * dt * 60 * k;
        if (s.y > h + 30) { s.y = -s.l - Math.random() * 60; s.x = Math.random() * (w + 200) - 160; }
      }
      g.strokeStyle = 'rgba(176,196,216,' + s.a + ')';
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.l * .22, s.y - s.l); g.stroke();
    }
    for (var j = 0; j < drops.length; j++) {
      var d = drops[j];
      if (!frozen) {
        d.t -= dt * 60;
        if (d.t <= 0) { d.v = d.v ? d.v : .3 + Math.random() * 1.6; }
        if (d.v) {
          d.y += d.v * dt * 60 * k * .6;
          d.path.push([d.x, d.y]); if (d.path.length > 26) d.path.shift();
          if (Math.random() < .015) { d.v = 0; d.t = 30 + Math.random() * 240; }
        }
        if (d.y > h + 10) { d.y = -10; d.x = Math.random() * w; d.path = []; d.v = 0; d.t = Math.random() * 200; }
      }
      if (d.path.length > 1) {
        g.strokeStyle = 'rgba(190,206,222,.07)'; g.lineWidth = d.r * .9;
        g.beginPath(); g.moveTo(d.path[0][0], d.path[0][1]);
        for (var q = 1; q < d.path.length; q++) g.lineTo(d.path[q][0], d.path[q][1]);
        g.stroke(); g.lineWidth = 1;
      }
      var rg = g.createRadialGradient(d.x - d.r * .3, d.y - d.r * .3, 0, d.x, d.y, d.r);
      rg.addColorStop(0, 'rgba(235,242,250,.45)'); rg.addColorStop(1, 'rgba(150,170,190,.06)');
      g.fillStyle = rg; g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
    }
    el.rain.classList.toggle('z', S.hold > tm);
  }

  /* ---------- 奥：開いた背中（@vis open） ---------- */
  function gear(g, cx, cy, r, n, a, col) {
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.fillStyle = col; g.beginPath();
    for (var i = 0; i < n; i++) {
      var a0 = i / n * Math.PI * 2, a1 = (i + .5) / n * Math.PI * 2;
      g.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      g.lineTo(Math.cos(a0 + .08) * (r + r * .14), Math.sin(a0 + .08) * (r + r * .14));
      g.lineTo(Math.cos(a1 - .08) * (r + r * .14), Math.sin(a1 - .08) * (r + r * .14));
      g.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath(); g.arc(0, 0, r * .55, 0, Math.PI * 2); g.fill();
    g.strokeStyle = col; g.lineWidth = r * .1;
    for (var k = 0; k < 5; k++) { var b = k / 5 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(b) * r * .55, Math.sin(b) * r * .55); g.stroke(); }
    g.fillStyle = col; g.beginPath(); g.arc(0, 0, r * .14, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function spring(g, cx, cy, r, a) {
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.strokeStyle = '#b8954e'; g.lineWidth = Math.max(1.5, r * .045);
    g.beginPath();
    for (var t = 0; t < Math.PI * 12; t += .08) {
      var rr = r * (.12 + t / (Math.PI * 12) * .88);
      g.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
    g.stroke();
    g.restore();
  }
  function drawMech() {
    if (!el.mech || !S.open) return;
    var f = fit(el.mech), g = f.g, w = f.w, h = f.h;
    var bg = g.createRadialGradient(w / 2, h * .38, 10, w / 2, h * .45, Math.max(w, h) * .75);
    bg.addColorStop(0, '#2a2112'); bg.addColorStop(1, '#0b0906');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    var u = Math.min(w, h);
    // 歯車とぜんまい
    gear(g, w * .84, h * .2, u * .1, 14, tm * .25, '#8c7240');
    gear(g, w * .93, h * .36, u * .06, 9, -tm * .42, '#a2844a');
    gear(g, w * .1, h * .16, u * .07, 11, -tm * .3, '#7e6638');
    spring(g, w * .14, h * .4, u * .13, tm * .06);
    // 円筒
    var dw = w * .62, dh = Math.max(26, h * .1), dx = (w - dw) / 2, dy = h * .12;
    drawCylinder(g, dx, dy, dw, dh, false, PO, PO.length, tm * .5);
    // 櫛
    var cw = dw * .86, cx0 = (w - cw) / 2, cy = dy + dh + h * .03, tl = h * .17;
    g.fillStyle = '#7a6236'; g.fillRect(cx0 - 6, cy + tl, cw + 12, h * .025);
    var lit = Math.floor(tm * 4) % 24;
    for (var i = 0; i < 24; i++) {
      var tx = cx0 + i * (cw / 24) + cw / 96, tw = cw / 48, len = tl * (1 - i * .012);
      var on = i === lit || i === (lit + 23) % 24;
      var col = on ? '#ffe7a6' : '#b8964f';
      g.save();
      if (i === BENT) {
        g.shadowColor = 'rgba(232,120,104,.95)'; g.shadowBlur = 16 + Math.sin(tm * 3) * 6;
        col = '#e98a74';
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(tx, cy + tl); g.lineTo(tx, cy + tl - len * .55);
        g.quadraticCurveTo(tx, cy + tl - len * .82, tx + tw * .9, cy + tl - len);
        g.lineTo(tx + tw * 1.6, cy + tl - len);
        g.quadraticCurveTo(tx + tw, cy + tl - len * .82, tx + tw, cy + tl - len * .55);
        g.lineTo(tx + tw, cy + tl); g.closePath(); g.fill();
      } else {
        if (on) { g.shadowColor = 'rgba(255,226,150,.9)'; g.shadowBlur = 18; }
        g.fillStyle = col; g.fillRect(tx, cy + tl - len, tw, len);
      }
      g.restore();
    }
  }

  /* ---------- 回す ---------- */
  function frame(t) {
    raf = 0;
    var now = t / 1000, dt = last ? Math.min(.1, now - last) : 0;
    last = now; tm = now;
    var sp = .35;
    if (S.end === 'd') sp = 0;
    else if (S.end === 'g') sp = 1.4;
    else if (S.end === 'f') { S.spin = Math.max(0, S.spin - dt * .02); sp = .35 * S.spin; }
    if (reduce) sp *= .3;
    rot += sp * dt;
    drawDrum();
    drawRain(dt);
    drawMech();
    loop();
  }
  function loop() {
    if (raf) return;
    raf = requestAnimationFrame(function (t) {
      // 30 コマ程度に間引く
      if (last && t / 1000 - last < 1 / 32) { raf = 0; loop(); return; }
      frame(t);
    });
  }

  /* ---------- 背中の板 ---------- */
  function doors(play) {
    if (!el.d1) return;
    [el.d1, el.d2].forEach(function (d) { d.classList.remove('v', 'g'); });
    if (!play) return;
    el.d1.classList.add('v'); el.d2.classList.add('v');
    void el.d1.offsetWidth;
    setTimeout(function () { el.d1.classList.add('g'); el.d2.classList.add('g'); }, 500);
    setTimeout(function () { el.d1.classList.remove('v', 'g'); el.d2.classList.remove('v', 'g'); }, 4200);
  }

  function mk(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    parent.appendChild(e);
    return e;
  }

  /* ---------- 「記録」を「帳面」と呼ぶ ---------- */
  function relabel() {
    document.querySelectorAll('.needRecords').forEach(function (b) { b.textContent = '帳面'; });
    var pt = document.getElementById('ptitle');
    if (!pt || typeof MutationObserver === 'undefined') return;
    var fix = function () {
      if (/^記録/.test(pt.textContent)) pt.textContent = pt.textContent.replace(/^記録/, '帳面');
    };
    new MutationObserver(fix).observe(pt, { childList: true, characterData: true, subtree: true });
  }

  function resetAll() {
    S.lv = 1; S.pov = ''; S.end = ''; S.open = false; S.hold = 0; S.spin = 1;
    doors(false);
    if (el.rain) el.rain.classList.remove('z');
  }

  window.ADV_EFFECTS = {

    init: function (ctx) {
      var fr = ctx.frame;
      mk('i', 'k1', fr); mk('i', 'k2', fr);
      el.drum = mk('canvas', 'k3', fr);
      el.comb = buildComb(); fr.appendChild(el.comb);
      el.rain = mk('canvas', 'w1', ctx.layer);
      el.mech = mk('canvas', 'w2', ctx.layer);
      el.d1 = mk('div', 'd1', ctx.layer);
      el.d2 = mk('div', 'd2', ctx.layer);
      relabel();
      loop();
    },

    onReset: function (ctx) { resetAll(); },

    onChapter: function (file, ctx) {
      if (ctx.debug) console.log('[kadv15] ' + file);
    },

    vis: {
      drum: function (v, ctx) { var n = parseInt(v, 10); S.lv = isNaN(n) ? 1 : Math.max(1, Math.min(15, n)); },
      pov: function (v, ctx) { S.pov = (v && v !== 'off') ? v : ''; },
      open: function (v, ctx) {
        var on = !!(v && v !== 'off');
        var was = S.open;
        S.open = on;
        if (on && !was) doors(!ctx.restoring && !ctx.skipping && !reduce);
        if (!on) doors(false);
      },
      end: function (v, ctx) {
        S.end = (v && v !== 'off') ? v : '';
        S.spin = 1;
      }
    },

    fx: {
      // 雨脚を一瞬止める（引数：ミリ秒）
      z1: function (arg, ctx) {
        var ms = parseInt(arg, 10) || 1600;
        S.hold = tm + ms / 1000;
      }
    }
  };
})();
