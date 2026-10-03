'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed06', picks: { 'ch15-c1': '#d' }, rest: 'p3', vars: { p3: 28 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
