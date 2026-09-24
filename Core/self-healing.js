'use strict';

/**
 * Deterministic self-healing selector. It does not mutate core configuration;
 * the platform adapter decides how to apply the selected fallback.
 */
class SelfHealing {
  constructor(options) {
    const opts = options || {};
    this.maxFailures = Number.isInteger(opts.maxFailures) ? opts.maxFailures : 3;
    this.failureCounts = new Map();
    this.cooldownMs = Number.isInteger(opts.cooldownMs) ? opts.cooldownMs : 30000;
    this.lastSwitch = 0;
  }

  recordSuccess(proxy) {
    this.failureCounts.set(proxy, 0);
  }

  recordFailure(proxy) {
    const next = (this.failureCounts.get(proxy) || 0) + 1;
    this.failureCounts.set(proxy, next);
    return next;
  }

  shouldSwitch(proxy) {
    return (this.failureCounts.get(proxy) || 0) >= this.maxFailures && Date.now() - this.lastSwitch >= this.cooldownMs;
  }

  chooseFallback(current, candidates) {
    if (!this.shouldSwitch(current)) return null;
    for (const candidate of candidates || []) {
      if (candidate && candidate !== current && (this.failureCounts.get(candidate) || 0) < this.maxFailures) {
        this.lastSwitch = Date.now();
        return candidate;
      }
    }
    return null;
  }
}

module.exports = { SelfHealing };
