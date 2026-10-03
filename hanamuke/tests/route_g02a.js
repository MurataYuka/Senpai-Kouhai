'use strict';
const { overRoute, runMain } = require('./lib');
const spec = { go: 'g02', ver: 'a', picks: ['#S2', 'p3', '#G'], vars: { p3: 1 } };
module.exports = () => overRoute(spec);
module.exports.spec = spec;
runMain(module);
