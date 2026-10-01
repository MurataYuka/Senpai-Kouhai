'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed04', picks: { 'ch14-d1': '#z' }, rest: 'p1', vars: { p1: 20, p2: 0, p3: 0, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
