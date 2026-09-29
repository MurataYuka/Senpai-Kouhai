// 音の鳴らし方の自動テスト。node tools/test-snd.js
const { C, loadData } = require('./lib');
const S = require('../js/snd.js');
const D = loadData();
let fail = 0;
const check = (ok, name) => { if (!ok) fail++; console.log('  ' + (ok ? 'OK' : 'NG') + '  ' + name); };

// ---------- 偽の音源とタイマー ----------
function makeEnv(mode) {
  const made = [];
  let timers = [];
  function FakeAudio(src) {
    this.src = src; this.paused = true; this.currentTime = 0; this.volume = 1; this.muted = false; this.loop = false;
    this.plays = 0; this.listeners = {};
    made.push(this);
  }
  FakeAudio.prototype.addEventListener = function (ev, fn) { this.listeners[ev] = fn; };
  FakeAudio.prototype.play = function () {
    if (env.mode === 'block') return Promise.reject({ name: 'NotAllowedError' });
    if (env.mode === 'abort') return Promise.reject({ name: 'AbortError' });
    if (env.mode === 'missing') { if (this.listeners.error) this.listeners.error(); return Promise.reject({ name: 'NotSupportedError' }); }
    this.paused = false; this.plays++; return Promise.resolve();
  };
  FakeAudio.prototype.pause = function () { this.paused = true; };
  const env = {
    mode: mode || 'ok', made,
    setInterval: (fn) => { const t = { fn }; timers.push(t); return t; },
    clearInterval: (t) => { timers = timers.filter(x => x !== t); },
    flush: () => { for (let i = 0; i < 50 && timers.length; i++) timers.slice().forEach(t => t.fn()); },
  };
  env.ctrl = S.create(src => new FakeAudio(src), { vol: 0.5, setInterval: env.setInterval, clearInterval: env.clearInterval });
  return env;
}
const tick = () => new Promise(r => setImmediate(r));

// ed9 を頭から流す（スキップと同じく、表示の待ちなしで進める）。行を表示する瞬間に鳴っているかを記録する。
function runEd9(ctrl) {
  const P = C.compile(D.ed9.src);
  let pc = 0, atLine = null;
  const st = C.newState();
  while (P.ops[pc] && P.ops[pc].t !== 'fin') {
    const op = P.ops[pc];
    if (op.t === 'bgm') { if (op.v === '0') ctrl.stop(); else ctrl.play(op.v); }
    if (op.t === 'text' && op.s.indexOf('宵は、蓄音機の針を戻した。') === 1 && atLine === null) atLine = ctrl.state().cur === '1';
    if (op.t === 'go') { pc = P.labels[op.to]; continue; }
    if (op.t === 'if') { pc = C.evalCond(op.cond, st) ? P.labels[op.to] : pc + 1; continue; }
    pc++;
  }
  return { atLine, reachedFin: !!P.ops[pc] };
}

(async () => {
  console.log('■ 本文データ');
  const all = [];
  for (const id of C.ORDER.concat(C.ENDS)) {
    C.compile(D[id].src).ops.forEach((op, i, ops) => { if (op.t === 'bgm') all.push({ id, i, op, next: ops[i + 1] }); });
  }
  check(all.length === 1 && all[0].id === 'ed9', 'BGM 開始の命令は ed9 の一か所だけ');
  check(all[0] && all[0].op.v === '1' && all[0].next.t === 'text' && all[0].next.s === '　宵は、蓄音機の針を戻した。盤が、また回り出した。聞いたことのない、甘ったるい、西洋の歌だった。',
    '命令の直後が「宵は、蓄音機の針を戻した。」の一文（=その一文の表示と同時に鳴り始める）');
  const firstIdx = C.compile(D.ed9.src).ops.findIndex(op => op.t === 'text' && op.s.indexOf('宵は、蓄音機の針を戻した。') === 1);
  check(firstIdx === all[0].i + 1, 'その一文は ed9 で最初に針を戻す一文');

  console.log('\n■ 1・6 鳴り始め（スキップで通過しても鳴る）');
  let e = makeEnv();
  check(e.ctrl.state().cur === null && e.made.length === 0, '開く前は何も鳴っていない');
  let r = runEd9(e.ctrl); await tick();
  check(r.atLine === true, '該当の一文の表示時点で鳴っている');
  check(e.ctrl.state().playing && e.made[0].src === 'assets/audio/bgm01.m4a', 'assets/audio/bgm01.m4a を再生');
  console.log('\n■ 2 ループ');
  check(e.made[0].loop === true, '繰り返し再生が有効');
  check(e.ctrl.state().vol === 0.5 && e.made[0].volume === 0.5, '初期音量 0.5（最大の半分）');

  console.log('\n■ 3 止めない');
  e.ctrl.onEnter('fin'); e.flush(); check(e.ctrl.state().playing, '「終」の表示後も鳴り続ける');
  e.ctrl.onEnter('title'); e.flush(); check(e.ctrl.state().playing, 'タイトル画面に戻っても鳴り続ける');

  console.log('\n■ 5 ed9 を一覧から開き直す');
  const a0 = e.made[0]; a0.currentTime = 42;
  e.ctrl.onEnter('gallery', 'ed9'); e.flush();
  check(e.ctrl.state().playing && a0.currentTime === 42, '鳴っている途中なら止めない');
  r = runEd9(e.ctrl); await tick();
  check(a0.currentTime === 42 && a0.plays === 1 && e.made.length === 1, 'カフェーの一文を再び通っても頭に戻さず続ける');

  console.log('\n■ 4 止まるとき（短いフェードアウト）');
  for (const [kind, id, name] of [['new', null, '「はじめから」'], ['load', null, 'セーブのロード'], ['gallery', 'ed1', '一覧から ed1'], ['gallery', 'ed8', '一覧から ed8'], ['gallery', 'ed7', '一覧から ed7']]) {
    const x = makeEnv(); runEd9(x.ctrl); await tick();
    x.ctrl.onEnter(kind, id);
    const midFade = x.ctrl.state().fading && !x.made[0].paused;
    x.flush();
    check(midFade && x.made[0].paused && x.ctrl.state().cur === null, name + 'で、フェードしてから止まる');
  }
  e = makeEnv(); runEd9(e.ctrl); await tick(); e.ctrl.onEnter('new'); e.flush();
  e.ctrl.onEnter('gallery', 'ed9');
  check(!e.ctrl.state().playing, '止まっている状態で ed9 を開いても、カフェーの一文まではまだ鳴らない');
  r = runEd9(e.ctrl); await tick();
  check(r.atLine && e.ctrl.state().playing && e.made[0].currentTime === 0, 'カフェーの一文で改めて頭から鳴り始める');

  console.log('\n■ 自動再生の制限・音源なし');
  e = makeEnv('block'); runEd9(e.ctrl); await tick();
  check(!e.ctrl.state().playing && e.ctrl.state().pending, '自動再生を拒まれたら、待ちの状態になる');
  e.mode = 'ok'; e.ctrl.onGesture(); await tick();
  check(e.ctrl.state().playing, '次のクリック・キー操作で鳴り始める');
  e = makeEnv('abort'); runEd9(e.ctrl); await tick();
  check(!e.ctrl.state().broken && e.ctrl.state().pending, '非表示のタブなどで再生が中断されても諦めず、待ちの状態になる');
  e.mode = 'ok'; e.ctrl.onGesture(); await tick();
  check(e.ctrl.state().playing, '次の操作（またはタブが見えるようになった時）で鳴り始める');
  e = makeEnv('missing'); let threw = false;
  try { runEd9(e.ctrl); await tick(); e.ctrl.onGesture(); await tick(); e.ctrl.onEnter('new'); e.flush(); } catch (err) { threw = true; }
  check(!threw && e.ctrl.state().broken && !e.ctrl.state().playing, '音源が無いときは例外を出さず無音のまま進む');
  e = makeEnv(); let threw2 = false;
  try { e.ctrl.stop(); e.ctrl.onEnter('new'); e.ctrl.onGesture(); e.ctrl.setVolume(2); e.ctrl.setMute(true); } catch (err) { threw2 = true; }
  check(!threw2 && e.ctrl.state().vol === 1 && e.ctrl.state().mute, '鳴らす前に止める・音量や消音を触っても例外なし（音量は0〜1に収める）');

  console.log(fail ? '\n失敗 ' + fail + ' 件' : '\nすべて OK');
  process.exitCode = fail ? 1 : 0;
})();
