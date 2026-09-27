'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compileMihomoLanding } = require('./chain-compiler');
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

function mergeUniqueNames(target, names) {
  const existing = new Set(target);
  for (const name of names) {
    if (!existing.has(name)) {
      target.push(name);
      existing.add(name);
    }
  }
}

function mergeLandingConfig(output, landingConfig) {
  if (Array.isArray(landingConfig.proxies) && landingConfig.proxies.length) {
    output.proxies = Array.isArray(output.proxies) ? output.proxies : [];
    const existing = new Set(output.proxies.map((proxy) => proxy && proxy.name).filter(Boolean));
    for (const proxy of landingConfig.proxies) {
      if (!proxy || !proxy.name) continue;
      if (existing.has(proxy.name)) {
        throw new Error('landing proxy name conflicts with existing proxy: ' + proxy.name);
      }
      output.proxies.push(proxy);
      existing.add(proxy.name);
    }
  }

  if (landingConfig['proxy-providers']) {
    output['proxy-providers'] = output['proxy-providers'] || {};
    for (const [name, provider] of Object.entries(landingConfig['proxy-providers'])) {
      if (Object.prototype.hasOwnProperty.call(output['proxy-providers'], name)) {
        throw new Error('landing provider name conflicts with existing provider: ' + name);
      }
      output['proxy-providers'][name] = provider;
    }
  }

  if (Array.isArray(landingConfig['proxy-groups'])) {
    output['proxy-groups'] = Array.isArray(output['proxy-groups']) ? output['proxy-groups'] : [];
    const existing = new Set(output['proxy-groups'].map((group) => group && group.name).filter(Boolean));
    for (const group of landingConfig['proxy-groups']) {
      if (!group || !group.name) continue;
      if (existing.has(group.name)) {
        throw new Error('landing proxy group name conflicts with existing group: ' + group.name);
      }
      output['proxy-groups'].push(group);
      existing.add(group.name);
    }
  }
}

function exposeLandingInGeneratedGroups(output, landingGroupName) {
  if (!landingGroupName || !Array.isArray(output['proxy-groups'])) return;

  for (const group of output['proxy-groups']) {
    if (!group || !Array.isArray(group.proxies)) continue;
    if (group.name === '默认代理' || group.name === 'GLOBAL') {
      mergeUniqueNames(group.proxies, [landingGroupName]);
    }
  }
}

function compileMihomoScript(config, customOptions, context) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Mihomo config must be an object');
  }

  const supplied = customOptions === undefined ? {} : customOptions;
  validateCustomOptions(supplied);

  const options = { ...getDefaultCustomOptions(), ...supplied };
  const compileContext = context && typeof context === 'object' ? context : {};
  const landing = compileContext.landing;

  if (landing !== undefined && !options.链式代理) {
    throw new Error('landing configuration requires 链式代理 to be enabled');
  }

  const main = loadMihomoScript();
  const output = main(config, {
    customOptions: options,
    customLanding: landing !== undefined,
  });

  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new Error('HiClash Mihomo script returned an invalid config');
  }

  if (landing !== undefined) {
    const frontName = String(compileContext.frontName || '').trim();
    if (!frontName) {
      throw new Error('frontName is required when landing is configured');
    }

    const landingGroupName = String(landing.name || '链式落地').trim() || '链式落地';
    if (landingGroupName === frontName) {
      throw new Error('landing group name must differ from frontName');
    }

    const existingProxyNames = new Set(
      (Array.isArray(output.proxies) ? output.proxies : [])
        .map((proxy) => proxy && proxy.name)
        .filter(Boolean),
    );
    if (existingProxyNames.has(landingGroupName)) {
      throw new Error('landing group name conflicts with existing proxy: ' + landingGroupName);
    }

    const landingConfig = compileMihomoLanding(frontName, landing);
    mergeLandingConfig(output, landingConfig);
    exposeLandingInGeneratedGroups(output, landingGroupName);
  }

  return { config: output, options };
}

module.exports = {
  compileMihomoScript,
};
