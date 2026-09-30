'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed03', picks: ['p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', '#go', 'p3', 'p3', '#home'], vars: { p1: 0, p2: 0, p3: 14, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
