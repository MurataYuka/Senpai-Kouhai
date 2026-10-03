'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed05', picks: ['#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 0], vars: { p1: 0, p2: 13, p3: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
