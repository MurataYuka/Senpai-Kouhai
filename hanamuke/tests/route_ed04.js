'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed04', picks: ['#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 3], vars: { p1: 13, p2: 0, p3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
