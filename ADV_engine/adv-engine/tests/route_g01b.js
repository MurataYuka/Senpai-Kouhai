'use strict';
const { overRoute, runMain } = require('./lib');
const spec = { go: 'g01', ver: 'b', picks: [3] };
module.exports = () => overRoute(spec);
module.exports.spec = spec;
runMain(module);
