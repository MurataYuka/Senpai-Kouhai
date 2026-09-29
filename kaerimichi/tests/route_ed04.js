'use strict';
const { route, runMain } = require('./lib');
// 主な選択肢をすべて p3、入る、罪状（p3 >= 26、p2 <= 2）
const spec = { ed: 'ed04', picks: ['p3', 0, 'p3', 'p3', 'p3', 0, 'p3', 'p3', 'p3', 'p3', 0, 'p3', 'p3', 'p3', 0, 'p3', 'p3', 1, 0], vars: { p1: 3, p2: 1, p3: 26, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
