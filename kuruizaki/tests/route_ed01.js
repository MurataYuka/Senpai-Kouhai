'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: { 'ch13-c1': 'p1', 'ch15-c1': '#home' }, rest: 'p1', vars: { p1: 27, p2: 0, p3: 0, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
