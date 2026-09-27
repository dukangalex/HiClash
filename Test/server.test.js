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

    const invalid = await request(port, {
      config: { proxies: [] },
      options: { AI: 'false' },
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /must be boolean/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }

  console.log('Server custom option integration tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
