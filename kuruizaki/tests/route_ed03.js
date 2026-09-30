'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed03', picks: { 'ch15-c1': '#home' }, rest: 'p3', vars: { p1: 0, p2: 0, p3: 27, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
