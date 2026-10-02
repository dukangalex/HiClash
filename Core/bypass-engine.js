'use strict';

/**
 * Four-signal domestic bypass evaluator. It is deliberately data-driven:
 * platform integrations supply process/package, SNI, ASN and latency facts.
 */
class ChinaBypassEngine {
  constructor(options) {
    const opts = options || {};
    // Empty entries would match every input ('' is a suffix of everything) and
    // silently send all traffic DIRECT, so they are dropped up front.
    const clean = (list) => (list || []).map((x) => String(x).trim().toLowerCase()).filter((x) => x.length > 0);
    this.processPatterns = clean(opts.processPatterns);
    this.sniSuffixes = clean(opts.sniSuffixes);
    this.asns = new Set((opts.asns || []).map(Number).filter(Number.isFinite));
    this.latencyThresholdMs = Number.isFinite(opts.latencyThresholdMs) ? opts.latencyThresholdMs : 25;
    this.cache = new Map();
    this.cacheLimit = Number.isInteger(opts.cacheLimit) && opts.cacheLimit > 0 ? opts.cacheLimit : 1024;
  }

  matchesProcess(name) {
    const value = String(name || '').toLowerCase();
    // Match the whole name or a whole trailing path segment; a bare endsWith()
    // would let `evil-chat.exe` pass for a `chat.exe` pattern.
    return this.processPatterns.some(
      (pattern) => value === pattern || value.endsWith('/' + pattern) || value.endsWith('\\' + pattern),
    );
  }

  matchesSni(hostname) {
    const value = String(hostname || '')
      .toLowerCase()
      .replace(/\.$/, '');
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
    // Low latency is an observation, not proof that direct routing is safe.
    // Keep it visible for diagnostics but never let it alone bypass the proxy.
    const direct = signals.process || signals.sni || signals.asn;
    if (direct && f.cacheKey) {
      if (!this.cache.has(f.cacheKey) && this.cache.size >= this.cacheLimit) {
        this.cache.delete(this.cache.keys().next().value); // evict oldest
      }
      this.cache.set(f.cacheKey, Date.now());
    }
    return { action: direct ? 'DIRECT' : 'PROXY', signals };
  }
}

module.exports = { ChinaBypassEngine };
