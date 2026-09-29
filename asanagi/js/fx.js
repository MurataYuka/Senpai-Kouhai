/* 画面効果：下辺の波形、奥のレイヤー。本文の文字には一切触れない */
(function () {
  'use strict';

  function fit(cv) {
    var d = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) {
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  // 疑似乱数ノイズ（時間でなめらかに動く）
  function noise(x, t) {
    return Math.sin(x * 0.31 + t * 2.1) * 0.5 + Math.sin(x * 0.083 - t * 1.3) * 0.3 + Math.sin(x * 1.7 + t * 5.3) * 0.2;
  }
  function bump(dx, wd) { return Math.exp(-(dx * dx) / (2 * wd * wd)); }
  // 心拍の形（小さな前波、鋭い山、小さな谷）
  function beat(dx, sc) {
    return 0.18 * bump(dx + 14 * sc, 4 * sc) + 1.0 * bump(dx, 2.2 * sc) - 0.28 * bump(dx - 6 * sc, 3 * sc) + 0.12 * bump(dx - 22 * sc, 6 * sc);
  }

  /* ---------- 波形 ---------- */
  var W = { mode: '0', since: 0 };
  var waveCv = document.getElementById('wave');

  function setWave(m) {
    if (m === W.mode) return;
    W.prev = W.mode; W.mode = m; W.since = performance.now();
  }

  function line(ctx, w, base, fn, color, lw, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath();
    for (var x = 0; x <= w; x += 2) {
      var y = base - fn(x);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawWave(now) {
    var f = fit(waveCv), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    var t = now / 1000, base = h * 0.66, amp = h * 0.5;
    var el = (now - W.since) / 1000;
    var col = '#c9a36a';
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#c9a36a';
    ctx.fillRect(0, base, w, 1);
    ctx.globalAlpha = 1;
    var m = W.mode;
    var nz = function (x) { return noise(x, t) * h * 0.035; };

    if (/^\d+$/.test(m)) {
      var n = Number(m);
      if (!n) { line(ctx, w, base, nz, col, 1, 0.7); return; }
      var sp = w / n, off = (t * 38) % sp;
      line(ctx, w, base, function (x) {
        var k = ((x + off) % sp) - sp / 2;
        return nz(x) + beat(k, 1) * amp * 0.34;
      }, col, 1, 0.8);
      return;
    }
    var big = function (spacing, speed, shiftFn) {
      return function (x) {
        var off = t * speed;
        var i = Math.floor((x + off) / spacing);
        var k = ((x + off) % spacing) - spacing / 2 + (shiftFn ? shiftFn(i, spacing) : 0);
        return beat(k, 2.2) * amp * 0.9;
      };
    };
    switch (m) {
      case 'm': // 一本の大きな脈
        var gm = Math.min(1, el / 2.5);
        line(ctx, w, base, function (x) { return big(w / 3, 60)(x) * gm + nz(x) * (1 - gm); }, col, 1.6, 0.95);
        break;
      case 'k1': // 二本の細い線、揃わないまま
        line(ctx, w, base - h * 0.08, function (x) { var k = ((x + t * 41) % (w / 3.3)) - w / 6.6; return beat(k, 1) * amp * 0.34; }, '#d8c7a4', 1, 0.85);
        line(ctx, w, base + h * 0.08, function (x) { var k = ((x + t * 33) % (w / 2.7)) - w / 5.4; return beat(k, 1) * amp * 0.3; }, '#a9b8c8', 1, 0.85);
        break;
      case 'k2': // 完全に重なる二本
        var f2 = function (x) { var k = ((x + t * 44) % (w / 3)) - w / 6; return beat(k, 1.4) * amp * 0.5; };
        line(ctx, w, base, f2, '#a9b8c8', 2.2, 0.5);
        line(ctx, w, base, f2, '#e8d9b6', 1, 0.95);
        break;
      case 'k3': // ごく小さな一本
        var g3 = Math.max(0.25, 1 - el / 4);
        line(ctx, w, base, function (x) {
          var env = bump(((x + t * 20) % (w / 1.5)) - w / 3, w / 18);
          return (Math.sin(x * 0.9 + t * 7) * 0.6 + Math.sin(x * 0.37 - t * 3) * 0.4) * env * h * 0.07 + nz(x) * 0.2;
        }, col, 1, 0.7 * g3 + 0.2);
        break;
      case 'k4': // 大きな脈、一か所だけずれる
        line(ctx, w, base, big(w / 4, 60, function (i, s) { return ((i % 9) + 9) % 9 === 4 ? s * 0.07 : 0; }), col, 1.6, 0.95);
        break;
      case 'k5': // 一本と、遠くのかすかな一本
        line(ctx, w, base, function (x) { var k = ((x + t * 40) % (w / 3)) - w / 6; return beat(k, 1) * amp * 0.36; }, col, 1, 0.9);
        line(ctx, w, base - h * 0.28, function (x) { var k = ((x + t * 27) % (w / 2.2)) - w / 4.4; return beat(k, 0.8) * amp * 0.1; }, '#a9b8c8', 1, 0.28);
        break;
      case 'k6': // 平らになって、消える
        var ga = Math.max(0, 1 - el / 6), gb = Math.max(0, 1 - Math.max(0, el - 6) / 4);
        line(ctx, w, base, function (x) { var k = ((x + t * 40) % (w / 3)) - w / 6; return beat(k, 1) * amp * 0.36 * ga + nz(x) * ga; }, col, 1, 0.9 * gb);
        break;
      default:
        line(ctx, w, base, nz, col, 1, 0.7);
    }
  }

  /* ---------- 奥のレイヤー（輪） ---------- */
  var R = { mode: 'off', since: 0 };
  var ringCv = document.getElementById('lyB');
  function setRings(m) { if (m === R.mode) return; R.mode = m; R.since = performance.now(); }

  function ringSet(ctx, cx, cy, maxR, t, speed, gap, alpha, wob, color) {
    var cnt = Math.ceil(maxR / gap) + 1;
    for (var i = 0; i < cnt; i++) {
      var r = ((t * speed) + i * gap) % (cnt * gap);
      if (r > maxR) continue;
      var a = alpha * (1 - r / maxR);
      ctx.globalAlpha = a;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (var s = 0; s <= 72; s++) {
        var th = s / 72 * Math.PI * 2;
        var rr = r * (1 + wob * Math.sin(th * 3 + t * 1.7) * Math.sin(t * 2.6));
        var x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
        if (!s) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(now) {
    var f = fit(ringCv), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    if (R.mode === 'off') return;
    var t = now / 1000, el = (now - R.since) / 1000;
    var cx = w / 2, cy = h * 0.34, maxR = Math.hypot(w, h) * 0.75;
    var col = 'rgb(150,190,240)';
    if (R.mode === 'on') ringSet(ctx, cx, cy, maxR, t, 70, 90, Math.min(0.5, el / 6), 0, col);
    else if (R.mode === 'sync') ringSet(ctx, cx, cy, maxR, t, 55, 80, 0.5, 0.06, 'rgb(200,205,220)');
    else if (R.mode === 'split') {
      var g = Math.max(0, 1 - el / 10), d = Math.min(w * 0.3, el * 22);
      ringSet(ctx, cx - d, cy, maxR, t, 64, 95, 0.45 * g, 0, 'rgb(220,205,170)');
      ringSet(ctx, cx + d, cy, maxR, t * 0.73, 48, 120, 0.45 * g, 0, col);
    } else if (R.mode === 'fade') {
      ringSet(ctx, cx, cy, maxR, t, 70, 90, Math.max(0, 0.5 - el / 8), 0, col);
    }
  }

  function loop(now) {
    try { drawWave(now); drawRings(now); } catch (e) { /* 描画の失敗で本編を止めない */ }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.FX = { setWave: setWave, setRings: setRings };
})();
