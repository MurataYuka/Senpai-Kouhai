'use strict';
const { overRoute, runMain } = require('./lib');
const spec = { go: 'g11', ver: 'a', picks: ['#S2', 'p3', '#S1', 'p3', '#S2', 'p3', '#S1', 'p3', '#S2', 'p3', '#S1', 'p3', '#S2', 'p3', '#S1', 'p3', '#S2', 'p3', '#S1', 'p3', '#G'], vars: { p3: 10 } };
module.exports = () => overRoute(spec);
module.exports.spec = spec;
runMain(module);
