'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed05', picks: { 'ch13-c1': 'p1', 'ch15-c1': '#e5' }, rest: 'p1' };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
