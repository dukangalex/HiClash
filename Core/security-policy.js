'use strict';

/** Security baseline shared by platform adapters. */
const DEFAULT_SECURITY_POLICY = Object.freeze({
  killSwitch: true,
  blockWebRTCStun: true,
  blockIPv6Leak: true,
  dnsMode: 'encrypted',
  preventDirectFallback: true,
  allowLan: false,
  captivePortalTemporaryAllowlist: true,
  quicForeignOnlyBlock: true,
});

function mergeSecurityPolicy(overrides) {
  return Object.assign({}, DEFAULT_SECURITY_POLICY, overrides || {});
}

function evaluateRoute(policy, route) {
  const effective = mergeSecurityPolicy(policy);
  if (effective.killSwitch && route && route.coreState !== 'running') return 'BLOCK';
  if (effective.preventDirectFallback && route && route.fallback === 'DIRECT') return 'BLOCK';
  if (effective.blockWebRTCStun && route && route.port >= 3478 && route.port <= 3497) return 'BLOCK';
  if (effective.blockWebRTCStun && route && route.port === 5349) return 'BLOCK';
  return 'ALLOW';
}

module.exports = { DEFAULT_SECURITY_POLICY, mergeSecurityPolicy, evaluateRoute };
