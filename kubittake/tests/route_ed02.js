'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed02', picks: { 'ch15-c3': '#x0' }, rest: 'p2', vars: { p1: 0, p2: 29, p3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
