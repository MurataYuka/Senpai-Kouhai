'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed02', picks: ['p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', '#go', 'p2', 'p2', '#home'], vars: { p1: 0, p2: 14, p3: 0, f1: 0, f2: 1, f3: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
