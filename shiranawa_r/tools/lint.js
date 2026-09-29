// 本文の自動点検。node tools/lint.js [ファイル名...]
//  1) 地の文（カギカッコの外）の「敬語」「口調」「声で」「調子で」
//  2) 使わない言い回し
//  3) 印の付いた語の一覧と、人名・地名に付いていないかの確認
//  4) 印のない「白」（見落としの候補）
const { FILES, srcLines, isText } = require('./lib');

const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const showMarks = process.argv.includes('-m');
const list = want.length ? want : FILES;

function outside(t) {
  // 「」と『』の中を取り除く（入れ子も含めて）
  let out = '', d = 0;
  for (const c of t) {
    if (c === '「' || c === '『') { d++; continue; }
    if (c === '」' || c === '』') { d = Math.max(0, d - 1); continue; }
    if (d === 0) out += c;
  }
  return out;
}

const TONE = /敬語|口調|声で|調子で/;
const BAN = [
  [/天気の話をするみたい/, '天気の話'],
  [/紙のよう/, '紙のよう'],
  [/([一-龠ぁ-ん]{1,3})かった。\1すぎた/, '早かった型'],
  [/[一二三四五六七八九十]文字/, '文字数を数える'],
];

let nTone = 0, nBan = 0, nMarkBad = 0;
const marks = {};
const loose = [];
list.forEach((f) => {
  const L = srcLines(f);
  if (!L) return;
  L.forEach((l, i) => {
    if (!isText(l)) return;
    const t = l.trim();
    const o = outside(t);
    if (TONE.test(o)) { nTone++; console.log('[口調] ' + f + ':' + (i + 1) + '  ' + t); }
    BAN.forEach(([re, name]) => { if (re.test(t)) { nBan++; console.log('[言い回し:' + name + '] ' + f + ':' + (i + 1) + '  ' + t); } });
    let m;
    const re = /\[\[w\|(.+?)\]\]/g;
    while ((m = re.exec(t))) {
      marks[m[1]] = (marks[m[1]] || 0) + 1;
      if (/白峯|白縄/.test(m[1])) { nMarkBad++; console.log('[印の誤り] ' + f + ':' + (i + 1) + '  ' + m[1]); }
    }
    const rest = o.replace(/\[\[w\|.+?\]\]/g, '').replace(/白峯|白縄/g, '');
    if (/白/.test(rest)) loose.push(f + ':' + (i + 1) + '  ' + t);
  });
});

if (showMarks) {
  console.log('\n--- 印の付いた語 ---');
  Object.keys(marks).sort().forEach((k) => console.log(k + '\t' + marks[k]));
  console.log('\n--- 地の文の、印のない「白」 ---');
  loose.forEach((x) => console.log(x));
}
console.log('\n口調の候補 ' + nTone + '件 / 言い回し ' + nBan + '件 / 印の誤り ' + nMarkBad + '件 / 印のない白 ' + loose.length + '件');
