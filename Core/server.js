'use strict';

const http = require('node:http');
const { sniff, compile, createAdapter } = require('./index');

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy(new Error('request too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

function createServer(options) {
  const opts = options || {};
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/api/health') return send(res, 200, { ok: true, service: 'HiClash Universal Core' });
      if (req.method === 'POST' && req.url === '/api/sniff') {
        const body = await readJson(req);
        return send(res, 200, sniff(body.input));
      }
      if (req.method === 'POST' && req.url === '/api/chain/compile') {
        const body = await readJson(req);
        return send(res, 200, compile(body.kernel, body.chain));
      }
      if (req.method === 'POST' && req.url === '/api/adapter/status') {
        const adapter = createAdapter(req.headers['x-proxy-kernel'] || opts.kernel || 'mihomo');
        return send(res, 200, await adapter.status());
      }
      return send(res, 404, { error: 'not found' });
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.HICLASH_CORE_PORT || 8787);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`HiClash Universal Core listening on 127.0.0.1:${port}`);
  });
}

module.exports = { createServer };
