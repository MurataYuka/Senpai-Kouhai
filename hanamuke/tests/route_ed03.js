'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed03', picks: ['#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 2, 'p3'], vars: { p1: 0, p2: 0, p3: 15, p4: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
