/* 演出。名前の対応は docs/secret/notes.md。
   本文（#box / #lines）は揺らさない。動くものは #fxLayer（canvas）と #frame だけ。 */
(function () {
  var cv = null, g = null, parts = [], mode = 'off', raf = 0, W = 0, H = 0, DPR = 1;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }

  var COLORS = {
    p: ['#b3122a', '#c41e3a', '#9e0f24', '#d0344c', '#b3122a', '#c41e3a', '#e8c547', '#f4efe6'],
    d: ['#8c8478', '#a39b8e', '#6f6a61', '#b8b0a2']
  };

  function size() {
    if (!cv) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawn(top) {
    var m = mode === 'x' ? 'p' : mode;
    var c = COLORS[m] || COLORS.p;
    var dust = m === 'd';
    return {
      x: Math.random() * W,
      y: top ? -20 - Math.random() * 40 : Math.random() * H,
      r: dust ? 0.8 + Math.random() * 1.6 : 4 + Math.random() * 5,
      vy: dust ? 0.05 + Math.random() * 0.12 : 0.35 + Math.random() * 0.55,
      vx: dust ? (Math.random() - 0.5) * 0.15 : (Math.random() - 0.5) * 0.4,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.03,
      sw: Math.random() * Math.PI * 2,
      c: c[(Math.random() * c.length) | 0],
      o: dust ? 0.25 + Math.random() * 0.35 : 0.55 + Math.random() * 0.35
    };
  }

  function count() {
    var base = mode === 'x' ? 90 : mode === 'd' ? 60 : 34;
    if (reduce) base = Math.round(base / 3);
    return Math.max(8, Math.round(base * Math.min(1, (W * H) / (1280 * 800) + 0.25)));
  }

  function draw() {
    raf = 0;
    if (!g || mode === 'off') return;
    g.clearRect(0, 0, W, H);
    var dust = mode === 'd';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.sw += 0.01;
      p.x += p.vx + Math.sin(p.sw) * (dust ? 0.05 : 0.3);
      p.y += p.vy * (reduce ? 0.5 : 1);
      p.a += p.va;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) parts[i] = spawn(true);
      g.save();
      g.globalAlpha = p.o;
      g.translate(p.x, p.y);
      g.rotate(p.a);
      g.fillStyle = p.c;
      g.beginPath();
      if (dust) g.arc(0, 0, p.r, 0, Math.PI * 2);
      else {
        g.moveTo(0, -p.r);
        g.bezierCurveTo(p.r * 0.9, -p.r * 0.6, p.r * 0.7, p.r * 0.7, 0, p.r);
        g.bezierCurveTo(-p.r * 0.7, p.r * 0.7, -p.r * 0.9, -p.r * 0.6, 0, -p.r);
      }
      g.fill();
      g.restore();
    }
    raf = requestAnimationFrame(draw);
  }

  function setMode(m) {
    m = m || 'off';
    if (m === mode && (m === 'off' || raf)) return;
    mode = m;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!g) return;
    g.clearRect(0, 0, W, H);
    if (mode === 'off') { parts = []; return; }
    size();
    parts = [];
    for (var i = 0, n = count(); i < n; i++) parts.push(spawn(false));
    raf = requestAnimationFrame(draw);
  }

  function addEl(parent, cls) {
    var el = document.createElement('i');
    el.className = cls;
    parent.appendChild(el);
    return el;
  }

  // 記録の画面上の名前を「席札」にする（エンジンには手を入れない）
  function renameRecords() {
    document.querySelectorAll('.needRecords').forEach(function (b) { b.textContent = '席札'; });
    var t = document.getElementById('ptitle');
    if (!t || !window.MutationObserver) return;
    var fix = function () {
      if (t.textContent.indexOf('記録') === 0) t.textContent = '席札' + t.textContent.slice(2);
    };
    new MutationObserver(fix).observe(t, { childList: true, characterData: true, subtree: true });
  }

  window.ADV_EFFECTS = {

    init: function (ctx) {
      cv = document.createElement('canvas');
      cv.className = 'fl';
      ctx.layer.appendChild(cv);
      g = cv.getContext('2d');
      size();
      window.addEventListener('resize', function () { size(); if (mode !== 'off') setMode(mode); });
      // 枠の飾り（CSS で見た目を決める）
      var f = ctx.frame;
      addEl(f, 'lc');            // レース
      addEl(f, 'rb rl');         // 左上のリボン
      addEl(f, 'rb rr');         // 右上のリボン
      addEl(f, 'bd');            // 下辺の帯
      addEl(f, 'pv');            // 目線の切り替えの手書き線
      addEl(f, 'sn');            // 染み
      addEl(f, 'tg');            // 付箋の枠
      renameRecords();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
        else if (mode !== 'off' && !raf) raf = requestAnimationFrame(draw);
      });
    },

    onReset: function (ctx) { setMode('off'); },

    onChapter: function (file, ctx) {
      if (ctx.debug) console.log('[kadv14] ' + file);
    },

    onRestore: function (ctx) {
      var v = document.body.getAttribute('data-v-fl');
      setMode(v || 'off');
    },

    onMark: function (id, arg, ctx) { },

    onGameover: function (id, ver, ctx) {
      if (ctx.debug) console.log('[kadv14] ' + id + ' ' + ver);
    },

    onOverScreen: function (id, ver, ctx) { setMode('off'); },

    vis: {
      // 降るもの：p（花びら）／ d（埃）／ x（花びら・多め）／ off
      fl: function (value, ctx) { setMode(value); }
    },

    fx: {}
  };
})();
