'use strict';
const { route, runMain } = require('./lib');
// 主な選択肢をすべて p1、入らない（p3 <= 3）
const spec = { ed: 'ed05', picks: ['p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 0, 'p1', 'p1', 0], vars: { p1: 29, p2: 1, p3: 0, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
