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
      config: { proxies: [] },
      options: { AI: false },
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.options.AI, false);
    assert.ok(!disabled.body.config['proxy-groups'].some((group) => group.name === 'AI'));

    const integrated = await request(port, {
      config: {
        proxies: [{ name: '前置节点', type: 'socks', server: 'front.example', port: 443 }],
      },
      options: { 链式代理: true },
      frontName: '前置节点',
      landing: {
        kind: 'subscription',
        name: '链式落地',
        url: 'https://example.com/subscription',
      },
    });
    assert.equal(integrated.status, 200);
    assert.equal(integrated.body.config['proxy-providers']['链式落地-订阅'].override['dialer-proxy'], '前置节点');
    assert.ok(
      integrated.body.config['proxy-groups'].find((group) => group.name === '默认代理').proxies.includes('链式落地'),
    );

    const invalid = await request(port, {
      config: { proxies: [] },
      options: { 链式代理: false },
      frontName: '前置节点',
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
