'use strict';
const { route, runMain } = require('./lib');
// 第十四章で「書け」（f3）
const spec = { ed: 'ed04', picks: { 'ch13-c2': 0, 'ch14-c2': 'f3' }, rest: 'p1', vars: { f3: 1 } };
// 第十五章の最後の選択肢のあと、全部 8 未満（p1=7, p2=6, p3=6）
const spread = {
  ed: 'ed04',
  picks: ['p1', 'p1', 'p2', 'p2', 'p2', 'p1', 'p2', 'p3', 'p3', 'p2', 'p3', 'p3', 0, 'p3', 1, 'p1'],
  vars: { p1: 7, p2: 6, p3: 6, f1: 0, f2: 0, f3: 0 }
};
module.exports = () => { const a = route(spec); const b = route(spread); return a && b; };
module.exports.spec = spec;
runMain(module);
