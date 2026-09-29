/* 起動：設定を点検し、シナリオ → 作品の演出 → 画面 の順に読み込む。
   <script> を順に差し込むだけなので、index.html をダブルクリックで開いても動く。 */
(function () {
  'use strict';
  var C = window.ADV;
  var dead = false;

  function fatal(msgs) {
    var el = document.getElementById('fatal');
    el.hidden = false;
    el.innerHTML = '';
    var h = document.createElement('h2');
    h.textContent = '起動できませんでした';
    el.appendChild(h);
    msgs.forEach(function (m) {
      var p = document.createElement('p');
      p.textContent = m;
      el.appendChild(p);
    });
    var t = document.getElementById('titleScr');
    if (t) t.hidden = true;
    dead = true;
    throw new Error(msgs.join(' / '));
  }
  window.ADV_FATAL = function (m) { fatal([m]); };

  if (!C) fatal(['engine/core.js が読み込まれていません。']);
  var errs = C.checkConfig();
  if (errs.length) fatal(errs);

  var cfg = window.ADV_CONFIG;
  var list = cfg.files.map(function (n) { return 'game/scenario/' + n + '.js'; });
  if (cfg.records && cfg.records.enabled) list.push('game/scenario/' + (cfg.records.file || 'records') + '.js');
  list.push('game/effects.js', 'engine/ui.js');

  var i = 0;
  function nextScript() {
    if (i >= list.length) return;
    var src = list[i++];
    var s = document.createElement('script');
    s.src = src;
    s.onload = nextScript;
    s.onerror = function () { fatal(['ファイルを読み込めませんでした：' + src]); };
    document.body.appendChild(s);
  }
  // 読み込み中のエラー（シナリオの書式エラーなど）は画面に出す。起動後のエラーは ui.js が扱う
  function onErr(e) {
    if (window.ADV_READY || dead) return;
    var el = document.getElementById('fatal');
    if (el.hidden) el.innerHTML = '<h2>起動できませんでした</h2>';
    el.hidden = false;
    var p = document.createElement('p');
    var file = e.filename && !/core\.js$/.test(e.filename) ? '（' + e.filename.split('/').slice(-2).join('/') + '）' : '';
    p.textContent = String(e.message || e).replace(/^(Uncaught )?Error: /, '') + file;
    el.appendChild(p);
    var t = document.getElementById('titleScr');
    if (t) t.hidden = true;
  }
  window.addEventListener('error', onErr);
  nextScript();
})();
