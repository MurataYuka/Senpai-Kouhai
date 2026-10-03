'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: [0], vars: { p1: 1, p2: 0 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
