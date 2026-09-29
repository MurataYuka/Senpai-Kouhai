'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed05', picks: { 'ch13-c2': 'f1', 'ch14-c2': 1 }, rest: 'p1', vars: { f1: 1, f2: 0, f3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
