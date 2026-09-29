/* 通し点検：禁止表現、▷の一文ルール、主人公のカギカッコ、選択肢一覧、言い回しの繰り返し */
'use strict';
const { Core, loaded } = require('./load');
const mode = process.argv[2] || 'all';

const texts = [];
for (const n of loaded) {
  Core.files[n].code.forEach((ins, pc) => {
    if (ins.t === 'text') texts.push({ f: n, pc, line: ins.line, s: ins.s });
  });
}

if (mode === 'all' || mode === 'ban') {
  const BAN = [/天気の話をするみたい/, /紙のよう/, /早かった。早すぎた/, /(.{1,4})かった。\1すぎた/, /その[一二三四五六七八九十〇]+文字/];
  let n = 0;
  for (const t of texts) for (const re of BAN) if (re.test(t.s)) { n++; console.log(`[禁止] ${t.f} 行${t.line}: ${t.s}`); }
  console.log(`禁止表現：${n}件`);
}

if (mode === 'all' || mode === 'me') {
  let a = 0, b = 0;
  for (const t of texts) {
    if (t.s.startsWith('▷')) {
      const k = (t.s.match(/。/g) || []).length;
      if (k > 1) { a++; console.log(`[▷二文以上] ${t.f} 行${t.line}: ${t.s}`); }
    } else if (/あなた[はが、][^。]*「|」と、?あなたは/.test(t.s)) {
      b++; console.log(`[主人公の「」?] ${t.f} 行${t.line}: ${t.s}`);
    }
  }
  console.log(`▷二文以上：${a}件　主人公の「」の疑い：${b}件`);
}

if (mode === 'all' || mode === 'choice') {
  console.log('--- 選択肢一覧');
  for (const n of loaded) Core.files[n].code.forEach(ins => {
    if (ins.t === 'choice') ins.opts.forEach((o, i) => console.log(`${ins.id}\t${i + 1}\t${o.eff.map(e => e.v + e.op + e.n).concat(o.tags.map(t => '#' + t)).join(',') || '-'}\t${o.text}`));
  });
}

if (mode === 'all' || mode === 'rep') {
  const L = Number(process.argv[3] || 10);
  const map = new Map();
  for (const t of texts) {
    const s = t.s.replace(/[「」『』▷、。…！？\s]/g, '');
    const seen = new Set();
    for (let i = 0; i + L <= s.length; i++) {
      const g = s.slice(i, i + L);
      if (seen.has(g)) continue;
      seen.add(g);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(t.f + ':' + t.line);
    }
  }
  const rows = [...map.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => b[1].length - a[1].length);
  // 重なりの多い部分列は代表だけ出す
  const out = [];
  for (const [g, v] of rows) {
    if (out.some(([h, w]) => (h.includes(g.slice(1)) || h.includes(g.slice(0, -1))) && w.length === v.length)) continue;
    out.push([g, v]);
  }
  console.log('--- ' + L + '字以上の繰り返し（3回以上）');
  out.slice(0, 120).forEach(([g, v]) => console.log(`${v.length}\t${g}\t${v.slice(0, 6).join(' ')}`));
}
