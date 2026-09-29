'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: { 'ch13-c2': 0, 'ch14-c2': 1 }, rest: 'p1', vars: { p1: 19, p2: 0, p3: 0, f1: 0, f2: 0, f3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
