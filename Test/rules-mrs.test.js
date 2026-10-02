'use strict';

// Verifies the committed .mrs is exactly what the .txt source compiles to, using the real Mihomo binary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MIHOMO_BIN = process.env.MIHOMO_BIN;
if (!MIHOMO_BIN || !fs.existsSync(MIHOMO_BIN)) {
  throw new Error('MIHOMO_BIN must point to a mihomo binary');
}

const root = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-mrs-'));
try {
  const decoded = path.join(tempDir, 'decoded.txt');
  const result = spawnSync(
    MIHOMO_BIN,
    ['convert-ruleset', 'domain', 'mrs', path.join(root, 'Rules', 'cn-additional-list.mrs'), decoded],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, 'convert-ruleset failed: ' + (result.stderr || result.stdout));

  const toSet = (file) =>
    new Set(
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
  const fromMrs = toSet(decoded);
  const fromTxt = toSet(path.join(root, 'Rules', 'cn-additional-list.txt'));
  assert.equal(fromMrs.size, fromTxt.size, 'entry count differs between .mrs and .txt');
  for (const entry of fromTxt) assert.ok(fromMrs.has(entry), 'missing from .mrs: ' + entry);
  console.log('cn-additional-list.mrs matches .txt (' + fromTxt.size + ' entries)');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
