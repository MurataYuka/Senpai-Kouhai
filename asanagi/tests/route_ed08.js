'use strict';
const { unlockTest, runMain } = require('./lib');
const test = () => unlockTest('ed08');
module.exports = test;
runMain(module, test);
