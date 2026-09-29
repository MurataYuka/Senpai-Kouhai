/* ?debug=1 のときだけ読み込まれる */
(() => {
'use strict';
const g = window.__g;
if (!g) return;

const css = `
#dg-b{position:fixed;left:8px;bottom:8px;z-index:90;font:12px/1 monospace;background:#222;color:#ccc;border:1px solid #555;border-radius:3px;padding:6px 8px;opacity:.7}
#dg{position:fixed;left:8px;bottom:40px;z-index:90;width:min(340px,calc(100vw - 16px));max-height:70vh;overflow:auto;font:12px/1.5 monospace;background:rgba(20,20,22,.95);color:#ddd;border:1px solid #555;border-radius:4px;padding:10px}
#dg[hidden]{display:none}
#dg h4{margin:8px 0 4px;font-size:12px;color:#e7b467}
#dg button{font:12px monospace;background:#333;color:#ddd;border:1px solid #555;border-radius:2px;padding:2px 6px;margin:1px}
#dg input,#dg select{font:12px monospace;background:#111;color:#ddd;border:1px solid #555;padding:2px 4px}
#dg .row{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
#dg pre{margin:0;white-space:pre-wrap;word-break:break-all;color:#aaa}
`;
const st = document.createElement('style');
st.textContent = css;
document.head.append(st);

const btn = document.createElement('button');
btn.id = 'dg-b';
btn.textContent = 'dbg';
document.body.append(btn);

const p = document.createElement('div');
p.id = 'dg';
p.hidden = true;
p.innerHTML = `
<div class="row"><b>state</b> <span id="dg-pos"></span></div>
<pre id="dg-st"></pre>
<h4>値</h4>
<div class="row" id="dg-v"></div>
<h4>フラグ</h4>
<div class="row"><input id="dg-fk" placeholder="flag_01" size="9"><input id="dg-fv" placeholder="1" size="3"><button id="dg-fs">set</button></div>
<h4>章</h4>
<div class="row"><select id="dg-ch"></select><button id="dg-cj">jump</button></div>
<h4>場面</h4>
<div class="row"><input id="dg-sc" placeholder="ch1_s1" size="10"><input id="dg-si" placeholder="0" size="3"><button id="dg-sj">jump</button></div>
<h4>結末</h4>
<div class="row" id="dg-e"></div>
<h4>送り</h4>
<div class="row"><label><input type="checkbox" id="dg-all"> 未読も早送り</label></div>
`;
document.body.append(p);
for (const b of [btn, p]) {
  b.addEventListener('click', e => e.stopPropagation());
  b.addEventListener('keydown', e => e.stopPropagation());
}
btn.addEventListener('click', () => { p.hidden = !p.hidden; });

const $ = s => p.querySelector(s);

const vRow = $('#dg-v');
for (const k of Object.keys(g.INIT_V)) {
  const w = document.createElement('span');
  w.innerHTML = `${k} <button data-k="${k}" data-d="-1">-</button><b id="dg-${k}"></b><button data-k="${k}" data-d="1">+</button> `;
  vRow.append(w);
}
vRow.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !g.S) return;
  const k = b.dataset.k, [lo, hi] = g.LIM[k];
  g.S.v[k] = Math.max(lo, Math.min(hi, (g.S.v[k] || 0) + +b.dataset.d));
});

$('#dg-fs').addEventListener('click', () => {
  if (!g.S) return;
  const k = $('#dg-fk').value.trim();
  if (!k) return;
  const raw = $('#dg-fv').value.trim();
  const v = raw === '' ? 1 : isNaN(+raw) ? raw : +raw;
  if (v === 0) delete g.S.f[k]; else g.S.f[k] = v;
});

const sel = $('#dg-ch');
Object.keys(g.CHAP).sort((a, b) => a - b).forEach(n => {
  const o = document.createElement('option');
  o.value = n;
  o.textContent = n + ' ' + g.CHAP[n].title;
  sel.append(o);
});
$('#dg-cj').addEventListener('click', () => {
  const c = g.CHAP[sel.value];
  if (c) g.jump(c.start);
});
$('#dg-sj').addEventListener('click', () => {
  g.jump($('#dg-sc').value.trim(), +$('#dg-si').value || 0);
});

const eRow = $('#dg-e');
for (const id of g.END_IDS) {
  const b = document.createElement('button');
  b.textContent = id;
  b.addEventListener('click', () => {
    const e = g.ENDS[id];
    if (e && e.start) g.jump(e.start);
  });
  eRow.append(b);
}
$('#dg-all').addEventListener('change', e => { g.skipAll = e.target.checked; });

setInterval(() => {
  if (p.hidden) return;
  const S = g.S;
  $('#dg-pos').textContent = S ? `${S.sc}:${S.i}  ch${S.ch}  [${g.mode}]` : '(title)';
  for (const k of Object.keys(g.INIT_V)) $('#dg-' + k).textContent = S ? ' ' + S.v[k] + ' ' : ' - ';
  $('#dg-st').textContent = S ? 'f: ' + JSON.stringify(S.f) + '\nx: ' + JSON.stringify(S.x) : '';
}, 250);

/* シナリオを画面なしでたどる。picker(opts, st, n) は選ぶ番号を返す */
function sim(picker, start = 'ch1_s1', v0 = {}, f0 = {}) {
  const s = { sc: start, i: 0, v: { ...g.INIT_V, ...v0 }, f: { ...f0 } };
  const trace = [];
  const cl = (k, n) => g.LIM[k] ? Math.max(g.LIM[k][0], Math.min(g.LIM[k][1], n)) : n;
  const ops = o => {
    if (o.set) for (const k in o.set) { if (/^v\d+$/.test(k)) s.v[k] = cl(k, o.set[k]); else s.f[k] = o.set[k]; }
    if (o.add) for (const k in o.add) s.v[k] = cl(k, (s.v[k] || 0) + o.add[k]);
  };
  for (let n = 0; n < 500000; n++) {
    const arr = g.SCN[s.sc];
    if (!arr || s.i >= arr.length) return { end: null, at: s.sc, s, trace };
    const it = arr[s.i];
    if (typeof it === 'string') { s.i++; continue; }
    if (it.if && !it.if(s.v, s.f)) { s.i++; continue; }
    if (it.t != null) { s.i++; continue; }
    ops(it);
    if (it.c) {
      const opts = it.c.filter(c => !c.if || c.if(s.v, s.f));
      const k = picker(opts, s, trace.length);
      const c = opts[k];
      if (!c) return { end: null, at: s.sc + ':' + s.i, s, trace, err: 'no choice' };
      trace.push(k);
      ops(c);
      if (c.go) { s.sc = c.go; s.i = 0; } else s.i++;
      continue;
    }
    if (it.end) return { end: it.end, s, trace };
    if (it.go) { s.sc = it.go; s.i = 0; continue; }
    s.i++;
  }
  return { end: null, err: 'loop', s, trace };
}
g.sim = sim;
g.simRandom = (runs = 2000) => {
  const tally = {};
  for (let r = 0; r < runs; r++) {
    const res = sim(o => Math.floor(Math.random() * o.length));
    const k = res.end || ('stop@' + (res.at || res.err));
    tally[k] = (tally[k] || 0) + 1;
  }
  return tally;
};
})();
