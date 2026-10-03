'use strict';
const { overRoute, runMain } = require('./lib');
const spec = { go: 'g01', ver: 'a', picks: ['#G'], vars: { p2: 0 } };
module.exports = () => overRoute(spec);
module.exports.spec = spec;
runMain(module);
