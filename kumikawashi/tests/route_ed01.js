'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: ['p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', '#go', 'p1', 'p1', '#home'], vars: { p1: 14, p2: 0, p3: 0, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
