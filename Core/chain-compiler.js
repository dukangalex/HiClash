'use strict';

/**
 * Kernel-neutral chain compiler.
 * A chain is represented as [firstHop, secondHop, ...]. The compiler never
 * assigns semantic roles such as airport/relay/landing; callers choose labels.
 */

function validateChain(chain) {
  if (!Array.isArray(chain) || chain.length < 2) {
    throw new Error('chain requires at least two hops');
  }
  const seen = new Set();
  for (const hop of chain) {
    if (!hop || typeof hop !== 'object' || !hop.name) {
      throw new Error('invalid chain hop');
    }
    if (seen.has(hop.name)) throw new Error(`chain cycle detected at ${hop.name}`);
    seen.add(hop.name);
  }
  return chain;
}

function compileMihomo(chain) {
  validateChain(chain);
  const proxies = chain.map((hop, index) => {
    const proxy = { ...hop.proxy };
    if (index < chain.length - 1) proxy['dialer-proxy'] = chain[index + 1].name;
    return proxy;
  });
  return { kernel: 'mihomo', proxies };
}

function compileSingBox(chain) {
  validateChain(chain);
  const outbounds = chain.map((hop, index) => {
    const outbound = { ...hop.outbound, tag: hop.name };
    if (index < chain.length - 1) outbound.detour = chain[index + 1].name;
    return outbound;
  });
  return { kernel: 'sing-box', outbounds };
}

function compileXray(chain) {
  validateChain(chain);
  const outbounds = chain.map((hop, index) => {
    const outbound = JSON.parse(JSON.stringify(chain[index].outbound || {}));
    outbound.tag = hop.name;
    if (index < chain.length - 1) {
      outbound.streamSettings = outbound.streamSettings || {};
      outbound.streamSettings.sockopt = outbound.streamSettings.sockopt || {};
      outbound.streamSettings.sockopt.dialerProxy = chain[index + 1].name;
    }
    return outbound;
  });
  return { kernel: 'xray', outbounds };
}

function validateLanding(landing) {
  if (!landing || typeof landing !== 'object') {
    throw new Error('landing configuration is required');
  }
  const kind = String(landing.kind || '').toLowerCase();
  if (!['subscription', 'socks5', 'http'].includes(kind)) {
    throw new Error('unsupported landing kind');
  }
  if (kind === 'subscription') {
    if (!/^https?:\/\//i.test(String(landing.url || ''))) throw new Error('subscription landing requires an http(s) URL');
  } else if (
    !landing.server ||
    !Number.isInteger(Number(landing.port)) ||
    Number(landing.port) < 1 ||
    Number(landing.port) > 65535
  ) {
    throw new Error(kind + ' landing requires a valid server and port');
  }
  return kind;
}

function compileMihomoLanding(frontName, landing) {
  if (!frontName || typeof frontName !== 'string') {
    throw new Error('frontName is required');
  }
  const kind = validateLanding(landing);
  const name = String(landing.name || '链式落地').trim() || '链式落地';
  if (kind === 'subscription') {
    const providerName = String(landing.providerName || (name + '-订阅')).trim();
    return {
      proxies: [],
      'proxy-providers': {
        [providerName]: { type: 'http', url: String(landing.url), interval: 86400, override: { 'dialer-proxy': frontName } },
      },
      'proxy-groups': [{ name, type: 'select', use: [providerName] }],
    };
  }
  const proxy = {
    name,
    type: kind === 'socks5' ? 'socks' : 'http',
    server: String(landing.server),
    port: Number(landing.port),
    'dialer-proxy': frontName,
  };
  if (landing.username) proxy.username = String(landing.username);
  if (landing.password) proxy.password = String(landing.password);
  return {
    proxies: [proxy],
    'proxy-providers': {},
    'proxy-groups': [{ name, type: 'select', proxies: [name] }],
  };
}

function compile(kernel, chain) {
  if (kernel === 'mihomo') return compileMihomo(chain);
  if (kernel === 'sing-box') return compileSingBox(chain);
  if (kernel === 'xray') return compileXray(chain);
  throw new Error(`unsupported kernel: ${kernel}`);
}

module.exports = { compile, validateChain, validateLanding, compileMihomoLanding };
