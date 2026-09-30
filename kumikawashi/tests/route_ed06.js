'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed06', picks: ['p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', 'p2', '#go', 'p2', 'p2', '#e6'], vars: { p2: 14, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
