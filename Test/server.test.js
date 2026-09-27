'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../Core/server');

function request(port, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/script/mihomo/compile',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const port = server.address().port;

    const disabled = await request(port, {
      config: { proxies: [{ name: 'US-前置节点', type: 'http', server: '127.0.0.1', port: 8080 }] },
      options: { AI: false },
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.options.AI, false);
    assert.ok(!disabled.body.config['proxy-groups'].some((group) => group.name === 'AI'));

    const integrated = await request(port, {
      config: { proxies: [{ name: 'US-前置节点', type: 'http', server: '127.0.0.1', port: 8080 }] },
      options: { 链式代理: true },
      frontName: 'US-前置节点',
      landing: {
        kind: 'subscription',
        name: '链式落地',
        url: 'https://example.com/subscription',
      },
    });
    assert.equal(integrated.status, 200);
    assert.equal(integrated.body.config['proxy-providers']['链式落地-订阅'].override['dialer-proxy'], '🇺🇸 US-前置节点');
    assert.ok(
      integrated.body.config['proxy-groups'].find((group) => group.name === '默认代理').proxies.includes('链式落地'),
    );

    const integratedSocks = await request(port, {
      config: { proxies: [{ name: 'US-前置节点', type: 'http', server: '127.0.0.1', port: 8080 }] },
      options: { 链式代理: true },
      frontName: 'US-前置节点',
      landing: {
        kind: 'socks5',
        name: '链式落地-SOCKS5',
        server: '127.0.0.1',
        port: 1080,
        username: 'user',
        password: 'pass',
      },
    });
    assert.equal(integratedSocks.status, 200);
    const socksProxy = integratedSocks.body.config.proxies.find((proxy) => proxy.name === '链式落地-SOCKS5');
    assert.equal(socksProxy.type, 'socks');
    assert.equal(socksProxy.port, 1080);
    assert.equal(socksProxy.username, 'user');
    assert.equal(socksProxy.password, 'pass');
    assert.equal(socksProxy['dialer-proxy'], '🇺🇸 US-前置节点');

    const integratedHttp = await request(port, {
      config: { proxies: [{ name: 'US-前置节点', type: 'http', server: '127.0.0.1', port: 8080 }] },
      options: { 链式代理: true },
      frontName: 'US-前置节点',
      landing: {
        kind: 'http',
        name: '链式落地-HTTP',
        server: '127.0.0.1',
        port: 8081,
      },
    });
    assert.equal(integratedHttp.status, 200);
    const httpProxy = integratedHttp.body.config.proxies.find((proxy) => proxy.name === '链式落地-HTTP');
    assert.equal(httpProxy.type, 'http');
    assert.equal(httpProxy.port, 8081);
    assert.equal(httpProxy['dialer-proxy'], '🇺🇸 US-前置节点');

    const invalid = await request(port, {
      config: { proxies: [] },
      options: { 链式代理: false },
      frontName: 'US-前置节点',
      landing: {
        kind: 'http',
        server: '127.0.0.1',
        port: 8080,
      },
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /requires 链式代理/);

    const invalidOption = await request(port, {
      config: { proxies: [] },
      options: { AI: 'false' },
    });
    assert.equal(invalidOption.status, 400);
    assert.match(invalidOption.body.error, /must be boolean/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }

  console.log('Server custom option integration tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
