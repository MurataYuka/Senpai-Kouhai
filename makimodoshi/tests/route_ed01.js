'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: { 'ch14-d1': '#x', 'ch15-d2': '#a' }, rest: 'p1', vars: { p1: 21, p2: 0, p3: 0, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
