/* 地の文（カギカッコの外）で、指定の語（初期値：敬語・口調・声で・調子で）を含む行を一覧にする。
   使い方：node tools/tone.js [ファイル名…] [--words 敬語,口調] [--out tone.txt]
   「」『』の中は除く（『』は「」の外にあっても台詞として扱う）。主人公の ▷ の行は地の文として調べる。 */
'use strict';
const { TOOLS, loaded, args, output, texts } = require('./load');
const { pos, opt } = args();
const out = output(opt);
const words = opt.words ? String(opt.words).split(',').map(s => s.trim()).filter(Boolean) : TOOLS.toneWords;
if (!words.length) { console.error('調べる語がありません（config.tools.toneWords）'); process.exit(1); }

/* カギカッコの中を同じ長さの空白に置き換える（入れ子と、行末で閉じていないものにも対応） */
function narration(s) {
  let depth = 0, r = '';
  for (const ch of s) {
    if (ch === '「' || ch === '『') { depth++; r += '　'; continue; }
    if ((ch === '」' || ch === '』') && depth > 0) { depth--; r += '　'; continue; }
    r += depth > 0 ? '　' : ch;
  }
  return r;
}

let n = 0;
const per = {};
for (const t of texts(pos.length ? pos : loaded)) {
  const nar = narration(t.s);
  const hit = words.filter(w => nar.includes(w));
  if (!hit.length) continue;
  n++;
  hit.forEach(w => { per[w] = (per[w] || 0) + 1; });
  // 当たった語を【】で示す（地の文の位置だけ）
  let mark = '', i = 0;
  const chars = [...t.s], nchars = [...nar];
  while (i < chars.length) {
    const w = hit.find(w => nchars.slice(i, i + [...w].length).join('') === w);
    if (w) { mark += '【' + w + '】'; i += [...w].length; } else { mark += chars[i]; i++; }
  }
  out.log(`${t.f} 行${t.line}\t${mark}`);
}
out.log(`該当 ${n} 行（${words.map(w => w + ' ' + (per[w] || 0)).join('、')}）`);
out.done();
