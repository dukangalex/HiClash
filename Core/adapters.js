'use strict';

/**
 * Common adapter contract. Platform clients can implement start/stop/reload,
 * status and select without changing the UI/control layer.
 */

class ProxyCoreAdapter {
  constructor(kernel) {
    this.kernel = kernel;
    this.state = 'stopped';
  }

  async start() {
    this.state = 'running';
  }

  async stop() {
    this.state = 'stopped';
  }

  async reload(_config) {
    if (this.state !== 'running') throw new Error(`${this.kernel} is not running`);
  }

  async status() {
    return { kernel: this.kernel, state: this.state };
  }

  async select(_group, _proxy) {
    if (this.state !== 'running') throw new Error(`${this.kernel} is not running`);
  }
}

class MihomoAdapter extends ProxyCoreAdapter {
  constructor() { super('mihomo'); }
}

class SingBoxAdapter extends ProxyCoreAdapter {
  constructor() { super('sing-box'); }
}

class XrayAdapter extends ProxyCoreAdapter {
  constructor() { super('xray'); }
}

function createAdapter(kernel) {
  if (kernel === 'mihomo') return new MihomoAdapter();
  if (kernel === 'sing-box') return new SingBoxAdapter();
  if (kernel === 'xray') return new XrayAdapter();
  throw new Error(`unsupported kernel: ${kernel}`);
}

module.exports = { ProxyCoreAdapter, MihomoAdapter, SingBoxAdapter, XrayAdapter, createAdapter };
