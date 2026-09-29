// 点検用の共通処理（Node）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const FILES = [];
for (let i = 1; i <= 15; i++) FILES.push('ch' + String(i).padStart(2, '0'));
for (let i = 1; i <= 9; i++) FILES.push('ed' + i);

function load() {
  delete globalThis.SN;
  Object.keys(require.cache).forEach((k) => { if (k.startsWith(ROOT)) delete require.cache[k]; });
  const SN = require(path.join(ROOT, 'js', 'core.js'));
  globalThis.SN = SN;
  require(path.join(ROOT, 'data', 'ends.js'));
  require(path.join(ROOT, 'data', 'rec.js'));
  FILES.forEach((f) => {
    const p = path.join(ROOT, 'data', f + '.js');
    if (fs.existsSync(p)) require(p);
  });
  SN.compile();
  return SN;
}

function srcLines(f) {
  const p = path.join(ROOT, 'data', f + '.js');
  if (!fs.existsSync(p)) return null;
  const s = fs.readFileSync(p, 'utf8');
  const a = s.indexOf('`'), b = s.lastIndexOf('`');
  return s.slice(a + 1, b).split(/\r?\n/);
}

function isText(line) {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith('//') || t[0] === '*' || t[0] === '@' || t[0] === '+' || t[0] === '~' || t === '---') return false;
  return true;
}

function plain(t) { return t.replace(/\[\[w\|(.+?)\]\]/g, '$1').replace(/\{N\}/g, '結夏'); }
function count(t) { return plain(t).replace(/\s/g, '').length; }

module.exports = { ROOT, FILES, load, srcLines, isText, plain, count };
