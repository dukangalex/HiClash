'use strict';

const assert = require('node:assert/strict');
const core = require('../Core');

function run() {
  assert.equal(core.sniff('vless://uuid@example.com:443?security=tls#US').kernel, 'sing-box');
  assert.equal(core.sniff('proxies:\n  - name: US\n    type: vmess').kernel, 'mihomo');
  assert.equal(core.sniff(JSON.stringify({ inbounds: [], outbounds: [], route: {} })).kernel, 'sing-box');
  assert.equal(core.sniff(JSON.stringify({ inbounds: [], outbounds: [], routing: {} })).kernel, 'xray');

  const mihomo = core.compile('mihomo', [
    { name: 'entry', proxy: { name: 'entry', type: 'vmess' } },
    { name: 'exit', proxy: { name: 'exit', type: 'vmess' } },
  ]);
  assert.equal(mihomo.proxies[0]['dialer-proxy'], 'exit');

  const sing = core.compile('sing-box', [
    { name: 'entry', outbound: { type: 'vmess' } },
    { name: 'exit', outbound: { type: 'vmess' } },
  ]);
  assert.equal(sing.outbounds[0].detour, 'exit');

  const xray = core.compile('xray', [
    { name: 'entry', outbound: { protocol: 'vless' } },
    { name: 'exit', outbound: { protocol: 'vless' } },
  ]);
  assert.equal(xray.outbounds[0].streamSettings.sockopt.dialerProxy, 'exit');

  const network = new core.NetworkContext();
  assert.equal(network.update({ connected: true, trusted: false, udpLoss: 0.9 }).transport, 'tcp');
  assert.equal(network.policy().killSwitch, true);

  const bypass = new core.ChinaBypassEngine({ processPatterns: ['com.example.cn'], asns: [45090] });
  assert.equal(bypass.evaluate({ process: 'com.example.cn' }).action, 'DIRECT');
  assert.equal(bypass.evaluate({ asn: 45090 }).action, 'DIRECT');

  const controller = core.createController();
  assert.equal(controller.routeDecision({ coreState: 'stopped' }), 'BLOCK');
  assert.equal(controller.routeDecision({ coreState: 'running', fallback: 'DIRECT' }), 'BLOCK');

  console.log('Universal Core tests passed');
}

run();
