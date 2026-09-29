// 画面の進行・セーブ・各画面
(function () {
  'use strict';
  const SN = window.SN;
  const $ = (id) => document.getElementById(id);
  const tx = $('tx'), cs = $('cs'), bx = $('bx'), ov = $('ov');
  const DEBUG = /[?&]debug=1\b/.test(location.search);

  // ---- 保存 ----
  const K = { s: 'snr_s', q: 'snr_q', r: 'snr_r', e: 'snr_e', d: 'snr_d', c: 'snr_c', g: 'snr_g' };
  function load(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境でも遊べる */ } }

  let read = load(K.r, {});
  let ends = load(K.e, {});
  let rec = load(K.d, {});
  let cfg = Object.assign({ vol: 0.7, mute: false }, load(K.c, {}));
  let dbgAll = false;
  let readDirty = false;
  setInterval(() => { if (readDirty) { save(K.r, read); readDirty = false; } }, 3000);
  window.addEventListener('beforeunload', () => { if (readDirty) save(K.r, read); });

  const ED7 = ['ed1', 'ed2', 'ed3', 'ed4', 'ed5', 'ed6', 'ed7'];
  SN.glob = function () { return { all: (dbgAll || ED7.every((e) => ends[e])) ? 1 : 0 }; };

  SN.compile();

  // ---- 音 ----
  const AU = { el: null, name: '', fade: null };
  function vol() { return cfg.mute ? 0 : cfg.vol; }
  function bgm(name) {
    if (name === 'stop') { bgmStop(); return; }
    bgmStop(true);
    const el = new Audio();
    el.loop = true; el.volume = vol();
    const exts = ['mp3', 'ogg', 'm4a', 'wav'];
    let k = 0;
    el.addEventListener('error', () => { k++; if (k < exts.length) { el.src = 'assets/audio/' + name + '.' + exts[k]; el.play().catch(() => {}); } });
    el.src = 'assets/audio/' + name + '.' + exts[0];
    el.play().catch(() => {});
    AU.el = el; AU.name = name;
  }
  function bgmStop(now) {
    const el = AU.el;
    if (!el) return;
    AU.el = null; AU.name = '';
    if (now) { el.pause(); return; }
    let v = el.volume;
    const iv = setInterval(() => { v -= 0.05; if (v <= 0) { el.pause(); clearInterval(iv); } else el.volume = v; }, 80);
  }
  function se(name) {
    try {
      const el = new Audio('assets/audio/' + name + '.mp3');
      el.volume = vol();
      el.play().catch(() => {});
    } catch (e) { /* 音源がなくても進める */ }
  }

  // ---- 状態 ----
  let st = null;
  let busy = false;      // 選択肢・見出しの表示中
  let skip = false;
  let skipT = null;
  let waitCard = null;
  let log = [];

  const KAN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
  const LOSS = { k1: ['あなた', '左手の温度'], k2: ['綴', '右耳'], k3: ['あなた', '白'], k4: ['綴', '夜目'] };

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function fmt(s) {
    let h = esc(s);
    h = h.replace(/\[\[w\|(.+?)\]\]/g, '<span class="q1">$1</span>');
    h = h.replace(/\{N\}/g, esc(st && st.name ? st.name : '結夏'));
    return h;
  }

  function applyLook(instant) {
    document.body.classList.toggle('nw', st.k.indexOf('k3') >= 0 && st.pov === 'h');
    $('bl').className = st.bg || 'b0';
    const n = /^e/.test(st.frm) ? 0 : st.v.ch >= 6 ? st.v.ch - 4 : (st.v.ch === 5 && st.k.indexOf('k2') >= 0) ? 1 : 0;
    FX.set({ frm: st.frm, n, p4: st.v.p4, sky: st.sky, instant: !!instant });
    bx.classList.toggle('thin', st.frm === 'e8' || st.frm === 'e9' || ['2', '3', '4', '5'].indexOf(st.sky) >= 0);
    dbgDraw();
  }

  function para(s, noAnim) {
    const p = document.createElement('p');
    p.innerHTML = fmt(s);
    if (s[0] === '▷') p.className = 'u';
    if (noAnim) p.classList.add('nf');
    return p;
  }

  function fits() { return bx.scrollHeight <= bx.clientHeight + 1; }

  function showText(s) {
    const p = para(s, skip);
    tx.appendChild(p);
    st.page.push(s);
    if (!fits() && tx.children.length > 1) {
      tx.innerHTML = '';
      st.page = [s];
      tx.appendChild(para(s, skip));
    }
    log.push(s);
    if (log.length > 400) log.shift();
  }

  function renderPage() {
    tx.innerHTML = '';
    cs.innerHTML = '';
    st.page.forEach((s) => tx.appendChild(para(s, true)));
    while (!fits() && tx.children.length > 1) { tx.removeChild(tx.firstChild); st.page.shift(); }
  }

  function clearPage() { tx.innerHTML = ''; cs.innerHTML = ''; st.page = []; }

  // ---- 進行 ----
  function adv() {
    if (!st || busy || ov.classList.contains('on')) return;
    for (let g = 0; g < 1000; g++) {
      const e = SN.step(st);
      switch (e.t) {
        case 'tx': {
          showText(e.op.s);
          const was = !!read[e.op.id];
          if (!was) { read[e.op.id] = 1; readDirty = true; }
          if (skip) {
            if (was) { clearTimeout(skipT); skipT = setTimeout(adv, 45); }
            else setSkip(false);
          }
          dbgDraw();
          return;
        }
        case 'pg': clearPage(); break;
        case 'fx': if (e.fx) FX.fx(e.fx); applyLook(); break;
        case 'ch': showChoice(e.op); return;
        case 'chap': clearPage(); applyLook(); showCard('第' + KAN[e.n] + '章', e.s); return;
        case 'lose': applyLook(); toast('失われた感覚　' + LOSS[e.k][1] + '（' + LOSS[e.k][0] + '）'); break;
        case 'page': rec.open = 1; rec[e.g] = 1; save(K.d, rec); toast('記録に一件、書き足された'); break;
        case 'rec': if (!rec.open) { rec.open = 1; save(K.d, rec); } toast('メニューの「記録」が開けるようになった'); break;
        case 'flag': rec[e.a] = 1; save(K.d, rec); break;
        case 'bgm': bgm(e.a); break;
        case 'se': se(e.a); break;
        case 'note': toast(e.s); break;
        case 'end': reachEnd(e.id); return;
        case 'over': gameOver(); return;
        case 'eof': toTitle(); return;
        default: break;
      }
    }
  }

  function setSkip(on) {
    skip = on;
    $('sk-ind').classList.toggle('on', on);
    clearTimeout(skipT);
    if (on && st && !busy && !ov.classList.contains('on')) skipT = setTimeout(adv, 45);
  }

  function showChoice(op) {
    busy = true;
    setSkip(false);
    // 直前の選択肢セーブ
    save(K.q, snap());
    const list = SN.options(st, op);
    cs.innerHTML = '';
    list.forEach((o) => {
      if (o.off) {
        const d = document.createElement('div');
        d.className = 'off'; d.textContent = o.s; d.setAttribute('aria-disabled', 'true');
        cs.appendChild(d);
      } else {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = o.s;
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          log.push('▶ ' + o.s);
          cs.innerHTML = '';
          busy = false;
          SN.choose(st, op, o.i);
          dbgDraw();
          adv();
        });
        cs.appendChild(b);
      }
    });
    while (!fits() && tx.children.length > 0) { tx.removeChild(tx.firstChild); st.page.shift(); }
    dbgDraw();
  }

  function showCard(a, b, sub, then) {
    busy = true;
    ov.className = 'on';
    ov.innerHTML = '<div class="cc"><div class="n">' + esc(a) + '</div><div class="s">' + esc(b) + '</div>' + (sub ? '<div class="h">' + esc(sub) + '</div>' : '') + '</div>';
    const go = () => {
      clearTimeout(waitCard);
      ov.removeEventListener('click', go);
      document.removeEventListener('keydown', key2, true);
      closeOv(); busy = false;
      if (then) then(); else adv();
    };
    const key2 = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(); } };
    setTimeout(() => { ov.addEventListener('click', go); document.addEventListener('keydown', key2, true); }, 500);
    if (skip) waitCard = setTimeout(go, 700);
  }

  function toast(s) {
    const d = document.createElement('div');
    d.textContent = s;
    $('toast').appendChild(d);
    setTimeout(() => d.remove(), 4300);
  }

  function snap() {
    const c = JSON.parse(JSON.stringify(st));
    const pos = SN.pos(c.pc);
    delete c.pc;
    const cur = st.page.length ? st.page[st.page.length - 1] : '';
    return { pos, st: c, t: Date.now(), ch: st.v.ch, snip: cur.replace(/\[\[w\|(.+?)\]\]/g, '$1').slice(0, 28) };
  }

  function restore(sv) {
    if (!sv) return false;
    let pc;
    try { pc = SN.unpos(sv.pos); } catch (e) { toast('このセーブは読み込めない'); return false; }
    st = JSON.parse(JSON.stringify(sv.st));
    st.pc = pc;
    closeOv();
    document.body.classList.remove('ti');
    busy = false;
    setSkip(false);
    FX.fx('u');
    applyLook(true);
    renderPage();
    const op = SN.prog[st.pc];
    if (op && op.t === 'ch') showChoice(op);
    return true;
  }

  function reachEnd(id) {
    const first = !ends[id];
    const es = st.es && st.es.id === id ? { pos: SN.pos(st.es.pc), st: st.es.st } : null;
    ends[id] = { t: Date.now(), es: es || (ends[id] && ends[id].es) || null };
    save(K.e, ends);
    setSkip(false);
    const e = SN.ends[id];
    showCard(e[0], e[1], first ? '' : '', () => {
      showCard('', '終', '', () => { toTitle(true); });
    });
  }

  function gameOver() {
    setSkip(false);
    busy = true;
    ov.className = 'on';
    ov.innerHTML = '<div class="pn" style="text-align:center"><p class="dim" style="letter-spacing:.4em">――</p><p>ここで、途切れた。</p><div class="row" style="justify-content:center"><button class="ob" id="go-q">直前の選択肢から</button><button class="ob" id="go-t">タイトルへ</button></div></div>';
    $('go-q').onclick = () => { busy = false; restore(load(K.q, null)); };
    $('go-t').onclick = () => { busy = false; toTitle(); };
  }

  // ---- 画面 ----
  function closeOv() { ov.className = ''; ov.innerHTML = ''; }
  function panel(title, body, cls) {
    ov.className = 'on';
    ov.innerHTML = '<div class="pn ' + (cls || '') + '"><h2>' + esc(title) + '</h2>' + body + '<div class="row"><button class="ob" id="pn-x">閉じる</button></div></div>';
    $('pn-x').onclick = () => { if (st) closeOv(); else toTitle(); };
  }

  function toTitle(keepMusic) {
    if (!keepMusic && AU.name) bgmStop();
    st = null;
    busy = false;
    setSkip(false);
    document.body.classList.remove('nw');
    document.body.classList.add('ti');
    tx.innerHTML = ''; cs.innerHTML = '';
    FX.fx('u');
    $('bl').className = 'b0';
    FX.set({ frm: 'off', sky: '0', n: 0 });
    bx.classList.remove('thin');
    const anyEnd = Object.keys(ends).length > 0;
    ov.className = 'on clear';
    ov.innerHTML = '<div class="tt"><h1>しらなわ</h1><div class="sub">平成元年　秋</div><div class="mn">' +
      '<button id="t-new">はじめから</button>' +
      '<button id="t-load">つづきから</button>' +
      (anyEnd ? '<button id="t-end">エンディング</button>' : '') +
      (rec.open ? '<button id="t-rec">記録</button>' : '') +
      '<button id="t-cfg">設定</button>' +
      '</div></div>';
    $('t-new').onclick = () => { bgmStop(); nameInput(); };
    $('t-load').onclick = () => slots(false, true);
    if (anyEnd) $('t-end').onclick = gallery;
    if (rec.open) $('t-rec').onclick = () => record(true);
    $('t-cfg').onclick = () => config(true);
  }

  function nameInput() {
    ov.className = 'on';
    ov.innerHTML = '<div class="pn nm"><h2>名前</h2><p class="dim">あなたの名前を入れてください。</p><input id="nm-i" maxlength="8" autocomplete="off" placeholder="結夏"><div class="row"><button class="ob" id="nm-ok">決める</button><button class="ob" id="nm-x">戻る</button></div></div>';
    const i = $('nm-i');
    i.focus();
    const ok = () => { start(i.value.trim() || '結夏'); };
    $('nm-ok').onclick = ok;
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) ok(); });
    $('nm-x').onclick = () => toTitle();
  }

  function start(name) {
    st = SN.fresh(name);
    FX.fx('u');
    closeOv();
    document.body.classList.remove('ti');
    clearPage();
    applyLook(true);
    adv();
  }

  function menu() {
    if (!st || (ov.classList.contains('on'))) return;
    setSkip(false);
    ov.className = 'on';
    ov.innerHTML = '<div class="pn"><h2>メニュー</h2><div class="ls">' +
      '<button class="sl" id="m-s">セーブ</button>' +
      '<button class="sl" id="m-l">ロード</button>' +
      '<button class="sl" id="m-q">直前の選択肢へ戻る</button>' +
      '<button class="sl" id="m-st">状態</button>' +
      (rec.open ? '<button class="sl" id="m-r">記録</button>' : '') +
      '<button class="sl" id="m-lg">履歴</button>' +
      '<button class="sl" id="m-c">設定</button>' +
      '<button class="sl" id="m-t">タイトルへ</button>' +
      '</div><div class="row"><button class="ob" id="pn-x">閉じる</button></div></div>';
    $('pn-x').onclick = closeOv;
    $('m-s').onclick = () => slots(true);
    $('m-l').onclick = () => slots(false);
    $('m-q').onclick = () => { const q = load(K.q, null); if (q) restore(q); else toast('まだ選択肢がない'); };
    $('m-st').onclick = status;
    if (rec.open) $('m-r').onclick = () => record(false);
    $('m-lg').onclick = backlog;
    $('m-c').onclick = () => config(false);
    $('m-t').onclick = () => { if (confirm('タイトルへ戻りますか。セーブしていない進行は失われます。')) toTitle(); };
  }

  function fmtDate(t) { const d = new Date(t); const z = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }
  function slotLabel(sv) { return sv ? '第' + (KAN[sv.ch] || '〇') + '章　<span class="d">' + fmtDate(sv.t) + '</span><br><span class="d">' + esc(sv.snip || '') + '</span>' : '<span class="d">―― 空き ――</span>'; }

  function slots(isSave, fromTitle) {
    const ss = load(K.s, []);
    let h = '<div class="ls">';
    if (!isSave) {
      const q = load(K.q, null);
      h += '<button class="sl qv" data-q="1"><span class="n">直前</span>' + (q ? slotLabel(q) : '<span class="d">―― なし ――</span>') + '</button>';
    }
    for (let i = 0; i < 11; i++) h += '<button class="sl" data-i="' + i + '"><span class="n">' + (i + 1) + '</span>' + slotLabel(ss[i]) + '</button>';
    h += '</div>';
    panel(isSave ? 'セーブ' : 'ロード', h);
    ov.querySelectorAll('.sl').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.q) { const q = load(K.q, null); if (q) { bgmStop(); restore(q); } return; }
        const i = +b.dataset.i;
        if (isSave) {
          if (ss[i] && !confirm((i + 1) + '番に上書きしますか。')) return;
          ss[i] = snap(); save(K.s, ss); toast((i + 1) + '番にセーブした'); slots(true);
        } else if (ss[i]) { bgmStop(); restore(ss[i]); }
      };
    });
    if (fromTitle) $('pn-x').onclick = () => toTitle(true);
  }

  function status() {
    const me = st.k.filter((k) => LOSS[k][0] === 'あなた').map((k) => LOSS[k][1]);
    const ot = st.k.filter((k) => LOSS[k][0] !== 'あなた').map((k) => LOSS[k][1]);
    let h = '<p class="dim">失われた感覚</p>';
    h += '<p>あなた：' + (me.length ? me.map(esc).join('、') : '<span class="dim">なし</span>') + '</p>';
    if (st.v.ch >= 2) h += '<p>綴：' + (ot.length ? ot.map(esc).join('、') : '<span class="dim">なし</span>') + '</p>';
    panel('状態', h);
  }

  function record(fromTitle) {
    const R = SN.rec;
    let h = '<div class="rc">';
    R.body.forEach((e) => { h += '<div class="e">' + esc(e) + '</div>'; });
    h += '<div class="hd">破られた頁</div>';
    ['g1', 'g2', 'g3'].forEach((g, i) => {
      h += '<div class="hd" style="margin-top:1em">（' + ['一', '二', '三'][i] + '）</div>';
      if (!rec[g]) h += '<div class="e w">？？？</div>';
      else if (g === 'g2' && !rec.d2) h += '<div class="e">' + esc(R.g2a) + '</div>';
      else h += '<div class="e">' + esc(R[g]) + '</div>';
    });
    h += '</div>';
    panel('記録', h);
    if (fromTitle) $('pn-x').onclick = () => toTitle(true);
  }

  function backlog() {
    const h = '<div class="lg">' + log.slice(-160).map((s) => '<p>' + fmt(s) + '</p>').join('') + '</div>';
    panel('履歴', h);
    const pn = ov.querySelector('.pn'); pn.scrollTop = pn.scrollHeight;
  }

  function config(fromTitle) {
    panel('設定', '<div class="cf"><label>音量 <input type="range" id="c-v" min="0" max="1" step="0.05" value="' + cfg.vol + '"></label><label><input type="checkbox" id="c-m" ' + (cfg.mute ? 'checked' : '') + '> 消音</label><p class="dim">クリック・Enter・スペースで進む。S でスキップ（既読の文章だけ早送り）。Esc でメニュー。</p></div>');
    $('c-v').oninput = (e) => { cfg.vol = +e.target.value; save(K.c, cfg); if (AU.el) AU.el.volume = vol(); };
    $('c-m').onchange = (e) => { cfg.mute = e.target.checked; save(K.c, cfg); if (AU.el) AU.el.volume = vol(); };
    if (fromTitle) $('pn-x').onclick = () => toTitle(true);
  }

  function gallery() {
    const list = ED7.concat(ED7.every((e) => ends[e]) ? ['ed8', 'ed9'] : []);
    let h = '<div class="ls">';
    list.forEach((id) => {
      const e = SN.ends[id];
      const got = ends[id];
      h += '<button class="sl" data-e="' + id + '" ' + (got ? '' : 'disabled style="cursor:default"') + '><span class="n">' + esc(e[0]) + '</span>' + (got ? esc(e[1]) : '<span class="d">？？？</span>') + '</button>';
    });
    h += '</div>';
    panel('エンディング', h);
    $('pn-x').onclick = () => toTitle(true);
    ov.querySelectorAll('.sl[data-e]').forEach((b) => {
      b.onclick = () => {
        const r = ends[b.dataset.e];
        if (!r) return;
        bgmStop();
        if (r.es) restore({ pos: r.es.pos, st: r.es.st });
        else { st = SN.fresh(''); st.pc = SN.labels[b.dataset.e]; closeOv(); document.body.classList.remove('ti'); clearPage(); applyLook(true); adv(); }
      };
    });
  }

  // ---- 入力 ----
  bx.addEventListener('click', () => adv());
  $('b-menu').onclick = (e) => { e.stopPropagation(); menu(); };
  $('b-skip').onclick = (e) => { e.stopPropagation(); if (st) setSkip(!skip); };
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { if (ov.classList.contains('on') && st && !busy) closeOv(); else menu(); return; }
    if (!st || ov.classList.contains('on')) return;
    if (e.key === 's' || e.key === 'S') { setSkip(!skip); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (skip) setSkip(false); adv(); }
  });
  bx.addEventListener('wheel', (e) => { if (e.deltaY < 0 && st && !ov.classList.contains('on')) backlog(); }, { passive: true });

  // ---- デバッグ（?debug=1 のときだけ） ----
  const dbg = $('dbg');
  function dbgDraw() {
    if (!DEBUG || !st) return;
    const v = st.v;
    $('d-v').textContent = 'p1=' + v.p1 + ' p2=' + v.p2 + ' p3=' + v.p3 + ' p4=' + v.p4 + '\nf1=' + v.f1 + ' f2=' + v.f2 + ' f3=' + v.f3 + ' f4=' + v.f4 + '\nm1=' + v.m1 + ' m2=' + v.m2 + ' m3=' + v.m3 + ' r1=' + v.r1 + '\nch=' + v.ch + ' k=' + st.k.join(',') + ' pov=' + st.pov + ' frm=' + st.frm + '\n@' + (SN.prog[st.pc] ? SN.prog[st.pc].l : '-');
  }
  if (DEBUG) {
    dbg.className = 'on';
    let opts = '';
    for (let i = 1; i <= 15; i++) opts += '<option value="ch' + String(i).padStart(2, '0') + '">ch' + String(i).padStart(2, '0') + '</option>';
    let eo = '';
    for (let i = 1; i <= 9; i++) eo += '<option value="ed' + i + '">ed' + i + '</option>';
    dbg.innerHTML = '<pre id="d-v" style="margin:0 0 6px;white-space:pre-wrap"></pre>' +
      '<select id="d-c">' + opts + '</select><button id="d-cg">章へ</button> ' +
      '<select id="d-e">' + eo + '</select><button id="d-eg">EDへ</button><br>' +
      '<input id="d-s" placeholder="p1=60,f1=1" size="16"><button id="d-sg">設定</button><br>' +
      '<label><input type="checkbox" id="d-a"> ED1-7回収扱い</label> <button id="d-r">既読消去</button> <button id="d-x">記録全開</button> <button id="d-h">隠す</button>';
    const fake = (lab) => {
      if (!st) { st = SN.fresh('結夏'); closeOv(); document.body.classList.remove('ti'); }
      const n = +lab.slice(2);
      if (lab.startsWith('ch')) {
        const k = [];
        if (n >= 4) k.push('k1'); if (n >= 6) k.push('k2'); if (n >= 9) k.push('k3'); if (n >= 11) k.push('k4');
        st.k = k;
        st.frm = n >= 13 ? '2' : n >= 9 ? '1' : '0';
        st.pov = 'h'; st.sky = '0';
      }
      st.pc = SN.labels[lab];
      busy = false; closeOv(); clearPage(); applyLook(true); adv();
    };
    $('d-cg').onclick = () => fake($('d-c').value);
    $('d-eg').onclick = () => fake($('d-e').value);
    $('d-sg').onclick = () => { if (st) { SN.apply(st, $('d-s').value); applyLook(); } };
    $('d-a').onchange = (e) => { dbgAll = e.target.checked; };
    $('d-r').onclick = () => { read = {}; save(K.r, read); toast('既読を消去'); };
    $('d-x').onclick = () => { rec = { open: 1, g1: 1, g2: 1, g3: 1, d2: 1 }; save(K.d, rec); toast('記録を全開放'); };
    $('d-h').onclick = () => { dbg.className = ''; };
  }

  window.addEventListener('resize', () => { if (st && !busy) renderPage(); });

  toTitle();
})();
