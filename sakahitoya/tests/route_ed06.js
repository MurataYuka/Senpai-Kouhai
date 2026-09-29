'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed06', picks: { 'ch13-c2': 'f2', 'ch14-c2': 1 }, rest: 'p1', vars: { f1: 0, f2: 1, f3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
