'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed06', picks: ['#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 'p3', '#S1', 1], vars: { p1: 0, p2: 0, p3: 13 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
