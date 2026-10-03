'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed04', picks: { 'ch12-c1': '#x4' }, rest: 'p1', vars: { p1: 22, p2: 0, p3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
