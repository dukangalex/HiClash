'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Dashboard', 'index.html'), 'utf8');

assert.match(html, /fetch\('\/api\/custom-options'\)/);
assert.match(html, /fetch\('\/api\/custom-options\/resolve'/);
assert.match(html, /customOptionSchema\.options/);
assert.match(html, /链式代理/);
assert.match(html, /subscription/);
assert.match(html, /socks5/);
assert.match(html, /http/);

console.log('Dashboard integration assertions passed');
