'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed04', picks: ['p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', '#solo'], vars: { p1: 12, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
