'use strict';
const { unlockTest, runMain } = require('./lib');
const test = () => unlockTest('ed07');
module.exports = test;
runMain(module, test);
