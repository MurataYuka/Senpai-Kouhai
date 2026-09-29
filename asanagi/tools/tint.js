/* 行頭が指定の文字列で始まる行に「~」を付ける：node tools/tint.js ch01 "「ようこそ" "「律くん" ... */
'use strict';
const fs = require('fs');
const path = require('path');
const [name, ...heads] = process.argv.slice(2);
const p = path.join(__dirname, '..', 'data', name + '.js');
const lines = fs.readFileSync(p, 'utf8').split('\n');
for (const h of heads) {
  const i = lines.findIndex(l => l.startsWith(h));
  if (i < 0) console.log('見つからない: ' + h);
  else lines[i] = '~' + lines[i];
}
fs.writeFileSync(p, lines.join('\n'));
console.log(lines.filter(l => l.startsWith('~')).length + ' 行');
