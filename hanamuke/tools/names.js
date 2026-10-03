/* 地の文の呼び名の点検：node tools/names.js [--all]
   カギカッコ（「」『』）の外、かつ ▷ の行の外にある {name}・後輩の本名・「先輩」を、ファイル名と行番号つきで書き出す。
   切り替え位置（docs/secret/notes.md）より前に出ているものを「違反」として数える。--all で許される出現も全部並べる。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loaded, args, output } = require('./load');
const { opt } = args();
const out = output(opt);
const DIR = path.join(__dirname, '..', 'game', 'scenario');

const KOUHAI = ['芹川', '渉'];
const order = n => {
  const m = /^(ch|g)(\d+)/.exec(n);
  return m ? Number(m[2]) : 99;   // エンディングは最後
};

function narration(line) {
  if (line.startsWith('▷')) return '';
  let s = '', depth = 0;
  for (const ch of line) {
    if (ch === '「' || ch === '『') { depth++; continue; }
    if ((ch === '」' || ch === '』') && depth > 0) { depth--; continue; }
    if (!depth) s += ch;
  }
  return s;
}

let bad = 0, seen = 0;
for (const n of loaded) {
  const lines = fs.readFileSync(path.join(DIR, n + '.js'), 'utf8').split(/\r?\n/);
  const no = order(n);
  const go = /^g\d/.test(n);
  // 第十章の切り替え位置より後か（ゲームオーバーは、その場面が起きる章で決める）
  let afterName = go ? no >= 10 : no > 10;
  // 第十二章の「渉」と呼ぶ行より後か（先輩の側の地の文）
  let afterWataru = go ? no >= 12 : no > 12;
  let pov = false;                  // 渉の目線の場面
  let povWataru = false;            // 渉の目線で、記憶が戻った後
  if (/^ed/.test(n)) { afterName = true; afterWataru = true; }
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (/^@vis pov s/.test(line)) { pov = true; povWataru = no >= 10; }
    if (/^@vis pov off/.test(line)) { pov = false; }
    if (line.startsWith('@') || line.startsWith('//') || line.startsWith('*') || line.startsWith('+')) {
      // 選択肢の文面も地の文として見る
      if (!line.startsWith('+')) return;
    }
    if (n === 'ch10' && line.includes('花嫁の名前は、{name}といった。')) { afterName = true; return; }
    if (n === 'ch09' && line === '芹川、渉。') { povWataru = true; }
    if (n === 'ch12' && line === 'その一言だった。') { afterWataru = true; }
    const text = line.startsWith('+') ? line.replace(/^\+[^|]*\|\s*/, '') : narration(line);
    const hits = [];
    if (text.includes('{name}')) hits.push(['{name}', !afterName]);
    for (const k of KOUHAI) if (text.includes(k)) {
      const ok = afterWataru || (pov && povWataru);
      hits.push([k, !ok]);
    }
    if (text.includes('先輩')) hits.push(['先輩', true]);
    for (const [w, v] of hits) {
      seen++;
      if (v) bad++;
      if (v || opt.all) out.log(`${v ? '違反' : '　　'}  ${n} 行${i + 1}  【${w}】  ${line}`);
    }
  });
}
out.log(`地の文の呼び名：出現 ${seen} 件、切り替え位置より前・地の文の「先輩」 ${bad} 件`);
out.done();
process.exitCode = bad ? 1 : 0;
