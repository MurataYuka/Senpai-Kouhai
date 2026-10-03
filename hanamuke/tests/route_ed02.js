'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed02', picks: ['#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 'p2', '#S1', 2, 'p2'], vars: { p1: 0, p2: 15, p3: 0, p4: 3 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
