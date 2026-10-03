'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed03', picks: { 'ch12-c1': 'p1', 'ch15-c3': '#x0' }, rest: 'p3', vars: { p1: 1, p2: 0, p3: 28 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
