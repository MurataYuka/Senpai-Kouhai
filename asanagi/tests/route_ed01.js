'use strict';
const { mainRoute, runMain } = require('./lib');
const test = () => mainRoute('ed01', { p1: 14, f1: 1 });
module.exports = test;
runMain(module, test);
