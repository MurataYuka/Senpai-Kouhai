'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed02', picks: { 'ch01-q1': 0, 'ch08-q2': 1, 'ch14-q1': 1, 'ch15-q1': 1 }, rest: 'p2', vars: { p1: 0, p2: 12, p3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
