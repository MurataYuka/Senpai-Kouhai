/* 到達の確認：選択肢を総当たりして、
   ・各パラメータの取りうる最小値・最大値
   ・各本編エンディングに通常プレイで到達できるか（到達する選び方の例つき）
   ・追加エンディングの解放条件が満たせるか、単体で最後まで再生できるか
   ・一度も通らないシナリオファイル、設定にないエンディング
   を報告する。同じ地点・同じパラメータの組は一度だけ調べる。
   使い方：node tools/reach.js [--max 200000] [--out reach.txt] */
'use strict';
const { Core, CFG, TOOLS, args, output } = require('./load');
const { opt } = args();
const out = output(opt);
const MAX = Number(opt.max || TOOLS.maxStates);

function explore(start) {
  const range = {}, hit = {}, errors = [], files = new Set();
  const upd = (k, v) => {
    range[k] = range[k] || [Infinity, -Infinity];
    if (v < range[k][0]) range[k][0] = v;
    if (v > range[k][1]) range[k][1] = v;
  };
  for (const k in start.vars) upd(k, start.vars[k]);
  const hooks = { param: (k, v) => upd(k, v), chapter: f => files.add(f) };
  const seen = new Set();
  const stack = [{ st: start, trail: [], picks: [] }];
  let states = 0, truncated = false;
  files.add(start.file);
  while (stack.length) {
    const { st, trail, picks } = stack.pop();
    try {
      for (let steps = 0; ; steps++) {
        if (steps > 1e6) throw new Error('選択肢のない繰り返し');
        const ev = Core.run(st, hooks);
        if (ev.type === 'text') { Core.advance(st); continue; }
        if (ev.type === 'end') {
          if (!hit[ev.ed]) hit[ev.ed] = { n: 0, trail, picks, vars: Object.assign({}, st.vars) };
          hit[ev.ed].n++;
          break;
        }
        const k = st.file + ':' + st.pc + ':' + JSON.stringify(st.vars);
        if (seen.has(k)) break;
        seen.add(k);
        if (++states > MAX) { truncated = true; break; }
        ev.ins.opts.forEach((o, i) => {
          const c = Core.clone(st);
          Core.choose(c, i, hooks);
          stack.push({ st: c, trail: trail.concat(ev.ins.id + '=' + (i + 1)), picks: picks.concat(i) });
        });
        break;
      }
    } catch (e) {
      errors.push(e.message + '（選び方: ' + (trail.join(' ') || 'なし') + '）');
    }
    if (truncated) break;
  }
  return { range, hit, errors, files, states, truncated };
}

let bad = 0;
const main = Core.mainEnds(), extra = Core.extraEnds();
const r = explore(Core.newState('テスト'));

out.log('調べた選択肢の状態：' + r.states + (r.truncated ? '（上限 ' + MAX + ' で打ち切り。結果は不完全）' : ''));
if (r.truncated) bad++;

out.log('--- パラメータの取りうる範囲（通常プレイ）');
for (const k of Core.varNames()) {
  const d = CFG.vars[k] || {};
  const lim = (typeof d.min === 'number' || typeof d.max === 'number') ? `　設定範囲 ${d.min ?? '-'}〜${d.max ?? '-'}` : '';
  const g = r.range[k] || [d.init || 0, d.init || 0];
  out.log(`${k}\t最小 ${g[0]}\t最大 ${g[1]}\t初期値 ${d.init || 0}${lim}`);
}

out.log('--- 本編エンディング');
for (const ed of main) {
  const h = r.hit[ed];
  if (!h) { bad++; out.log(`${ed}\t×　到達できない`); continue; }
  out.log(`${ed}\t○　到達する選び方 ${h.n} 通り以上　例：${h.trail.join(' ') || '（選択肢なし）'}　picks: [${h.picks.join(', ')}]　終了時 ${JSON.stringify(h.vars)}`);
}
const stray = Object.keys(r.hit).filter(e => !main.includes(e));
if (stray.length) {
  out.log('--- 設定の endings.main にないのに本編から到達するエンディング');
  stray.forEach(e => { bad++; out.log(`${e}\t例：${r.hit[e].trail.join(' ')}`); });
}

if (extra.length) {
  out.log('--- 追加エンディング');
  const got = {};
  main.forEach(e => { if (r.hit[e]) got[e] = true; });
  const unlock = Core.extraUnlocked(got);
  out.log('解放条件：' + (unlock ? '○ 到達できる本編エンディングで満たせる' : '× 満たせない'));
  if (!unlock) bad++;
  for (const ed of extra) {
    if (!Core.files[ed]) { bad++; out.log(`${ed}\t×　シナリオファイルがない`); continue; }
    const s = Core.newState('テスト');
    s.file = ed; s.pc = 0;
    const x = explore(s);
    const ends = Object.keys(x.hit);
    const ok = ends.length === 1 && ends[0] === ed && !x.errors.length;
    if (!ok) bad++;
    out.log(`${ed}\t${ok ? '○' : '×'}　単体再生の行き先：${ends.join(', ') || 'なし'}`);
    x.errors.forEach(e => out.log('  エラー: ' + e));
  }
}

const unused = Object.keys(Core.files).filter(f => !r.files.has(f) && !extra.includes(f));
if (unused.length) out.log('--- 通常プレイで一度も通らないファイル：' + unused.join(', '));
if (r.errors.length) {
  out.log('--- 進行エラー');
  r.errors.slice(0, 50).forEach(e => { out.log(e); });
  bad += r.errors.length;
}
out.log(`本編エンディング到達：${main.filter(e => r.hit[e]).length}/${main.length}　問題 ${bad} 件`);
out.done();
process.exitCode = bad ? 1 : 0;
