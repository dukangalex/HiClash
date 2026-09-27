'use strict';

const assert = require('node:assert/strict');
const core = require('../Core');
const { customOptionsSchema, getDefaultCustomOptions, validateCustomOptions } = require('../Core/custom-options');

function run() {
  assert.equal(customOptionsSchema.version, 1);
  const expectedCustomOptions = {
    手动选择: true,
    自动选择: true,
    负载均衡: true,
    故障转移: true,
    远控工具: true,
    FCM: true,
    YouTube: true,
    Google: true,
    AI: true,
    Claude: true,
    Microsoft: true,
    Apple: true,
    Telegram: true,
    Steam: true,
    TikTok: true,
    Twitter: true,
    Meta: true,
    Line: true,
    Netflix: true,
    Emby: true,
    PikPak: true,
    Spotify: true,
    Crypto: true,
    EHentai: true,
    AdBlock: true,
    极简模式: false,
    生成地区自动选择组: true,
    隐藏地区手动选择组: false,
    生成倍率组: true,
    分流组添加所有节点: false,
    过滤低倍率节点: false,
    过滤高倍率节点: false,
    过滤非地区节点: true,
    屏蔽国外QUIC: true,
    代理IPV4优先: false,
    代理IPV6优先: false,
    链式代理: false,
  };
  assert.deepEqual(getDefaultCustomOptions(), expectedCustomOptions);
  assert.deepEqual(Object.keys(customOptionsSchema.options), Object.keys(expectedCustomOptions));

  assert.equal(customOptionsSchema.type, 'toggle-map');
  assert.equal(getDefaultCustomOptions()['链式代理'], false);
  assert.equal(getDefaultCustomOptions()['故障转移'], true);
  assert.equal(validateCustomOptions({ 链式代理: true, AI: false }), true);
  assert.throws(() => validateCustomOptions({ 不存在的开关: true }), /unknown custom option/);
  assert.throws(() => validateCustomOptions({ AI: 'true' }), /must be boolean/);
  assert.equal(core.sniff('vless://uuid@example.com:443?security=tls#US').kernel, 'sing-box');
  assert.equal(core.sniff('https://example.com/subscription').format, 'unknown');
  assert.equal(core.sniff('http://example.com/config.yaml').format, 'unknown');
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

  const reservedNameConfig = core.compileMihomoScript(
    { proxies: [{ name: '默认代理', type: 'http', server: '127.0.0.1', port: 8080 }] },
    {},
  );
  assert.ok(reservedNameConfig.config.proxies.some((proxy) => proxy.name === '节点-默认代理'));
  assert.ok(reservedNameConfig.config['proxy-groups'].some((group) => group.name === '默认代理'));

  const scriptDefault = core.compileMihomoScript(
    { proxies: [{ name: 'US-前置节点', type: 'http', server: '127.0.0.1', port: 8080 }] },
    {},
  );
  assert.ok(scriptDefault.config['proxy-groups'].some((group) => group.name === 'AI'));
  assert.equal(scriptDefault.options.AI, true);

  const scriptDisabled = core.compileMihomoScript(
    { proxies: [{ name: 'US-前置节点', type: 'http', server: '127.0.0.1', port: 8080 }] },
    { AI: false, 链式代理: false },
  );
  assert.ok(!scriptDisabled.config['proxy-groups'].some((group) => group.name === 'AI'));
  assert.equal(scriptDisabled.options.AI, false);
  assert.equal(scriptDisabled.options['链式代理'], false);

  const integratedLanding = core.compileMihomoScript(
    {
      proxies: [{ name: 'US-前置节点', type: 'socks', server: 'front.example', port: 443 }],
    },
    { 链式代理: true },
    {
      frontName: 'US-前置节点',
      landing: {
        kind: 'socks5',
        name: '链式落地',
        server: '127.0.0.1',
        port: 1080,
      },
    },
  );
  const integratedProxy = integratedLanding.config.proxies.find((proxy) => proxy.name === '链式落地');
  assert.equal(integratedProxy['dialer-proxy'], '🇺🇸 US-前置节点');
  assert.equal(integratedProxy.type, 'socks');
  assert.ok(
    integratedLanding.config['proxy-groups'].find((group) => group.name === '默认代理').proxies.includes('链式落地'),
  );

  assert.throws(
    () =>
      core.compileMihomoScript(
        {
          proxies: [{ name: '前置节点', type: 'socks', server: 'front.example', port: 443 }],
        },
        { 链式代理: true },
        {
          frontName: '前置节点',
          landing: {
            kind: 'http',
            name: '前置节点',
            server: '127.0.0.1',
            port: 8080,
          },
        },
      ),
    /landing group name must differ from frontName/,
  );

  const collisionSafeLanding = core.compileMihomoScript(
    {
      proxies: [
        { name: '前置节点', type: 'socks', server: 'front.example', port: 443 },
        { name: '链式落地', type: 'http', server: 'existing.example', port: 8081 },
      ],
    },
    { 链式代理: true },
    {
      frontName: '前置节点',
      landing: {
        kind: 'http',
        name: '链式落地',
        server: '127.0.0.1',
        port: 8080,
      },
    },
  );
  assert.ok(collisionSafeLanding.config.proxies.some((proxy) => proxy.name === '节点-链式落地'));
  assert.ok(collisionSafeLanding.config.proxies.some((proxy) => proxy.name === '链式落地'));

  assert.throws(
    () =>
      core.compileMihomoScript(
        {
          proxies: [{ name: '前置节点', type: 'socks', server: 'front.example', port: 443 }],
        },
        { 链式代理: false },
        {
          frontName: '前置节点',
          landing: {
            kind: 'http',
            server: '127.0.0.1',
            port: 8080,
          },
        },
      ),
    /requires 链式代理/,
  );

  assert.throws(
    () =>
      core.compileMihomoScript(
        {
          proxies: [{ name: '实际节点', type: 'socks', server: 'front.example', port: 443 }],
        },
        { 链式代理: true },
        {
          frontName: '不存在的前置',
          landing: {
            kind: 'http',
            name: '链式落地',
            server: '127.0.0.1',
            port: 8080,
          },
        },
      ),
    /frontName does not reference an existing proxy or proxy group/,
  );

  assert.throws(() => core.compileMihomoScript({ proxies: [] }, { AI: 'false' }), /must be boolean/);
  assert.throws(() => core.compileMihomoScript({ proxies: [] }, { 不存在的开关: true }), /unknown custom option/);

  const network = new core.NetworkContext();
  assert.equal(network.update({ connected: true, trusted: false, udpLoss: 0.9 }).transport, 'tcp');
  assert.equal(network.policy().killSwitch, true);

  const bypass = new core.ChinaBypassEngine({
    processPatterns: ['com.example.cn'],
    asns: [45090],
  });
  assert.equal(bypass.evaluate({ process: 'com.example.cn' }).action, 'DIRECT');
  assert.equal(bypass.evaluate({ asn: 45090 }).action, 'DIRECT');
  assert.equal(bypass.evaluate({ latencyMs: 1 }).action, 'PROXY');

  const controller = core.createController();
  assert.equal(controller.routeDecision({ coreState: 'stopped' }), 'BLOCK');
  assert.equal(controller.routeDecision({ coreState: 'running', fallback: 'DIRECT' }), 'BLOCK');

  console.log('Universal Core tests passed');
}

run();
