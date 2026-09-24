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
    if (!hop || typeof hop !== 'object' || !hop.name) throw new Error('invalid chain hop');
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

function compile(kernel, chain) {
  if (kernel === 'mihomo') return compileMihomo(chain);
  if (kernel === 'sing-box') return compileSingBox(chain);
  if (kernel === 'xray') return compileXray(chain);
  throw new Error(`unsupported kernel: ${kernel}`);
}

module.exports = { compile, validateChain };
