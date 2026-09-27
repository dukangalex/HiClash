'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Dashboard', 'index.html'), 'utf8');

assert.match(html, /fetch\('\/api\/custom-options'\)/);
assert.match(html, /fetch\('\/api\/custom-options\/resolve'/);
assert.match(html, /fetch\('\/api\/script\/mihomo\/compile'/);
assert.match(html, /compileMihomoConfig\(\)/);
assert.match(html, /customOptionSchema\.options/);
assert.match(html, /<details class="card option-panel" id="customOptionsPanel">/);
assert.match(html, /<summary>自定义开关<\/summary>/);
assert.match(html, /option-panel\[open\] summary::after/);
assert.match(html, /let customOptionSchema = null;[\s\S]*?loadCustomOptions\(\);/);
assert.match(html, /链式代理/);
assert.match(html, /subscription/);
assert.match(html, /socks5/);
assert.match(html, /http/);

console.log('Dashboard integration assertions passed');
