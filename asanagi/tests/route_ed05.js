'use strict';
const { mainRoute, runMain } = require('./lib');
const test = () => mainRoute('ed05', { p1: 0, p4: 2 });
module.exports = test;
runMain(module, test);
