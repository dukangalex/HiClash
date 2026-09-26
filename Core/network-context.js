'use strict';

/**
 * Platform-neutral network context state machine.
 * Android/Windows/macOS/iOS integrations feed observed events into this module.
 */

const STATES = Object.freeze({
  OFFLINE: 'offline',
  TRUSTED: 'trusted',
  PUBLIC: 'public',
  CAPTIVE: 'captive',
});

class NetworkContext {
  constructor() {
    this.state = STATES.OFFLINE;
    this.transport = 'unknown';
    this.udpLoss = 0;
  }

  update(event) {
    const e = event || {};
    if (e.connected === false) this.state = STATES.OFFLINE;
    else if (e.captivePortal === true) this.state = STATES.CAPTIVE;
    else if (e.trusted === true) this.state = STATES.TRUSTED;
    else if (e.connected === true) this.state = STATES.PUBLIC;
    if (e.transport) this.transport = e.transport;
    if (Number.isFinite(e.udpLoss)) this.udpLoss = Math.max(0, Math.min(1, e.udpLoss));
    return this.policy();
  }

  policy() {
    if (this.state === STATES.OFFLINE) return { tun: false, killSwitch: true, transport: 'none' };
    if (this.state === STATES.CAPTIVE) {
      return { tun: false, killSwitch: true, transport: 'tcp', captivePortal: true };
    }
    if (this.state === STATES.TRUSTED) {
      return {
        tun: false,
        killSwitch: true,
        transport: this.udpLoss > 0.8 ? 'tcp' : 'auto',
      };
    }
    return { tun: true, killSwitch: true, transport: this.udpLoss > 0.8 ? 'tcp' : 'auto' };
  }
}

module.exports = { NetworkContext, STATES };
