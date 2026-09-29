'use strict';
const { mainRoute, runMain } = require('./lib');
const test = () => mainRoute('ed02', { p2: 14 });
module.exports = test;
runMain(module, test);
