// 枠（SVG）と背景の空（canvas）。本文とテキストボックスには触れない。
(function () {
  'use strict';
  const FX = window.FX = {};
  const svg = document.getElementById('fr');
  const bw = document.getElementById('bw');
  const cv = document.getElementById('sk');
  const cx = cv.getContext('2d');
  const C1 = '#d8d2c2';   // 枠の線1
  const C2 = '#9a917d';
  const C3 = '#4d67bb';   // 枠の線2
  const C4 = '#b8423f';   // 枠の線3

  let mode = '0', t0 = now(), n = 0, p4 = 0, a1 = 1;
  let sky = '0', s0 = now();
  let W = 0, H = 0, M = 30;

  function now() { return performance.now() / 1000; }
  function rnd(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  FX.set = function (o) {
    if (o.frm !== undefined && o.frm !== mode) { mode = o.frm; t0 = now(); }
    if (o.n !== undefined) n = o.n;
    if (o.p4 !== undefined) p4 = o.p4;
    if (o.sky !== undefined && o.sky !== sky) { sky = o.sky; s0 = now(); }
    if (o.instant) { a1 = ropeTarget(); t0 = now() - 60; s0 = now() - 120; }
  };

  function ropeTarget() {
    if (mode === '0' || mode === 'e3' || mode === 'e5' || mode === 'e5b') return 1;
    if (mode === 'e6') return 1;
    return 0;
  }

  // 四角の周に沿った点
  function geo() {
    const r = M - 5;
    const x0 = r, y0 = r, x1 = W - r, y1 = H - r;
    const a = x1 - x0, b = y1 - y0;
    const P = 2 * (a + b);
    function at(d) {
      d = ((d % P) + P) % P;
      if (d < a) return [x0 + d, y0, 0, -1];
      d -= a; if (d < b) return [x1, y0 + d, 1, 0];
      d -= b; if (d < a) return [x1 - d, y1, 0, 1];
      d -= a; return [x0, y1 - d, -1, 0];
    }
    return { P, at, x0, y0, x1, y1 };
  }

  function along(g, f, from, to, step) {
    step = step || 6;
    let s = '';
    for (let d = from; d <= to + 0.01; d += step) {
      const p = g.at(d);
      const o = f(d);
      s += (s ? 'L' : 'M') + (p[0] + p[2] * o).toFixed(1) + ' ' + (p[1] + p[3] * o).toFixed(1);
    }
    return s;
  }

  function path(d, col, w, al, extra) {
    return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-opacity="' + al.toFixed(3) + '" stroke-linecap="round" stroke-linejoin="round" ' + (extra || '') + '/>';
  }

  function drawRope(g, t, al, jit) {
    if (al < 0.01) return '';
    let s = '';
    const fr = Math.floor(p4 / 6);
    let mask = '<mask id="mk1" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '"><rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    const fib = [];
    for (let i = 0; i < fr; i++) {
      const d = g.P * rnd(i + 3);
      const p = g.at(d);
      mask += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (3 + rnd(i + 9) * 3).toFixed(1) + '" fill="#000"/>';
      for (let j = 0; j < 3; j++) {
        const ln = 6 + rnd(i * 7 + j) * 9;
        const sd = (j - 1) * 3;
        const q = g.at(d + sd);
        const ox = q[2] * ln + (rnd(i + j * 5) - 0.5) * 8, oy = q[3] * ln + (rnd(i * 3 + j) - 0.5) * 8;
        fib.push('M' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + 'q' + (ox * 0.4 + q[3] * 3).toFixed(1) + ' ' + (oy * 0.4 + q[2] * 3).toFixed(1) + ' ' + ox.toFixed(1) + ' ' + oy.toFixed(1));
      }
    }
    mask += '</mask>';
    s += '<defs>' + mask + '</defs>';
    const j = jit || 0;
    const base = along(g, (d) => j * Math.sin(d / 9 + t * 3) * rnd(Math.floor(d / 40)), 0, g.P, 5);
    const dash = j > 0 ? 'stroke-dasharray="' + Math.max(1, 40 - j * 4).toFixed(1) + ' ' + (j * 3).toFixed(1) + '"' : '';
    s += path(base, C1, 6, al, 'mask="url(#mk1)" ' + dash);
    s += path(along(g, (d) => 1.8 * Math.sin(d / 3.2) + j * Math.sin(d / 7 + t * 4), 0, g.P, 2), C2, 1.3, 0.75 * al, 'mask="url(#mk1)" ' + dash);
    s += path(along(g, (d) => 1.8 * Math.sin(d / 3.2 + Math.PI) - j * Math.sin(d / 8 + t * 5), 0, g.P, 2), C2, 1.3, 0.75 * al, 'mask="url(#mk1)" ' + dash);
    if (fib.length) s += path(fib.join(''), C1, 1, 0.8 * al);
    return s;
  }

  function threads(g, t, off, al, col, cnt) {
    let s = '';
    for (let i = 0; i < cnt; i++) s += path(along(g, (d) => off(i, d), 0, g.P, 6), col || C3, 1.1, typeof al === 'function' ? al(i) : al);
    return s;
  }

  function knot(cxp, cyp, r, t, cols) {
    // 小さな結び目（三つ葉の形）
    let s = '';
    cols.forEach((c, k) => {
      let d = '';
      for (let i = 0; i <= 160; i++) {
        const u = (i / 160) * Math.PI * 2;
        const x = Math.sin(u) + 2 * Math.sin(2 * u), y = Math.cos(u) - 2 * Math.cos(2 * u);
        const o = (k ? 1 : -1) * 0.12 * Math.sin(u * 9 + t * 0.6);
        d += (i ? 'L' : 'M') + (cxp + (x + o) * r).toFixed(1) + ' ' + (cyp + (y + o) * r).toFixed(1);
      }
      s += path(d, c, 1.6, 0.95);
    });
    return s;
  }

  function frame() {
    W = svg.clientWidth; H = svg.clientHeight;
    if (!W || !H) return;
    M = (W - bw.clientWidth) / 2;
    const g = geo();
    const t = now() - t0;
    const T = now();
    a1 += (ropeTarget() - a1) * 0.02;
    let s = '';
    switch (mode) {
      case '0':
        s += drawRope(g, T, a1, 0);
        s += threads(g, T, (i, d) => (i % 2 ? 1 : -1) * (1 + (i % 3) * 0.6) + 0.8 * Math.sin(d / (11 + i) + i * 1.7), 0.5, C3, n);
        break;
      case '1':
        s += drawRope(g, T, a1, 0);
        s += threads(g, T, (i, d) => (i % 2 ? 1 : -1) * (1 + (i % 3) * 0.6) + 2.4 * Math.sin(T * 0.35 + i * 1.3 + d / 90) + 0.8 * Math.sin(d / (11 + i)), 0.85, C3, n);
        break;
      case '2': {
        const k = ease(t / 8);
        s += drawRope(g, T, a1, 0);
        s += threads(g, T, (i, d) => (1 - k) * (2.4 * Math.sin(T * 0.35 + i * 1.3 + d / 90)) + k * (11 * Math.sin(T * 0.22 + i * 2.1) + 7 * Math.sin(d / 70 + T * 0.5 + i) + 3 * Math.sin(d / 23 - T * 0.8 + i * 0.7)), 0.9, C3, n);
        break;
      }
      case 'e1': {
        const al = ease(t / 4);
        const y = g.y1;
        let d1 = '', d2 = '';
        for (let x = g.x0 + 50; x <= g.x1 - 50; x += 6) {
          d1 += (d1 ? 'L' : 'M') + x.toFixed(1) + ' ' + (y - 4 + 1.6 * Math.sin(x / 50 + T * 0.3)).toFixed(1);
          d2 += (d2 ? 'L' : 'M') + x.toFixed(1) + ' ' + (y + 4 + 1.6 * Math.sin(x / 47 + 1 + T * 0.33)).toFixed(1);
        }
        s += path(d1, C3, 1.3, 0.9 * al) + path(d2, C4, 1.3, 0.9 * al);
        break;
      }
      case 'e2': {
        const al = ease(t / 4);
        const kx = g.x0 + 8, ky = g.y1 - 8;
        let d1 = 'M' + (g.x1 - 40) + ' ' + g.y1;
        for (let x = g.x1 - 40; x >= kx + 10; x -= 6) d1 += 'L' + x.toFixed(1) + ' ' + (g.y1 + 1.2 * Math.sin(x / 40 + T * 0.3)).toFixed(1);
        let d2 = 'M' + g.x0 + ' ' + (g.y0 + 40);
        for (let y = g.y0 + 40; y <= ky - 10; y += 6) d2 += 'L' + (g.x0 + 1.2 * Math.sin(y / 40 + T * 0.3)).toFixed(1) + ' ' + y.toFixed(1);
        s += path(d1, C3, 1.3, 0.9 * al) + path(d2, C4, 1.3, 0.9 * al);
        s += knot(kx, ky, 5, T, [C3, C4]).replace(/stroke-opacity="[\d.]+"/g, 'stroke-opacity="' + (0.95 * al).toFixed(2) + '"');
        break;
      }
      case 'e3':
        s += drawRope(g, T, a1, 0);
        s += threads(g, T, (i, d) => 2.2 * Math.sin(d / 5 + i * Math.PI), (i) => 0.95 * a1, null, 0);
        s += path(along(g, (d) => 2.2 * Math.sin(d / 5), 0, g.P, 2), C3, 1.3, 0.95 * a1);
        s += path(along(g, (d) => 2.2 * Math.sin(d / 5 + Math.PI), 0, g.P, 2), C4, 1.3, 0.95 * a1);
        break;
      case 'e4': {
        const al = ease(t / 4);
        s += path(along(g, (d) => 1.5 + 2 * Math.sin(T * 0.3 + d / 60), g.P / 2 - (g.y1 - g.y0) * 0.35, g.P / 2 + 150, 5), C3, 1.2, 0.9 * al);
        break;
      }
      case 'e5':
      case 'e5b': {
        const k = mode === 'e5b' ? ease(t / 6) : 0;
        s += drawRope(g, T, a1, 0);
        s += path(along(g, (d) => 2.2 * Math.sin(d / 5 + Math.PI), 0, g.P, 2), C4, 1.3, 0.95 * a1);
        s += path(along(g, (d) => (1 - k) * (9 + 1.5 * Math.sin(T * 0.4 + d / 80)) + k * 2.2 * Math.sin(d / 5), 0, g.P, 2), C3, 1.3, 0.95);
        break;
      }
      case 'e6': {
        const j = clamp(t / 1.2, 0, 14);
        const al = 1 - ease((t - 4) / 7);
        s += drawRope(g, T, al, j);
        s += threads(g, T, (i, d) => j * 2.5 * Math.sin(d / (13 + i) + T * (0.8 + i * 0.1)) * rnd(i + Math.floor(d / 60)), al, C3, 11);
        s += path(along(g, (d) => j * 2 * Math.sin(d / 17 + T), 0, g.P, 6), C4, 1.1, al);
        break;
      }
      case 'e7': {
        for (let i = 0; i < 11; i++) {
          const st = 2 + i * 1.6;
          const u = Math.max(0, t - st);
          const lift = Math.pow(u, 1.5) * 38;
          const al = 0.9 * (1 - ease((u - 5) / 3));
          if (al <= 0.01) continue;
          let d = '';
          for (let q = 0; q <= g.P; q += 6) {
            const p = g.at(q);
            const o = 2.4 * Math.sin(T * 0.35 + i * 1.3 + q / 90);
            const x = p[0] + p[2] * o;
            let y = p[1] + p[3] * o;
            // 下の辺から順に上へ寄っていく
            y = y + (g.y0 - y) * ease(u / 3) - lift;
            d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
          }
          s += path(d, C3, 1.1, al);
        }
        break;
      }
      default:
        break;
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = s;
  }

  // ---- 空 ----
  const stars = [];
  for (let i = 0; i < 260; i++) stars.push({ x: rnd(i * 2 + 1), y: rnd(i * 2 + 2), r: 0.4 + rnd(i + 500) * 1.2, ph: rnd(i + 900) * 6.28, sp: 0.5 + rnd(i + 1300) * 1.5 });

  function tre(u) { return [Math.sin(u) + 2 * Math.sin(2 * u), Math.cos(u) - 2 * Math.cos(2 * u)]; }

  function skyDraw() {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    if (sky === '0') return;
    const t = now() - s0, T = now();
    const sc = Math.min(w, h) / 7.2;
    const ccx = w / 2, ccy = h / 2 + sc * 0.3;
    const dim = sky === '3' ? 0.45 : 1;
    stars.forEach((s, i) => {
      let x = s.x * w, y = s.y * h;
      if (sky === '5') {
        const k = 1 + Math.pow(Math.max(0, t - 1), 1.6) * 0.03;
        x = w / 2 + (x - w / 2) * k; y = h / 2 + (y - h / 2) * k;
      }
      if (sky === '2' && i < 180) {
        const p = tre((i / 180) * Math.PI * 2);
        const k = ease((t - 4 - (i % 60) * 0.35 - Math.floor(i / 60) * 6) / 22);
        x += (ccx + p[0] * sc - x) * k;
        y += (ccy + p[1] * sc - y) * k;
      }
      const al = (0.35 + 0.5 * (0.5 + 0.5 * Math.sin(T * s.sp + s.ph))) * dim * Math.min(1, t / 3) * (sky === '5' ? Math.max(0, 1 - t / 60) : 1);
      const lit = sky === '2' && i < 180 ? ease((t - 4 - (i % 60) * 0.35 - Math.floor(i / 60) * 6) / 22) : 0;
      cx.fillStyle = 'rgba(236,228,208,' + Math.min(1, al + lit * 0.4).toFixed(3) + ')';
      cx.beginPath(); cx.arc(x, y, s.r * (1 + lit * 0.8), 0, 6.283); cx.fill();
    });
    if (sky === '3') {
      const r = Math.min(w, h) / 34;
      const al = ease(t / 5);
      strand(ccx, h / 2, r, 1, 0, 1, C3, al, T);
      strand(ccx, h / 2, r, 1, Math.PI, 1, C4, al, T);
    }
    if (sky === '4') {
      const f = ease(t / 40);
      strand(ccx, ccy, sc, 3, 0, f, C3, 0.9, T);
      strand(ccx, ccy, sc, 3, Math.PI, f, C4, 0.9, T);
    }
  }

  function strand(x0, y0, r, off, ph, frac, col, al, T) {
    cx.strokeStyle = col; cx.globalAlpha = al; cx.lineWidth = 1.8; cx.lineCap = 'round';
    cx.beginPath();
    const N = 480, end = Math.floor(N * frac);
    for (let i = 0; i <= end; i++) {
      const u = (i / N) * Math.PI * 2;
      const p = tre(u);
      const o = off * Math.sin(u * 40 + ph + T * 0.4) / r;
      const x = x0 + (p[0] + o) * r, y = y0 + (p[1] + o) * r;
      if (i) cx.lineTo(x, y); else cx.moveTo(x, y);
    }
    cx.stroke();
    cx.globalAlpha = 1;
  }

  let last = 0;
  function loop(ts) {
    if (ts - last > 33) { last = ts; try { frame(); skyDraw(); } catch (e) { /* 描画の失敗は進行に影響させない */ } }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  FX.fx = function (name) {
    const bl = document.getElementById('bl');
    const fl = document.getElementById('fl');
    if (name === 'q') {
      [bl, cv, svg].forEach((el) => { el.classList.remove('shk'); void el.offsetWidth; el.classList.add('shk'); });
    } else if (name === 'd') { fl.style.background = '#000'; fl.style.opacity = '0.75'; }
    else if (name === 'u') { fl.style.opacity = '0'; }
    else if (name === 'w' || name === 'r') {
      fl.style.transition = 'none'; fl.style.background = name === 'w' ? '#d9d3c4' : '#6a1414'; fl.style.opacity = '0.5';
      void fl.offsetWidth; fl.style.transition = ''; fl.style.opacity = '0';
    }
  };
})();
