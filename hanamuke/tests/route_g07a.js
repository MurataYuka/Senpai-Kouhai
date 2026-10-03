'use strict';
const { overRoute, runMain } = require('./lib');
const spec = { go: 'g07', ver: 'a', picks: ['#S2', 'p2', '#S1', 'p2', '#S2', 'p2', '#S1', 'p2', '#S2', 'p2', '#S1', 'p2', '#G'], vars: { p2: 6 } };
module.exports = () => overRoute(spec);
module.exports.spec = spec;
runMain(module);
