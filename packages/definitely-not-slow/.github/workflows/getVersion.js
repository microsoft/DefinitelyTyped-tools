#!/usr/bin/env node

/**
 * @param {string | number} value
 * @param {number} length
 */
function padInt(value, length) {
  value = value.toString();
  while (value.length < length) {
    value = "0" + value;
  }
  return value;
}

const packageJson = require('../../package.json');
const version = packageJson.version;
const date = new Date();
const timestamp = [
  date.getUTCFullYear(),
  padInt(date.getUTCMonth() + 1, 2),
  padInt(date.getUTCDate(), 2),
  padInt(date.getUTCHours(), 2),
  padInt(date.getUTCMinutes(), 2),
].join('');

console.log(`${version}-alpha.${timestamp}`);
