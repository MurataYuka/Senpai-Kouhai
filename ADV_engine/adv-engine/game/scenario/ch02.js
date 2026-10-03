ADV.add('ch02', `
// 動作確認用のダミー：第二章（条件分岐でエンディングが分かれる）
@title 第二章|サンプル
@vis bg b

第二章が始まりました。章の開始時に作品側の処理が呼ばれています。
@if p1 >= 1
一つ目を選んだ場合の差し込み文です。
@else
二つ目を選んだ場合の差し込み文です。
@endif
差し込みの後の共通の文です。
${ADV_CONFIG.gameovers.enabled && ADV_CONFIG.gameovers.alt.enabled ? '@altopen' : '// （版の切り替えがオンのときだけ、ここに @altopen が入る）'}
版の切り替えがオンのときは、この行の直前でゲームオーバー一覧の版の切り替えが解放されます。

@record r01
記録機能がオンのときは、この行で一件目の記録が解放されます。
@vis frame alert
枠の見た目が変わりました（@vis は状態としてセーブに残ります）。
@vis dim on
背景が暗くなりました。
@vis dim off
@vis frame off

@if p1 >= 1
@goto ed01
@else
@goto ed02
@endif
`);
