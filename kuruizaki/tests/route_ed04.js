'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed04', picks: { 'ch13-c1': '#bad' }, rest: 'p1' };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
