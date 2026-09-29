'use strict';
const { route, runMain } = require('./lib');
// 主な選択肢をすべて p2、小さな選択肢は p2 があれば p2、入る、罪状
const spec = { ed: 'ed02', picks: ['p2', 'p1', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p1', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 1, 0], vars: { p1: 2, p2: 28, p3: 0, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
