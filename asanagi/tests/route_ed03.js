'use strict';
const { mainRoute, runMain } = require('./lib');
const test = () => mainRoute('ed03', { p3: 14 });
module.exports = test;
runMain(module, test);
