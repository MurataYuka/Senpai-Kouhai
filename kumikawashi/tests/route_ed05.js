'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed05', picks: ['p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', 'p3', '#go', 'p3', 'p3', '#e5'], vars: { p3: 14, f1: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
