'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed02', picks: ['p2'], vars: { p1: 0, p2: 2 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
