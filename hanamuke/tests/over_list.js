/* ゲームオーバー一覧の再生・版の切り替えの解放前後・ボタンの出し分け：node tests/over_list.js */
'use strict';
const { overList, runMain } = require('./lib');
module.exports = () => overList();
runMain(module);
