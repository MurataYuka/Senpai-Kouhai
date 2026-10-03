'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed03', picks: { 'ch15-c1': '#a' }, rest: 'p3', vars: { p3: 28 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
