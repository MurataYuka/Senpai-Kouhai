'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed05', picks: { 'ch14-d1': '#y', 'ch15-d2': '#b' }, rest: 'p1', vars: { p1: 21, p2: 0, p3: 0, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
