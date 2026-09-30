'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed06', picks: { 'ch01-q1': 0, 'ch08-q2': 1, 'ch14-q1': 1, 'ch15-q1': 0 }, rest: 'p3', vars: { p3: 12, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
