'use strict';

const { sniff } = require('./config-sniffer');
const { compile, validateChain } = require('./chain-compiler');
const { createAdapter } = require('./adapters');
const { NetworkContext, STATES } = require('./network-context');
const { ChinaBypassEngine } = require('./bypass-engine');
const { SelfHealing } = require('./self-healing');
const { DEFAULT_SECURITY_POLICY, mergeSecurityPolicy, evaluateRoute } = require('./security-policy');

function createController(options) {
  const opts = options || {};
  const controller = {
    network: new NetworkContext(),
    selfHealing: new SelfHealing(opts.selfHealing),
    security: mergeSecurityPolicy(opts.security),
    adapter: null,
    selectKernel(input) {
      const detected = sniff(input);
      if (!detected.kernel) throw new Error('unable to determine proxy kernel');
      this.adapter = createAdapter(detected.kernel);
      return detected;
    },
    compileChain(kernel, chain) {
      validateChain(chain);
      return compile(kernel, chain);
    },
    routeDecision(route) {
      return evaluateRoute(this.security, route);
    },
  };
  return controller;
}

module.exports = {
  createController,
  sniff,
  compile,
  createAdapter,
  NetworkContext,
  STATES,
  ChinaBypassEngine,
  SelfHealing,
  DEFAULT_SECURITY_POLICY,
};
