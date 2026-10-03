'use strict';
const { overRoute, runMain } = require('./lib');
const spec = { go: 'g13', ver: 'b', picks: ['#S2', 'p2', '#S1', 'p2', '#S2', 'p2', '#S1', 'p2', '#S2', 'p2', '#S1', 'p2', '#S2', 'p2', '#S1', 'p2', '#S2', 'p2', '#S1', 'p2', '#S2', 'p2', '#S1', 'p2', '#G'], vars: { p2: 12 } };
module.exports = () => overRoute(spec);
module.exports.spec = spec;
runMain(module);
