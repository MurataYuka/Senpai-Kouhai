/* dev.js — ?debug=1 のときだけ読み込まれる */
(function () {
  'use strict';
  var G = window.SZG, SZ = window.SZ, Core = window.Core;
  if (!G) return;

  var css = document.createElement('style');
  css.textContent =
    '#dv{position:fixed;left:8px;top:8px;z-index:99;background:rgba(0,0,0,.86);color:#cfe;font:12px/1.5 monospace;' +
    'border:1px solid #4a6;padding:6px 8px;max-width:300px;max-height:90vh;overflow:auto}' +
    '#dv button,#dv select,#dv input{font:11px monospace;background:#123;color:#cfe;border:1px solid #4a6;margin:1px;padding:1px 4px}' +
    '#dv .r{display:flex;gap:4px;align-items:center;flex-wrap:wrap}#dv b{color:#fc6}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'dv';
  box.innerHTML =
    '<div class="r"><b>DEBUG</b><button data-d="fold">_</button></div>' +
    '<div id="dv-b">' +
    '<div id="dv-s"></div>' +
    '<div class="r">v1<button data-d="v1-">-</button><button data-d="v1+">+</button>' +
    ' v2<button data-d="v2-">-</button><button data-d="v2+">+</button>' +
    ' v3<button data-d="v3-">-</button><button data-d="v3+">+</button></div>' +
    '<div class="r"><input id="dv-f" size="6" placeholder="flag"><button data-d="flag">toggle</button></div>' +
    '<div class="r"><select id="dv-c"></select><button data-d="jump">章へ</button></div>' +
    '<div class="r"><button data-d="all">全回収</button><button data-d="clr">回収消去</button><button data-d="seen">既読消去</button></div>' +
    '</div>';
  document.body.appendChild(box);

  var sel = box.querySelector('#dv-c');
  SZ.order.forEach(function (id) {
    var o = document.createElement('option');
    o.value = id;
    o.textContent = id;
    sel.appendChild(o);
  });

  function update() {
    var r = G.run, s = box.querySelector('#dv-s');
    if (!r) { s.textContent = '(title)'; return; }
    var st = r.st;
    s.innerHTML = '';
    var lines = [
      'at ' + st.sc + ':' + st.i + '  ch=' + st.ch,
      'v1=' + st.v.v1 + ' v2=' + st.v.v2 + ' v3=' + st.v.v3 + ' kc=' + Core.val(st, 'kc'),
      'f: ' + Object.keys(st.f).sort().join(' '),
      'ab: ' + st.ab.join(' '),
      'rk: ' + JSON.stringify(st.rk || {}),
      'lv: ' + st.lv
    ];
    lines.forEach(function (l) { var d = document.createElement('div'); d.textContent = l; s.appendChild(d); });
  }

  box.addEventListener('click', function (e) {
    e.stopPropagation();
    var b = e.target.closest('[data-d]');
    if (!b) return;
    var d = b.getAttribute('data-d'), r = G.run, m;
    if (d === 'fold') { var bd = box.querySelector('#dv-b'); bd.hidden = !bd.hidden; return; }
    if ((m = /^(v\d)([+-])$/.exec(d)) && r) r.st.v[m[1]] += (m[2] === '+' ? 1 : -1);
    if (d === 'flag' && r) {
      var f = box.querySelector('#dv-f').value.trim();
      if (/^\w+$/.test(f)) { if (r.st.f[f]) delete r.st.f[f]; else r.st.f[f] = 1; }
    }
    if (d === 'jump') G.jump(sel.value, r ? r.st : null);
    if (d === 'all') {
      SZ.meta.ends.forEach(function (x) { G.rec.e[x[0]] = 1; });
      SZ.meta.xs.forEach(function (x) { G.rec.x[x] = 1; });
      G.saveRec();
    }
    if (d === 'clr') { G.rec.e = {}; G.rec.x = {}; G.saveRec(); }
    if (d === 'seen') G.clearSeen();
    update();
  });
  box.addEventListener('keydown', function (e) { e.stopPropagation(); });

  window.SZG_DEV = { update: update };
  setInterval(update, 700);
  update();
})();
