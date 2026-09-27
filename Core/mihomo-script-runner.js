'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateCustomOptions, getDefaultCustomOptions } = require('./custom-options');

const SCRIPT_PATH = path.join(__dirname, '..', 'Script', 'mihomoScript.js');

function loadMihomoScript() {
  const source = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'mihomoScript.js' });
  if (typeof sandbox.main !== 'function') {
    throw new Error('HiClash Mihomo script does not expose main(config)');
  }
  return sandbox.main;
}

function compileMihomoScript(config, customOptions) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Mihomo config must be an object');
  }

  const supplied = customOptions === undefined ? {} : customOptions;
  validateCustomOptions(supplied);

  const options = { ...getDefaultCustomOptions(), ...supplied };
  const main = loadMihomoScript();
  const output = main(config, { customOptions: options });

  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new Error('HiClash Mihomo script returned an invalid config');
  }

  return { config: output, options };
}

module.exports = {
  compileMihomoScript,
};
