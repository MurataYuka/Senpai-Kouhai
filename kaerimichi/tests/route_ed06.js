'use strict';
const { route, runMain } = require('./lib');
// 主な選択肢をすべて p2、入る、真実（p1 <= 3）
const spec = { ed: 'ed06', picks: ['p2', 0, 'p2', 'p2', 'p2', 0, 'p2', 'p2', 'p2', 'p2', 0, 'p2', 'p2', 'p2', 0, 'p2', 'p2', 1, 1], vars: { p1: 3, p2: 27, p3: 0, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
