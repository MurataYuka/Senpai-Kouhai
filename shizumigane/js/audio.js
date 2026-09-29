/* audio.js — 効果音（Web Audio で合成。音声ファイルは使わない） */
(function (root) {
  'use strict';
  var ctx = null, out = null, on = false;

  function ready() {
    if (!on) return false;
    try {
      if (!ctx) {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        var comp = ctx.createDynamicsCompressor();
        out = ctx.createGain();
        out.gain.value = 0.55;
        out.connect(comp);
        comp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch (e) { return false; }
  }

  function noiseBuf(sec) {
    var len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function env(g, t, peak, a, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  // 真鍮の手振り鐘：非整数倍音の減衰和＋打撃のノイズ
  var PART = [[1, 1, 3.2], [2.02, 0.55, 2.2], [2.76, 0.5, 1.8], [3.94, 0.3, 1.2],
              [5.41, 0.22, 0.9], [6.83, 0.12, 0.6], [8.9, 0.07, 0.4]];
  function strike(t, base, amp) {
    PART.forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = base * p[0] * (1 + (Math.random() - 0.5) * 0.004);
      env(g, t, amp * p[1] * 0.22, 0.004, p[2]);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + p[2] + 0.1);
    });
    var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf(0.05);
    f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.4;
    env(ng, t, amp * 0.25, 0.002, 0.04);
    n.connect(f); f.connect(ng); ng.connect(out);
    n.start(t);
  }

  var S = {
    get on() { return on; },
    set: function (v) { on = !!v; if (on) ready(); },
    bell: function (times) {
      if (!ready()) return;
      var t = ctx.currentTime + 0.02, n = times || 3;
      for (var i = 0; i < n; i++) strike(t + i * 0.34 + Math.random() * 0.04, 742, 1 - i * 0.12);
    },
    // 遠くで一度だけ鳴る鐘
    far: function () {
      if (!ready()) return;
      strike(ctx.currentTime + 0.02, 742, 0.25);
    },
    // 水の中で鳴るような、くぐもった一打
    muffled: function () {
      if (!ready()) return;
      var t = ctx.currentTime + 0.02;
      var f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.8;
      g.gain.value = 1.6;
      f.connect(g); g.connect(out);
      var keep = out;
      out = f;
      try { strike(t, 742, 0.9); strike(t + 0.05, 371, 0.35); } finally { out = keep; }
    },
    stamp: function () {
      if (!ready()) return;
      var t = ctx.currentTime + 0.01;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      env(g, t, 0.7, 0.005, 0.2);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
      var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noiseBuf(0.1);
      f.type = 'lowpass'; f.frequency.value = 500;
      env(ng, t, 0.5, 0.002, 0.08);
      n.connect(f); f.connect(ng); ng.connect(out); n.start(t);
    },
    splash: function () {
      if (!ready()) return;
      var t = ctx.currentTime + 0.01;
      var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = noiseBuf(1.4);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(2600, t);
      f.frequency.exponentialRampToValueAtTime(240, t + 1.2);
      env(g, t, 0.6, 0.01, 1.2);
      n.connect(f); f.connect(g); g.connect(out); n.start(t);
    },
    drip: function () {
      if (!ready()) return;
      var t = ctx.currentTime + 0.01, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(600, t + 0.08);
      env(g, t, 0.15, 0.003, 0.12);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
    },
    tick: function () {
      if (!ready()) return;
      var t = ctx.currentTime + 0.005, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 1180;
      env(g, t, 0.06, 0.002, 0.04);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
    }
  };
  root.Snd = S;
})(window);
