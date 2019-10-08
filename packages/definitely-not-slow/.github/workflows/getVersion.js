#!/usr/bin/env node

const packageJson = require('../../package.json');
const version = packageJson.version;
const date = new Date();
const timestamp = [
  date.getUTCFullYear(),
  date.getUTCMonth() + 1,
  date.getUTCDate(),
  date.getUTCHours(),
  date.getUTCMinutes(),
].join('');

console.log(`${version}-alpha.${timestamp}`);
