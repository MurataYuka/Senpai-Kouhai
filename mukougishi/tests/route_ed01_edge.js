'use strict';
const { route, runMain } = require('./lib');
const spec = { ed: 'ed01', picks: { 'ch01-q1': 1, 'ch08-q2': 0, 'ch14-q1': 1, 'ch15-q1': 1, 'ch02-q1': 'p2', 'ch03-q1': 'p2', 'ch04-q1': 'p2', 'ch05-q1': 'p2', 'ch06-q1': 'p2', 'ch07-q1': 'p2', 'ch08-q1': 'p3', 'ch09-q1': 'p3', 'ch10-q1': 'p3', 'ch11-q1': 'p3', 'ch12-q1': 'p3', 'ch13-q1': 'p3' }, vars: { p1: 0, p2: 6, p3: 6, f1: 1 } };
module.exports = () => route(spec);
module.exports.spec = spec;
runMain(module);
