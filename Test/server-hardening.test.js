'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer, resolveListenOptions } = require('../Core/server');

function raw(port, { method = 'GET', path = '/', headers = {}, chunks = [] }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
    // Write chunk-by-chunk with a tick in between so each lands as its own 'data' event.
    (async () => {
      for (const chunk of chunks) {
        req.write(chunk);
        await new Promise((r) => setTimeout(r, 15));
      }
      req.end();
    })();
  });
}

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // 1. Non-loopback Host header (DNS rebinding) is refused.
    const rebinding = await raw(port, { path: '/api/health', headers: { host: 'evil.example.com' } });
    assert.equal(rebinding.status, 403);

    // 2. Loopback names are accepted.
    for (const host of ['127.0.0.1:' + port, 'localhost:' + port]) {
      const ok = await raw(port, { path: '/api/health', headers: { host } });
      assert.equal(ok.status, 200, 'host ' + host);
    }

    // 3. Body-carrying POSTs must be application/json (blocks cross-site simple requests).
    const plain = await raw(port, {
      method: 'POST',
      path: '/api/sniff',
      headers: { 'content-type': 'text/plain' },
      chunks: ['{"input":"vmess://x"}'],
    });
    assert.equal(plain.status, 415);

    // 4. Oversized bodies get a real 413 response (not a dropped socket).
    const big = '{"input":"' + 'a'.repeat(1024 * 1024 + 16) + '"}';
    const tooLarge = await raw(port, {
      method: 'POST',
      path: '/api/sniff',
      headers: { 'content-type': 'application/json' },
      chunks: [big],
    });
    assert.equal(tooLarge.status, 413);

    // 5. Multi-byte characters split across chunks must survive intact.
    const name = '🇭🇰 香港 01';
    const payload = Buffer.from(JSON.stringify({ input: 'proxies:\n  - name: ' + name }), 'utf8');
    const cut = payload.indexOf(Buffer.from('香', 'utf8')) + 1; // mid-character
    const split = await raw(port, {
      method: 'POST',
      path: '/api/sniff',
      headers: { 'content-type': 'application/json' },
      chunks: [payload.subarray(0, cut), payload.subarray(cut)],
    });
    assert.equal(split.status, 200, split.data);
    assert.equal(JSON.parse(split.data).kernel, 'mihomo');

    // 5b. Invalid JSON is a 400, not a crash.
    const bad = await raw(port, {
      method: 'POST',
      path: '/api/sniff',
      headers: { 'content-type': 'application/json' },
      chunks: ['{not json'],
    });
    assert.equal(bad.status, 400);

    // 6. The dashboard is actually served, with a locked-down CSP.
    const dash = await raw(port, { path: '/' });
    assert.equal(dash.status, 200);
    assert.match(dash.headers['content-type'], /text\/html/);
    assert.match(dash.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(dash.data, /<html/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function checkListenDefaults() {
  // 本机直接运行：控制面无鉴权，必须默认只听回环、保留 Host 校验、禁止 iframe。
  assert.deepEqual(resolveListenOptions({}), {
    port: 8787,
    host: '127.0.0.1',
    allowAnyHost: false,
    allowIframe: false,
  });
  assert.equal(resolveListenOptions({ HICLASH_CORE_PORT: '9000' }).host, '127.0.0.1');
  // 托管容器（平台注入 PORT）：沿用部署行为。
  assert.deepEqual(resolveListenOptions({ PORT: '3000' }), {
    port: 3000,
    host: '0.0.0.0',
    allowAnyHost: true,
    allowIframe: true,
  });
  assert.equal(resolveListenOptions({ PORT: '3000', HOST: '127.0.0.1' }).allowAnyHost, false);
  assert.equal(resolveListenOptions({ ALLOW_ANY_HOST: '1' }).allowAnyHost, true);
  assert.throws(() => resolveListenOptions({ PORT: '70000' }), /Invalid PORT/);
}

run().then(
  () => {
    checkListenDefaults();
    console.log('Server hardening tests passed');
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
