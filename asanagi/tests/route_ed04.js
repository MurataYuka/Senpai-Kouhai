'use strict';
const { mainRoute, runMain } = require('./lib');
const test = () => mainRoute('ed04', { p2: 0 });
module.exports = test;
runMain(module, test);
