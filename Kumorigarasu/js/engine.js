/* くもりがらす — 進行エンジン
   シナリオは js/scenario/*.js が window.SCN / window.CHAP / window.ENDS に登録する。

   シナリオ要素：
     '文字列'            一行（クリックで次へ）
     ''                  段落の間をあける
     '/'                 頁を改める
     { t, if }           条件つきの一行
     { c: [ {t, go, set, add, x, if}, ... ] }   選択肢
     { set:{}, add:{} }  値の設定・加算
     { x:{} }            演出番号の切り替え
     { go:'id', if }     別の場面へ
     { chap:n }          章の扉
     { end:'id' }        結末
   条件 if は (v, f) => 真偽 の関数。v は数値、f はフラグ。
*/
(() => {
'use strict';

const $ = (s) => document.querySelector(s);
function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

const K = { cfg: 'kg_cfg', read: 'kg_read', end: 'kg_end', ch: 'kg_s0', cho: 'kg_sc' };
const NUM = '〇一二三四五六七八九十';
const kan = n => n <= 10 ? NUM[n] : n < 20 ? '十' + NUM[n - 10] : String(n);
const chLabel = n => n ? '第' + kan(n) + '章' : '序';

const SCN = window.SCN || (window.SCN = {});
const CHAP = window.CHAP || (window.CHAP = {});
const ENDS = window.ENDS || (window.ENDS = {});
const END_IDS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'];
const LIM = { v1: [0, 15], v2: [0, 10] };
const INIT_V = { v1: 2, v2: 2 };
const FOG = [0.1, 0.05, 0.1, 0.16, 0.23, 0.3, 0.38, 0.46, 0.56, 0.64, 0.72];
const SIZES = [15, 17, 19, 22];
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

const root = document.documentElement;
const body = document.body;
const scr = { title: $('#scr-title'), name: $('#scr-name'), game: $('#scr-game') };
const pageEl = $('#page');
const choEl = $('#cho');
const cardEl = $('#card');
const cur = el('span', 'cur');

/* ---------- 設定 ---------- */

const cfg = Object.assign({ spd: 60, auto: 45, size: 1 }, store.get(K.cfg, {}));
function applyCfg() { root.style.setProperty('--fs', (SIZES[cfg.size] || SIZES[1]) + 'px'); }
const msPerChar = () => cfg.spd >= 100 ? 0 : Math.round(4 + (100 - cfg.spd) * 0.75);
const autoWait = n => Math.round((700 + n * 60) * (1.9 - cfg.auto / 100 * 1.5));

/* ---------- 既読 ---------- */

const readSet = new Set(store.get(K.read, []));
let readTimer = 0;
function flushRead() { clearTimeout(readTimer); store.set(K.read, [...readSet]); }
function markRead(key) {
  if (readSet.has(key)) return;
  readSet.add(key);
  clearTimeout(readTimer);
  readTimer = setTimeout(flushRead, 500);
}
window.addEventListener('pagehide', flushRead);

/* ---------- 状態 ---------- */

let S = null;
let log = [];
let mode = 'idle';       // idle | type | wait | choice | card | end
let screen = 'title';
let typing = null;
let timer = 0;
let cardT0 = 0;
let curRead = false;
let autoOn = false, skipOn = false, ctrlSkip = false;
let dbgAll = false;

const fresh = () => ({ sc: 'ch1_s1', i: 0, ch: 0, v: { ...INIT_V }, f: {}, x: {}, nm: '', page: [] });
const skipping = () => skipOn || ctrlSkip;
const clamp = (k, n) => LIM[k] ? Math.max(LIM[k][0], Math.min(LIM[k][1], n)) : n;
const isV = k => /^v\d+$/.test(k);
const sub = t => t.replace(/\{N\}/g, S ? S.nm : '');

function kindOf(t) {
  if (t[0] === '▷') return 'p';
  if (t[0] === '「' || t[0] === '『') return 'd';
  if (t === '＊') return 'c';
  return 'n';
}

function applyOps(o) {
  if (o.set) for (const k in o.set) {
    if (isV(k)) S.v[k] = clamp(k, o.set[k]); else S.f[k] = o.set[k];
  }
  if (o.add) for (const k in o.add) S.v[k] = clamp(k, (S.v[k] || 0) + o.add[k]);
  if (o.x) for (const k in o.x) { if (o.x[k]) S.x[k] = 1; else delete S.x[k]; }
  if (o.x) applyLook();
}
const test = c => !c || !!c(S.v, S.f);

/* ---------- 見た目 ---------- */

function show(name) {
  for (const k in scr) scr[k].classList.toggle('on', k === name);
  screen = name;
}
function applyLook() {
  const inGame = screen === 'game' && S;
  const c = inGame ? S.ch : 0;
  root.style.setProperty('--fog', FOG[Math.min(c, FOG.length - 1)]);
  for (const c of [...body.classList]) if (/^[xz]\d+$/.test(c)) body.classList.remove(c);
  if (inGame) for (const k in S.x) body.classList.add(k);
}

/* ---------- 頁 ---------- */

function mkLine(k, t) {
  const p = el('p', 'ln k' + k);
  let text = t;
  if (k === 'p') { p.append(el('span', 'mk', '▷')); text = t.replace(/^▷\s*/, ''); }
  const s = el('span', 'tx', text);
  p.append(s);
  return { p, s, text };
}
function clearPage() {
  cur.remove();
  pageEl.innerHTML = '';
  if (S) S.page = [];
}
function place(p) {
  p.style.visibility = 'hidden';
  pageEl.append(p);
  if (pageEl.children.length > 1 && pageEl.scrollHeight > pageEl.clientHeight + 1) {
    clearPage();
    pageEl.append(p);
  }
  p.style.visibility = '';
}
function addGap() {
  pageEl.append(el('div', 'gap'));
  S.page.push({ k: 'g' });
}
function restorePage() {
  pageEl.innerHTML = '';
  for (const e of S.page) {
    if (e.k === 'g') pageEl.append(el('div', 'gap'));
    else pageEl.append(mkLine(e.k, e.t).p);
  }
}
function pushLog(k, t) {
  log.push({ k, t });
  if (log.length > 600) log.splice(0, log.length - 600);
}

/* ---------- 進行 ---------- */

function step() {
  clearTimeout(timer);
  for (let guard = 0; guard < 10000; guard++) {
    const arr = SCN[S.sc];
    if (!arr || S.i >= arr.length) return notYet();
    const it = arr[S.i];
    if (typeof it === 'string') {
      if (it === '/') { clearPage(); S.i++; continue; }
      if (it === '') { addGap(); S.i++; continue; }
      return showLine(it);
    }
    if (it.if && !test(it.if)) { S.i++; continue; }
    if (it.t === '') { addGap(); S.i++; continue; }
    if (it.t === '/') { clearPage(); S.i++; continue; }
    if (it.t != null) return showLine(it.t);
    applyOps(it);
    if (it.c) return showChoices(it.c);
    if (it.chap) return showCard(it.chap);
    if (it.end) return showEnd(it.end);
    if (it.go) { S.sc = it.go; S.i = 0; continue; }
    S.i++;
  }
}

function showLine(raw) {
  const t = sub(raw);
  const k = kindOf(t);
  const { p, s, text } = mkLine(k, t);
  place(p);
  S.page.push({ k, t });
  pushLog(k, t);
  const key = S.sc + ':' + S.i;
  curRead = readSet.has(key) || dbgAll;
  if (skipping() && curRead) { mode = 'type'; return done(); }
  if (skipOn) setSkip(false);
  typeOut(s, text);
}

function typeOut(s, text) {
  mode = 'type';
  const ms = msPerChar();
  if (!ms) return done();
  s.textContent = '';
  const t0 = performance.now();
  const tick = now => {
    const n = Math.min(text.length, Math.floor((now - t0) / ms) + 1);
    s.textContent = text.slice(0, n);
    if (n >= text.length) { typing = null; done(); }
    else typing.raf = requestAnimationFrame(tick);
  };
  typing = { s, text, raf: requestAnimationFrame(tick) };
}
function finishTyping() {
  if (!typing) return;
  cancelAnimationFrame(typing.raf);
  typing.s.textContent = typing.text;
  typing = null;
  done();
}
function done() {
  mode = 'wait';
  markRead(S.sc + ':' + S.i);
  const last = pageEl.lastElementChild;
  if (last) last.append(cur);
  schedule();
}
function schedule() {
  clearTimeout(timer);
  if (mode === 'card') {
    if (skipping()) timer = setTimeout(closeCard, 450);
    else if (autoOn) timer = setTimeout(closeCard, 4200);
    return;
  }
  if (mode !== 'wait' || openOvs.length) return;
  if (skipping() && curRead) timer = setTimeout(next, 30);
  else if (autoOn) {
    const last = S.page[S.page.length - 1];
    timer = setTimeout(next, autoWait(last && last.t ? last.t.length : 20));
  }
}
function next() {
  clearTimeout(timer);
  cur.remove();
  S.i++;
  step();
}

function adv() {
  if (screen !== 'game' || openOvs.length || !S) return;
  if (skipOn) { setSkip(false); return; }
  if (mode === 'type') finishTyping();
  else if (mode === 'wait') next();
  else if (mode === 'card') { if (performance.now() - cardT0 > 700) closeCard(); }
  else if (mode === 'end') { if (performance.now() - cardT0 > 1800) goTitle(); }
}

/* ---------- 選択肢 ---------- */

function showChoices(list) {
  if (skipOn) setSkip(false);
  mode = 'choice';
  saveSlot(K.cho, true);
  choEl.innerHTML = '';
  list.filter(c => test(c.if)).forEach(c => {
    const b = el('button');
    b.type = 'button';
    b.append(el('span', 'mk', '▷'), el('span', 'tx', sub(c.t).replace(/^▷\s*/, '')));
    b.addEventListener('click', e => { e.stopPropagation(); pick(c); });
    choEl.append(b);
  });
  choEl.hidden = false;
  pageEl.scrollTop = pageEl.scrollHeight;
}
function pick(c) {
  if (mode !== 'choice' || openOvs.length) return;
  choEl.hidden = true;
  choEl.innerHTML = '';
  markRead(S.sc + ':' + S.i);
  applyOps(c);
  const t = sub(c.t);
  place(mkLine('p', t).p);
  S.page.push({ k: 'p', t });
  pushLog('p', t);
  if (c.go) { S.sc = c.go; S.i = 0; } else S.i++;
  mode = 'idle';
  step();
}

/* ---------- 章の扉・結末 ---------- */

function setCard(a, b, c, cls) {
  cardEl.className = cls || '';
  cardEl.innerHTML = '';
  cardEl.append(el('div', 'c1 tr', a), el('div', 'c2 tr', b), el('div', 'c3', c || ''));
  cardEl.hidden = false;
  cardT0 = performance.now();
}
function showCard(n) {
  S.ch = n;
  clearPage();
  applyLook();
  mode = 'card';
  saveSlot(K.ch, true);
  setCard(chLabel(n), (CHAP[n] || {}).title || '');
  schedule();
}
function closeCard() {
  if (mode !== 'card') return;
  clearTimeout(timer);
  cardEl.hidden = true;
  mode = 'idle';
  S.i++;
  step();
}
function showEnd(id) {
  setAuto(false);
  setSkip(false);
  const got = store.get(K.end, {});
  if (!got[id]) { got[id] = Date.now(); store.set(K.end, got); }
  mode = 'end';
  scr.game.classList.add('ending');
  clearPage();
  const e = ENDS[id] || {};
  setCard('終', e.name ? '「' + e.name + '」' : '', '', 'fin');
}
function notYet() {
  setAuto(false);
  setSkip(false);
  mode = 'end';
  scr.game.classList.add('ending');
  clearPage();
  setCard('ここまで', '', '続きの章は準備中です', 'fin');
}

/* ---------- 画面の出入り ---------- */

function resetStage() {
  clearTimeout(timer);
  if (typing) { cancelAnimationFrame(typing.raf); typing = null; }
  cardEl.hidden = true;
  choEl.hidden = true;
  choEl.innerHTML = '';
  scr.game.classList.remove('ending');
  cur.remove();
  pageEl.innerHTML = '';
  mode = 'idle';
}
function enterGame() {
  resetStage();
  show('game');
  applyLook();
}
function goTitle() {
  closeAllOv();
  setAuto(false);
  setSkip(false);
  resetStage();
  S = null;
  show('title');
  applyLook();
  refreshTitle();
}
function newGame(name) {
  S = fresh();
  S.nm = name;
  log = [];
  enterGame();
  step();
}
/* 自動記録は 章頭（章の扉）と 選択（選択肢が出た時点）の二枠。手動は十一枠 */
const SLOTS = [
  { k: K.ch, n: '章頭', auto: true },
  { k: K.cho, n: '選択', auto: true },
  ...Array.from({ length: 11 }, (_, i) => ({ k: 'kg_s' + (i + 1), n: kan(i + 1) })),
];
function refreshTitle() {
  let any = false;
  for (const sl of SLOTS) if (store.get(sl.k)) { any = true; break; }
  $('[data-t="load"]').disabled = !any;
}

/* ---------- 記録 ---------- */

function snapshot() {
  const s = JSON.parse(JSON.stringify(S));
  const lg = log.slice(-200);
  if (mode === 'wait' || mode === 'type') { s.page = s.page.slice(0, -1); lg.pop(); }
  return { s, log: lg };
}
function saveSlot(key, quiet) {
  if (!S || mode === 'end') return;
  const snap = snapshot();
  const ok = store.set(key, { s: snap.s, log: snap.log, ch: S.ch, t: Date.now() });
  if (!quiet) toast(ok ? '記録しました' : '記録できませんでした');
}
function loadSlot(key) {
  const d = store.get(key);
  if (!d || !d.s) return;
  closeAllOv();
  setAuto(false);
  setSkip(false);
  S = d.s;
  S.x = S.x || {};
  log = d.log || [];
  enterGame();
  restorePage();
  step();
}
function fmtDate(t) {
  const d = new Date(t);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}　${p(d.getHours())}:${p(d.getMinutes())}`;
}
function openSaves(kind) {
  if (kind === 'save' && (!S || mode === 'end')) return;
  $('#sv-h').textContent = kind === 'save' ? '記録する' : '記録を読む';
  const list = $('#sv-list');
  list.innerHTML = '';
  for (const sl of SLOTS) {
    const d = store.get(sl.k);
    const b = el('button', 'slot' + (d ? '' : ' empty') + (sl.auto ? ' auto' : ''));
    b.type = 'button';
    b.append(el('span', 'sn', sl.n));
    const info = el('span', 'si');
    if (d) {
      info.append(el('span', 'sc', chLabel(d.ch) + '　' + ((CHAP[d.ch] || {}).title || '')));
      info.append(el('span', 'sd', fmtDate(d.t)));
    } else {
      info.append(el('span', 'sc', '―'));
    }
    b.append(info);
    b.disabled = kind === 'save' ? !!sl.auto : !d;
    b.addEventListener('click', async () => {
      if (kind === 'save') {
        if (d && !await ask('この記録に上書きしますか。')) return;
        saveSlot(sl.k);
        openSaves('save');
      } else {
        if (screen === 'game' && !await ask('この記録を読み込みますか。\n今の進みは失われます。')) return;
        loadSlot(sl.k);
      }
    });
    list.append(b);
  }
  openOv($('#ov-save'));
}

/* ---------- 重ね窓 ---------- */

const openOvs = [];
function openOv(o) {
  clearTimeout(timer);
  if (!openOvs.includes(o)) openOvs.push(o);
  o.hidden = false;
}
function closeOv(o) {
  const i = openOvs.indexOf(o);
  if (i >= 0) openOvs.splice(i, 1);
  o.hidden = true;
  if (!openOvs.length && screen === 'game') schedule();
}
function closeTop() {
  const o = openOvs[openOvs.length - 1];
  if (!o) return;
  if (o._esc) o._esc(); else closeOv(o);
}
function closeAllOv() {
  while (openOvs.length) openOvs.pop().hidden = true;
}
document.querySelectorAll('.ov [data-close]').forEach(b =>
  b.addEventListener('click', () => closeOv(b.closest('.ov'))));
document.querySelectorAll('.ov').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) closeTop(); }));

function ask(msg) {
  return new Promise(res => {
    const o = $('#ov-ask');
    $('#ask-m').textContent = msg;
    $('#ask-m').style.whiteSpace = 'pre-line';
    const fin = v => { o._esc = null; closeOv(o); res(v); };
    $('#ask-y').onclick = () => fin(true);
    $('#ask-n').onclick = () => fin(false);
    o._esc = () => fin(false);
    openOv(o);
    $('#ask-n').focus();
  });
}

let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 1600);
}

function openLog() {
  const list = $('#log-list');
  list.innerHTML = '';
  for (const e of log) list.append(mkLine(e.k, e.t).p);
  if (!log.length) list.append(el('p', 'ln kc', '―'));
  openOv($('#ov-log'));
  list.scrollTop = list.scrollHeight;
}

function openEnds() {
  const got = store.get(K.end, {});
  const list = $('#end-list');
  list.innerHTML = '';
  let c = 0;
  END_IDS.forEach((id, i) => {
    const has = !!got[id];
    if (has) c++;
    const li = el('li', has ? 'got' : '');
    li.append(el('span', 'en', '其の' + kan(i + 1)));
    li.append(el('span', 'et', has ? '「' + ((ENDS[id] || {}).name || '') + '」' : '？？？'));
    list.append(li);
  });
  $('#end-n').textContent = '回収　' + kan(c) + '／' + kan(END_IDS.length);
  openOv($('#ov-end'));
}

/* 設定窓 */
let demoRaf = 0;
function demo() {
  cancelAnimationFrame(demoRaf);
  const s = $('#cf-demo .tx');
  const text = '潮見駅の焼け残った跨線橋を降りると、雨の匂いに、油と煮込みの匂いが混ざってきた。';
  const ms = msPerChar();
  if (!ms) { s.textContent = text; return; }
  const t0 = performance.now();
  const tick = now => {
    const n = Math.min(text.length, Math.floor((now - t0) / ms) + 1);
    s.textContent = text.slice(0, n);
    if (n < text.length) demoRaf = requestAnimationFrame(tick);
  };
  demoRaf = requestAnimationFrame(tick);
}
function syncCfgUi() {
  $('#cf-spd').value = cfg.spd;
  $('#cf-auto').value = cfg.auto;
  document.querySelectorAll('#cf-size button').forEach(b =>
    b.setAttribute('aria-pressed', String(+b.dataset.s === cfg.size)));
}
function openCfg() {
  syncCfgUi();
  openOv($('#ov-cfg'));
  demo();
}
function saveCfg() { store.set(K.cfg, cfg); applyCfg(); }
$('#cf-spd').addEventListener('input', e => { cfg.spd = +e.target.value; saveCfg(); demo(); });
$('#cf-auto').addEventListener('input', e => { cfg.auto = +e.target.value; saveCfg(); });
document.querySelectorAll('#cf-size button').forEach(b => b.addEventListener('click', () => {
  cfg.size = +b.dataset.s;
  saveCfg();
  syncCfgUi();
}));

/* ---------- 自動・早送り ---------- */

function setAuto(v) {
  autoOn = v;
  $('[data-a="auto"]').setAttribute('aria-pressed', String(v));
  if (screen === 'game') schedule();
}
function setSkip(v) {
  skipOn = v;
  $('[data-a="skip"]').setAttribute('aria-pressed', String(v));
  if (!v || screen !== 'game') { if (screen === 'game') schedule(); return; }
  if (mode === 'type') finishTyping();
  else if (mode === 'wait') { clearTimeout(timer); timer = setTimeout(next, 30); }
  else schedule();
}

/* ---------- 操作 ---------- */

document.querySelectorAll('.tmenu button').forEach(b => b.addEventListener('click', () => {
  b.blur();
  const t = b.dataset.t;
  if (t === 'new') {
    show('name');
    $('#nm-note').innerHTML = '&nbsp;';
    setTimeout(() => $('#nm-in').focus(), 60);
  } else if (t === 'load') openSaves('load');
  else if (t === 'ends') openEnds();
  else if (t === 'cfg') openCfg();
}));

$('#nm-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#nm-in').value.replace(/\s+/g, '').slice(0, 8);
  if (!v) { $('#nm-note').textContent = '名を入れてください。'; return; }
  $('#nm-in').blur();
  newGame(v);
});
$('#nm-back').addEventListener('click', () => { show('title'); refreshTitle(); });

document.querySelectorAll('#bar button').forEach(b => b.addEventListener('click', async e => {
  e.stopPropagation();
  b.blur();
  const a = b.dataset.a;
  if (a === 'log') openLog();
  else if (a === 'auto') setAuto(!autoOn);
  else if (a === 'skip') setSkip(!skipOn);
  else if (a === 'save') openSaves('save');
  else if (a === 'load') openSaves('load');
  else if (a === 'cfg') openCfg();
  else if (a === 'title') { if (await ask('表題へ戻りますか。\n記録していない進みは失われます。')) goTitle(); }
}));

scr.game.addEventListener('click', e => {
  if (e.target.closest('#bar, #cho')) return;
  adv();
});
scr.game.addEventListener('wheel', e => {
  if (e.deltaY < 0 && !openOvs.length && S && mode !== 'end') openLog();
}, { passive: true });

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (e.key === 'Escape') { closeTop(); return; }
  if (openOvs.length || screen !== 'game') return;
  if (e.key === 'Control') {
    if (!ctrlSkip) { ctrlSkip = true; schedule(); if (mode === 'type' && curRead) finishTyping(); }
    return;
  }
  if (mode === 'choice') {
    const bs = [...choEl.children];
    if (/^[1-9]$/.test(e.key) && bs[+e.key - 1]) { bs[+e.key - 1].click(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = bs.indexOf(document.activeElement);
      const n = e.key === 'ArrowDown' ? (i + 1) % bs.length : (i <= 0 ? bs.length - 1 : i - 1);
      bs[n].focus();
      return;
    }
    return;
  }
  if (e.target.closest('button')) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!e.repeat || mode === 'wait' || mode === 'type') adv();
  }
});
document.addEventListener('keyup', e => {
  if (e.key === 'Control') { ctrlSkip = false; if (screen === 'game') schedule(); }
});
window.addEventListener('blur', () => { ctrlSkip = false; });

/* ---------- 起動 ---------- */

applyCfg();
show('title');
applyLook();
refreshTitle();

if (DEBUG) {
  window.__g = {
    get S() { return S; },
    get mode() { return mode; },
    get skipAll() { return dbgAll; },
    set skipAll(v) { dbgAll = !!v; },
    CHAP, ENDS, END_IDS, SCN, LIM, INIT_V,
    look: applyLook,
    jump(sc, i = 0) {
      if (!SCN[sc]) return false;
      closeAllOv();
      if (!S) { S = fresh(); S.nm = '試'; log = []; }
      enterGame();
      S.sc = sc;
      S.i = i;
      S.page = [];
      step();
      return true;
    },
    choices: () => mode === 'choice' ? [...choEl.children].map(b => b.textContent) : null,
    pick(n) { const b = choEl.children[n]; if (b) b.click(); },
    fwd() {
      if (mode === 'type') finishTyping();
      else if (mode === 'wait') next();
      else if (mode === 'card') closeCard();
    },
    goTitle,
  };
  const s = document.createElement('script');
  s.src = 'js/dbg.js';
  document.body.append(s);
}
})();
