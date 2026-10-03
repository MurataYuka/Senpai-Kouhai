'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed04', picks: { 'ch15-c1': '#b' }, rest: 'p1', vars: { p1: 28 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
