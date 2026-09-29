'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed03', picks: { 'ch13-c2': 0, 'ch14-c2': 1 }, rest: 'p3', vars: { p1: 0, p2: 0, p3: 19, f1: 0, f2: 0, f3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
