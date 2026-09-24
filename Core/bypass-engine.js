'use strict';

/**
 * Four-signal domestic bypass evaluator. It is deliberately data-driven:
 * platform integrations supply process/package, SNI, ASN and latency facts.
 */
class ChinaBypassEngine {
  constructor(options) {
    const opts = options || {};
    this.processPatterns = (opts.processPatterns || []).map((x) => String(x).toLowerCase());
    this.sniSuffixes = (opts.sniSuffixes || []).map((x) => String(x).toLowerCase());
    this.asns = new Set((opts.asns || []).map(Number));
    this.latencyThresholdMs = Number.isFinite(opts.latencyThresholdMs) ? opts.latencyThresholdMs : 25;
    this.cache = new Map();
  }

  matchesProcess(name) {
    const value = String(name || '').toLowerCase();
    return this.processPatterns.some((pattern) => value === pattern || value.endsWith(pattern));
  }

  matchesSni(hostname) {
    const value = String(hostname || '').toLowerCase().replace(/\.$/, '');
    return this.sniSuffixes.some((suffix) => value === suffix || value.endsWith(`.${suffix}`));
  }

  matchesAsn(asn) {
    return Number.isFinite(Number(asn)) && this.asns.has(Number(asn));
  }

  evaluate(facts) {
    const f = facts || {};
    const signals = {
      process: this.matchesProcess(f.process),
      sni: this.matchesSni(f.sni),
      asn: this.matchesAsn(f.asn),
      lowLatency: Number.isFinite(f.latencyMs) && f.latencyMs < this.latencyThresholdMs,
    };
    const direct = signals.process || signals.sni || signals.asn || signals.lowLatency;
    if (direct && f.cacheKey) this.cache.set(f.cacheKey, Date.now());
    return { action: direct ? 'DIRECT' : 'PROXY', signals };
  }
}

module.exports = { ChinaBypassEngine };
