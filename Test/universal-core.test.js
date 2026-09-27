'use strict';

const assert = require('node:assert/strict');
const core = require('../Core');
const { customOptionsSchema, getDefaultCustomOptions, validateCustomOptions } = require('../Core/custom-options');

function run() {
  assert.equal(customOptionsSchema.version, 1);
  assert.equal(customOptionsSchema.type, 'toggle-map');
  assert.equal(getDefaultCustomOptions()['链式代理'], false);
  assert.equal(getDefaultCustomOptions()['故障转移'], true);
  assert.equal(validateCustomOptions({ '链式代理': true, AI: false }), true);
  assert.throws(() => validateCustomOptions({ 不存在的开关: true }), /unknown custom option/);
  assert.throws(() => validateCustomOptions({ AI: 'true' }), /must be boolean/);
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

  const subscriptionLanding = core.compileMihomoLanding('链式中转', {
    kind: 'subscription',
    url: 'https://example.com/subscription',
  });
  assert.equal(subscriptionLanding['proxy-providers']['链式落地-订阅'].override['dialer-proxy'], '链式中转');
  assert.deepEqual(subscriptionLanding['proxy-groups'][0].use, ['链式落地-订阅']);

  const socksLanding = core.compileMihomoLanding('链式中转', {
    kind: 'socks5',
    server: '127.0.0.1',
    port: 1080,
    username: 'u',
    password: 'p',
  });
  assert.equal(socksLanding.proxies[0].type, 'socks');
  assert.equal(socksLanding.proxies[0]['dialer-proxy'], '链式中转');
  assert.equal(socksLanding.proxies[0].port, 1080);

  const httpLanding = core.compileMihomoLanding('链式中转', {
    kind: 'http',
    server: '127.0.0.1',
    port: 8080,
  });
  assert.equal(httpLanding.proxies[0].type, 'http');
  assert.equal(httpLanding.proxies[0]['dialer-proxy'], '链式中转');

  assert.throws(
    () =>
      core.compileMihomoLanding('链式中转', {
        kind: 'subscription',
        url: 'not-a-url',
      }),
    /http\(s\)/,
  );

  const network = new core.NetworkContext();
  assert.equal(network.update({ connected: true, trusted: false, udpLoss: 0.9 }).transport, 'tcp');
  assert.equal(network.policy().killSwitch, true);

  const bypass = new core.ChinaBypassEngine({
    processPatterns: ['com.example.cn'],
    asns: [45090],
  });
  assert.equal(bypass.evaluate({ process: 'com.example.cn' }).action, 'DIRECT');
  assert.equal(bypass.evaluate({ asn: 45090 }).action, 'DIRECT');

  const controller = core.createController();
  assert.equal(controller.routeDecision({ coreState: 'stopped' }), 'BLOCK');
  assert.equal(controller.routeDecision({ coreState: 'running', fallback: 'DIRECT' }), 'BLOCK');

  console.log('Universal Core tests passed');
}

run();
