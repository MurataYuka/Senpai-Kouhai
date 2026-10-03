/* 作品の演出。枠（#frame）の飾り、背景（#bg）、奥のレイヤー（#fxLayer）の演出。
   本文（#box / #lines）には触れない。名前はすべて記号（対応表は非公開メモ）。 */
(function () {
  'use strict';

  var BEADS = 15;
  var LIGHTS = 7;

  var beads = [], rings = [], neck = [], orbit = [], built = false, timers = [];
  var finaleUntil = 0, pending = null;

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; if (pending) { clearTimeout(pending); pending = null; } }

  // 粒の並び：中央の石から外へ、左右交互
  function beadOffset(i) {
    var k = Math.floor(i / 2) + 1;
    return (i % 2 ? 1 : -1) * (6 + k * 22);
  }

  /* ---------- 組み立て ---------- */

  function build(ctx) {
    if (built) return;
    built = true;
    var frame = ctx.frame, layer = ctx.layer;

    // 奥：景色（@vis v4 で切り替え）
    var sc = el('div', 'q5', layer);
    el('div', 'q5a', sc);   // 空・遠景
    el('div', 'q5b', sc);   // 灯り
    el('div', 'q5c', sc);   // 水面・足元
    el('div', 'q5d', sc);   // 雨
    el('div', 'q6', layer); // 回る赤い灯り

    // 奥：冠の輪（第十五章）
    var rg = el('div', 'q9', layer);
    var rgi = el('div', 'q9r', rg);
    for (var r = 0; r < BEADS; r++) {
      var rb = el('i', '', rgi);
      var a = (r / BEADS) * 360;
      rb.style.setProperty('--qa', a.toFixed(1) + 'deg');
      rb.style.setProperty('--qd', (r * 0.06).toFixed(2) + 's');
      rings.push(rb);
    }
    el('b', 'q9s', rgi);

    // 奥：水（ed07）と紙吹雪（ed08）
    el('div', 'qW', layer);
    var cf = el('div', 'qC', layer);
    for (var c = 0; c < 36; c++) {
      var ci = el('i', '', cf);
      ci.style.left = ((c * 37) % 100) + '%';
      ci.style.animationDelay = ((c * 0.41) % 4.8).toFixed(2) + 's';
      ci.style.animationDuration = (4.2 + (c % 5) * 0.6).toFixed(1) + 's';
      ci.style.setProperty('--qh', String((c * 67) % 360));
    }

    // 枠：上辺の鎖と石と粒
    var ch = el('div', 'q1', frame);
    el('div', 'q1c', ch);
    var bw = el('div', 'q1b', ch);
    for (var i = 0; i < BEADS; i++) {
      var b = el('i', '', bw);
      b.style.left = 'calc(50% + ' + beadOffset(i) + 'px)';
      b.style.setProperty('--qf', (i * 0.09).toFixed(2) + 's');
      beads.push(b);
    }
    el('b', 'q1s', ch);

    // 枠：下辺のボンネットの縁と流れる灯り
    var bn = el('div', 'q2', frame);
    el('div', 'q2e', bn);
    var lw = el('div', 'q2l', bn);
    for (var l = 0; l < LIGHTS; l++) {
      var li = el('i', '', lw);
      li.style.animationDelay = (-(l * 0.52)).toFixed(2) + 's';
      li.style.setProperty('--qs', l % 2 ? '1' : '-1');
    }

    // 枠：首飾り（テキストボックスの上辺）
    var nk = el('div', 'q3', frame);
    el('div', 'q3c', nk);
    for (var n = 0; n < BEADS; n++) {
      var ni = el('i', '', nk);
      var t = (n + 0.5) / BEADS;                  // 0〜1
      var sag = 4 * t * (1 - t);                  // 真ん中が一番下がる
      ni.style.left = (t * 100).toFixed(2) + '%';
      ni.style.setProperty('--qy', (sag * 14).toFixed(1) + 'px');
      ni.style.setProperty('--qd', (n * 0.08).toFixed(2) + 's');
      ni.style.setProperty('--qo', (-(n * 0.9)).toFixed(2) + 's');
      neck.push(ni);
    }
    el('b', 'q3s', nk);

    // 枠：一周する鎖（ED3）
    var ob = el('div', 'q4', frame);
    for (var o = 0; o < BEADS; o++) {
      var oi = el('i', '', ob);
      oi.style.animationDelay = (-(o * 1.2)).toFixed(2) + 's';
      orbit.push(oi);
    }
  }

  /* ---------- 状態 ---------- */

  function setBeads(v, ctx) {
    var n = parseInt(v, 10);
    if (isNaN(n)) n = 0;
    beads.forEach(function (b, i) {
      var was = b.classList.contains('on');
      b.classList.toggle('on', i < n);
      if (!was && i < n && i === n - 1 && !ctx.restoring && !ctx.skipping) {
        b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      }
    });
    neck.forEach(function (b, i) { b.classList.toggle('on', i < n); });
  }

  function setNeck(value, ctx) {
    var wait = finaleUntil - Date.now();
    if (pending) { clearTimeout(pending); pending = null; }
    if (wait > 0 && !ctx.restoring && value && value !== 'off') {
      pending = setTimeout(function () { pending = null; document.body.setAttribute('data-q-n', value); }, wait);
      return;
    }
    if (value && value !== 'off') document.body.setAttribute('data-q-n', value);
    else document.body.removeAttribute('data-q-n');
  }

  /* ---------- 記録のメニュー名 ---------- */
  var REC = '運行日誌';
  function renameRecords() {
    document.querySelectorAll('[data-act="records"]').forEach(function (b) { b.textContent = REC; });
    var t = document.getElementById('ptitle');
    if (!t || !window.MutationObserver) return;
    var fix = function () {
      var s = t.textContent;
      if (s.indexOf('記録') === 0) t.textContent = REC + s.slice(2);
    };
    new MutationObserver(fix).observe(t, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- 一時の演出 ---------- */

  // 照合：石が澄んで光る
  function chime(ctx) {
    var f = ctx.frame;
    f.classList.remove('q-ch'); void f.offsetWidth; f.classList.add('q-ch');
    later(function () { f.classList.remove('q-ch'); }, 1500);
  }

  // 機関が歌う：ボンネットの縁に瑠璃の光が走る
  function hum(ctx) {
    var f = ctx.frame;
    f.classList.remove('q-hm'); void f.offsetWidth; f.classList.add('q-hm');
    later(function () { f.classList.remove('q-hm'); }, 3200);
  }

  // 粒がほどけて奥で輪になり、石が抜けて崩れる
  function finale(ctx) {
    var f = ctx.frame, lay = ctx.layer;
    finaleUntil = Date.now() + 6200;
    f.classList.add('q-up');
    lay.classList.remove('q-f1', 'q-f2', 'q-f3');
    void lay.offsetWidth;
    lay.classList.add('q-f1');
    later(function () { lay.classList.add('q-f2'); }, 3600);
    later(function () { lay.classList.add('q-f3'); }, 4600);
    later(function () { lay.classList.remove('q-f1', 'q-f2', 'q-f3'); }, 6400);
  }

  window.ADV_EFFECTS = {
    init: function (ctx) { build(ctx); renameRecords(); },
    onReset: function (ctx) {
      clearTimers();
      finaleUntil = 0;
      ctx.frame.classList.remove('q-ch', 'q-hm', 'q-up');
      ctx.layer.classList.remove('q-f1', 'q-f2', 'q-f3');
      document.body.removeAttribute('data-q-n');
      setBeads(0, ctx);
    },
    vis: {
      v2: function (value, ctx) { setBeads(value, ctx); },
      v5: function (value, ctx) {
        ctx.frame.classList.toggle('q-up', !!value && value !== 'off' && value !== 'f');
        setNeck(value, ctx);
      }
    },
    fx: {
      f1: function (arg, ctx) { finale(ctx); },
      f2: function (arg, ctx) { chime(ctx); },
      f3: function (arg, ctx) { hum(ctx); }
    }
  };
})();
