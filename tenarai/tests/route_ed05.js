'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed05', picks: { 'ch15-c1': '#c' }, rest: 'p2', vars: { p2: 28 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
