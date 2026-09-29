/* 音の制御。画面から独立させて、点検ツールでも同じ判定を使えるようにしてある。
   create(makeAudio, opt) … makeAudio(src) は Audio と同じ形のものを返す関数。 */
(function (root) {
  'use strict';

  var TRACKS = { '1': 'assets/audio/bgm01.m4a' };
  var FADE_MS = 700;

  function create(makeAudio, opt) {
    opt = opt || {};
    var vol = typeof opt.vol === 'number' ? opt.vol : 0.5;
    var mute = !!opt.mute;
    var setTimer = opt.setInterval || (typeof setInterval !== 'undefined' ? setInterval : null);
    var clearTimer = opt.clearInterval || (typeof clearInterval !== 'undefined' ? clearInterval : null);

    var audio = null;   // 今の音源
    var cur = null;     // 鳴らしたい曲の番号（止めたら null）
    var pending = false;// 自動再生の制限で待っている
    var broken = false; // 音源が読めない（無音で続ける）
    var fading = null;

    function apply() {
      if (!audio) return;
      audio.muted = mute;
      if (!fading) audio.volume = vol;
    }
    function cancelFade() {
      if (fading && clearTimer) clearTimer(fading);
      fading = null;
    }
    function tryPlay() {
      if (!audio || broken || !cur) return;
      var p;
      try { p = audio.play(); } catch (e) { pending = true; return; }
      if (p && typeof p.then === 'function') {
        p.then(function () { pending = false; }, function (err) {
          // 音源が読めない・形式が合わないときだけ諦める。自動再生の制限や、非表示のタブでの中断などは、次の操作で鳴らし直す
          if (err && err.name === 'NotSupportedError') broken = true;
          else if (!broken) pending = true;
        });
      } else pending = false;
    }

    function play(id) {
      id = String(id);
      if (!TRACKS[id]) return;
      if (cur === id && audio && !audio.paused && !fading) return;   // 鳴っている途中なら続ける
      cancelFade();
      if (!audio || audio.__id !== id) {
        try {
          audio = makeAudio(TRACKS[id]);
        } catch (e) { broken = true; cur = id; return; }
        audio.__id = id;
        audio.loop = true;
        broken = false;
        if (audio.addEventListener) audio.addEventListener('error', function () { broken = true; pending = false; });
      } else {
        try { audio.currentTime = 0; } catch (e) { /* 読み込み前は無視 */ }
      }
      cur = id;
      apply();
      tryPlay();
    }

    function stop(instant) {
      cur = null;
      pending = false;
      if (!audio) return;
      cancelFade();
      if (instant || audio.paused || !setTimer) { try { audio.pause(); } catch (e) {} apply(); return; }
      var start = audio.volume, steps = 10, n = 0;
      fading = setTimer(function () {
        n++;
        audio.volume = Math.max(0, start * (1 - n / steps));
        if (n >= steps) {
          cancelFade();
          try { audio.pause(); audio.currentTime = 0; } catch (e) {}
          apply();
        }
      }, FADE_MS / steps);
    }

    /* 画面の出入りに応じた判定。kind: 'new' | 'load' | 'gallery' | 'title' | 'fin'、id は開くもの。 */
    function onEnter(kind, id) {
      if (kind === 'new' || kind === 'load') { stop(); return; }
      if (kind === 'gallery' && id !== 'ed9') { stop(); return; }
      // 'gallery' で ed9、'title'、'fin' では何もしない（鳴っていれば鳴り続ける）
    }

    function onGesture() { if (pending && cur) tryPlay(); }

    return {
      play: play, stop: stop, onEnter: onEnter, onGesture: onGesture,
      setVolume: function (v) { vol = Math.max(0, Math.min(1, v)); apply(); },
      setMute: function (m) { mute = !!m; apply(); },
      state: function () {
        return { cur: cur, playing: !!(audio && !audio.paused), pending: pending, broken: broken, vol: vol, mute: mute,
          loop: !!(audio && audio.loop), src: audio ? audio.src : null, fading: !!fading };
      }
    };
  }

  var api = { create: create, TRACKS: TRACKS };
  root.YoiSnd = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
