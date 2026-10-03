'use strict';
const { overRoute, runMain } = require('./lib');
const spec = { go: 'g03', ver: 'a', picks: ['#S2', 'p1', '#S1', 'p1', '#G'], vars: { p1: 2 } };
module.exports = () => overRoute(spec);
module.exports.spec = spec;
runMain(module);
