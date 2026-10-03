'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: ['#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 'p1', '#S1', 2, 'p1'], vars: { p1: 15, p2: 0, p3: 0, p4: 2 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
