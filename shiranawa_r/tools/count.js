// 文字数の実測。node tools/count.js [ファイル名...]
const { FILES, srcLines, isText, count } = require('./lib');

const want = process.argv.slice(2);
const list = want.length ? want : FILES;
let bad = 0;
list.forEach((f) => {
  const L = srcLines(f);
  if (!L) return;
  let n = 0, scenes = 1;
  L.forEach((l) => { if (isText(l)) n += count(l.trim()); if (l.trim() === '---') scenes++; });
  const tgt = f.startsWith('ch') ? 7000 : (f === 'ed8' || f === 'ed9') ? 6000 : 3500;
  const lo = Math.round(tgt * 0.85), hi = Math.round(tgt * 1.15);
  const ok = n >= lo && n <= hi;
  if (!ok) bad++;
  console.log(f + '\t' + n + '字\t目標' + tgt + '(' + lo + '-' + hi + ')\t' + (ok ? 'OK' : '範囲外') + (f.startsWith('ed') ? '\t場面' + scenes : ''));
});
process.exitCode = bad ? 1 : 0;
