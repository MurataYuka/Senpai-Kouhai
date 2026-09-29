'use strict';
const { mainRoute, runMain } = require('./lib');
const test = () => mainRoute('ed06', { p1: 12, f1: 0, p4: 3 });
module.exports = test;
runMain(module, test);
