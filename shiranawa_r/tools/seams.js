// 分岐から合流への継ぎ目を書き出す。node tools/seams.js ch03 [出力先]
// 各選択肢について「分岐の文 → 合流後の文」を、いくつかの到達状態で並べる。
const fs = require('fs');
const { load, srcLines } = require('./lib');
const SN = load();
SN.glob = () => ({ all: 1 });

const f = process.argv[2];
const outPath = process.argv[3];
const L = srcLines(f);
const labs = new Set(L.filter((l) => l.trim()[0] === '*').map((l) => l.trim().slice(1)));

function clone(s) { return JSON.parse(JSON.stringify(s)); }

// 方針 k：各選択肢で、選べる中の (k + 何番目か) 番を選ぶ
function arrive(policy, targetPc) {
  const st = SN.fresh('結夏');
  let n = 0;
  for (let g = 0; g < 200000; g++) {
    if (st.pc === targetPc) return st;
    const e = SN.step(st);
    if (e.t === 'ch') {
      if (st.pc === targetPc) return st;
      const opts = SN.options(st, e.op).filter((o) => !o.off);
      const pick = opts[(policy + n) % opts.length];
      n += policy === 0 ? 0 : 1;
      SN.choose(st, e.op, pick.i);
    }
    if (e.t === 'end' || e.t === 'over' || e.t === 'eof') return null;
  }
  return null;
}

function trace(st) {
  const out = [];
  for (let g = 0; g < 5000 && out.length < 90; g++) {
    const e = SN.step(st);
    if (e.t === 'tx') out.push({ pc: st.pc - 1, s: e.op.s });
    else if (e.t === 'ch') { out.push({ pc: -1, s: '〔次の選択肢 ' + e.op.id + '〕' }); break; }
    else if (e.t === 'end') { out.push({ pc: -1, s: '〔エンディング ' + e.id + '〕' }); break; }
    else if (e.t === 'over') { out.push({ pc: -1, s: '〔ゲームオーバー〕' }); break; }
    else if (e.t === 'chap') out.push({ pc: -2, s: '〔章 ' + e.n + '〕' });
    else if (e.t === 'lose') out.push({ pc: -2, s: '〔喪失 ' + e.k + '〕' });
    else if (e.t === 'page') out.push({ pc: -2, s: '〔頁 ' + e.g + '〕' });
    else if (e.t === 'eof') break;
  }
  return out;
}

const lines = [];
let seams = 0;
SN.prog.forEach((op, pc) => {
  if (op.t !== 'ch' || !labs.has(op.l)) return;
  const seen = new Set();
  for (let policy = 0; policy < 4; policy++) {
    const base = arrive(policy, pc);
    if (!base) continue;
    const opts = SN.options(base, op).filter((o) => !o.off);
    const paths = opts.map((o) => { const s = clone(base); SN.choose(s, op, o.i); return { o, p: trace(s), v: s.v }; });
    const sets = paths.map((x) => new Set(x.p.filter((y) => y.pc >= 0).map((y) => y.pc)));
    let merge = -1;
    for (const y of paths[0].p) { if (y.pc >= 0 && sets.every((S) => S.has(y.pc))) { merge = y.pc; break; } }
    const block = [];
    paths.forEach((x) => {
      block.push('--- 「' + x.o.s + '」');
      let after = -1;
      for (const y of x.p) {
        if (y.pc === merge && after < 0) { after = 0; block.push('   ‖ 合流'); }
        block.push((after >= 0 ? '   ' : ' ') + y.s);
        if (after >= 0 && ++after >= 6) break;
      }
    });
    const key = block.join('\n');
    if (seen.has(key)) continue;
    seen.add(key);
    seams += paths.length;
    const v = base.v;
    lines.push('=== ' + op.id + '　（到達状態 p1=' + v.p1 + ' p2=' + v.p2 + ' p3=' + v.p3 + ' p4=' + v.p4 + ' m1=' + v.m1 + ' m2=' + v.m2 + ' m3=' + v.m3 + ' f1=' + v.f1 + ' f2=' + v.f2 + ' k=' + base.k.join(',') + '）');
    lines.push(key, '');
  }
});
const text = lines.join('\n') + '\n継ぎ目（選択肢×到達状態） ' + seams + '\n';
if (outPath) fs.writeFileSync(outPath, text); else process.stdout.write(text);
console.error(f + ': 継ぎ目 ' + seams);
