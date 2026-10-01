'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed06', picks: { 'ch14-d1': '#y', 'ch15-d2': '#c' }, rest: 'p2', vars: { p1: 0, p2: 21, p3: 0, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
