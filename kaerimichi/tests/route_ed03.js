'use strict';
const { route, runMain } = require('./lib');
// 主な選択肢をすべて p3、小さな選択肢は p3 があれば p3、入らない
const spec = { ed: 'ed03', picks: ['p3', 'p3', 'p3', 'p3', 'p3', 0, 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 0], vars: { p1: 1, p2: 0, p3: 29, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
