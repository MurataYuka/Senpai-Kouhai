'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: { 'ch15-c3': '#x0' }, rest: 'p1', vars: { p1: 29, p2: 0, p3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
