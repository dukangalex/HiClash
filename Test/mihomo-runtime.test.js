'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { loadScript } = require('./lib/loader');
const fx = require('./lib/fixtures');

const MIHOMO_BIN = process.env.MIHOMO_BIN;
const MIHOMO_VERSION = 'v1.19.31';

if (!MIHOMO_BIN) {
  throw new Error('MIHOMO_BIN is required');
}

if (!fs.existsSync(MIHOMO_BIN)) {
  throw new Error(`mihomo binary not found: ${MIHOMO_BIN}`);
}

const api = loadScript('Script/mihomoScript.js');
const config = api.main(fx.typicalSubscription());

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-mihomo-'));
const configPath = path.join(tempDir, 'config.yaml');

try {
  fs.writeFileSync(configPath, yaml.dump(config, { noRefs: true, lineWidth: -1 }), 'utf8');

  const result = spawnSync(MIHOMO_BIN, ['-t', '-f', configPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });

  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`mihomo ${MIHOMO_VERSION} config validation failed with exit code ${result.status}`);
  }

  console.log(`Mihomo ${MIHOMO_VERSION} runtime config validation passed`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
