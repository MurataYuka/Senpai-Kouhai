/* 作品ごとの演出の差し込み口。使わないものは消してよい（全部省略しても動く）。
   各関数の最後の引数 ctx には次のものが入っている：
     ctx.state / ctx.vars / ctx.file   … いまの状態（書き換えない）
     ctx.skipping                      … スキップ中なら true
     ctx.restoring                     … セーブから復元中なら true（vis と onRestore）
     ctx.debug                         … ?debug=1 のとき true
     ctx.replaying                     … エンディング一覧・ゲームオーバー一覧からの再生中なら true
     ctx.back / ctx.bg / ctx.layer     … テキストボックスの後ろのレイヤー（#back / #bg / #fxLayer）
     ctx.frame                         … 枠（#frame）
     ctx.shake() / ctx.flash()         … 枠と奥だけを揺らす／光らせる
     ctx.toast(文)                     … 画面上部に短い通知
   本文（#box / #lines）は揺らさないこと。 */
window.ADV_EFFECTS = {

  // 起動時に一度だけ
  init: function (ctx) { },

  // タイトルに戻ったとき・新しく始める前・ロードの前に呼ばれる。演出を初期状態に戻す
  onReset: function (ctx) {
    ctx.layer.className = '';
  },

  // 章（シナリオファイル）の開始時：はじめから／@next・@goto で別ファイルへ／エンディング再生／デバッグの移動
  onChapter: function (file, ctx) {
    if (ctx.debug) console.log('[sample] 章の開始: ' + file);
  },

  // ロードで状態を戻した直後（vis の復元の後）
  onRestore: function (ctx) { },

  // パラメータが変わったとき（選択肢の効果・@set）
  onParam: function (name, value, prev, ctx) {
    if (ctx.debug) console.log('[sample] ' + name + ': ' + prev + ' → ' + value);
  },

  // @mark 名前 引数 の行に来たとき（その次の文が出る直前）
  onMark: function (id, arg, ctx) {
    if (id === 'm1' && !ctx.skipping) ctx.flash();
  },

  // 文が一行出るたび（使わなければ消す）
  onText: function (text, ctx) { },

  // ゲームオーバー（任意機能。config.gameovers.enabled が true のときだけ呼ばれる）
  // @gameover に入ったとき（ver は 'a' か 'b'。この時点で回収記録が付いている）
  onGameover: function (id, ver, ctx) {
    if (ctx.debug) console.log('[sample] ゲームオーバー: ' + id + ' 版' + ver.toUpperCase());
  },
  // ゲームオーバー画面を出したとき（一覧からの再生では出ない）
  onOverScreen: function (id, ver, ctx) { },
  // @altopen に初めて到達したとき
  onAltOpen: function (ctx) { },

  // @vis 名前 値：状態として残る見た目。セーブに入り、ロード時にも呼ばれる（ctx.restoring）。
  // ここに書かなくても body に data-v-名前="値" が付くので、CSS だけで見た目を変えられる
  vis: {
    bg: function (value, ctx) { }
  },

  // @fx 名前 引数：一時的な演出。スキップ中は呼ばれない。組み込みの shake / flash も上書きできる
  fx: {
    pulse: function (arg, ctx) {
      var f = ctx.frame;
      f.classList.remove('pulse'); void f.offsetWidth; f.classList.add('pulse');
      setTimeout(function () { f.classList.remove('pulse'); }, 1100);
    }
  },

  // 作品独自の @命令（config.commands に名前を書いておく）
  commands: {
    glow: function (arg, ctx) { ctx.layer.classList.toggle('glow', arg === 'on'); }
  }
};
