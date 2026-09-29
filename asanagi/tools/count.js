/* 文字数（空白を除く）と目標との比較。引数でファイルを絞れる */
'use strict';
const { Core, loaded } = require('./load');
const only = process.argv.slice(2);
const target = n => (n === 'ed07' || n === 'ed08') ? 6000 : n.startsWith('ed') ? 3500 : 7000;
let bad = 0;
for (const n of loaded) {
  if (only.length && !only.includes(n)) continue;
  const c = Core.countText(n), t = target(n);
  const ok = c >= t * 0.85 && c <= t * 1.15;
  if (!ok) bad++;
  console.log(`${n}\t${c}字\t目標${t}\t${ok ? 'OK' : (c < t ? '不足' : '超過')}`);
}
process.exitCode = bad ? 1 : 0;
