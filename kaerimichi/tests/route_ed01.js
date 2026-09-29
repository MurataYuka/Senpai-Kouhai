'use strict';
const { route, runMain } = require('./lib');
// 主な選択肢をすべて p1、小さな選択肢は p1 があれば p1、入る、真実
const spec = { ed: 'ed01', picks: ['p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 0, 'p1', 'p1', 1, 1], vars: { p1: 29, p2: 1, p3: 0, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
