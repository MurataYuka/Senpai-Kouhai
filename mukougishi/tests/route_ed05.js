'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed05', picks: { 'ch01-q1': 1, 'ch08-q2': 0, 'ch14-q1': 1, 'ch15-q1': 2 }, rest: 'p1', vars: { p1: 12, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
