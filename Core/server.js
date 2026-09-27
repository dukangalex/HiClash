'use strict';

const http = require('node:http');
const { sniff, compile, compileMihomoLanding, createAdapter } = require('./index');
const { customOptionsSchema, getDefaultCustomOptions, validateCustomOptions } = require('./custom-options');
const { compileMihomoScript } = require('./mihomo-script-runner');

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy(new Error('request too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
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
      if (req.method === 'GET' && req.url === '/api/custom-options') return send(res, 200, customOptionsSchema);
      if (req.method === 'POST' && req.url === '/api/script/mihomo/compile') {
        const body = await readJson(req);
        const supplied = body.options === undefined ? {} : body.options;
        validateCustomOptions(supplied);
        return send(res, 200, compileMihomoScript(body.config || {}, supplied));
      }
      if (req.method === 'POST' && req.url === '/api/custom-options/resolve') {
        const body = await readJson(req);
        validateCustomOptions(body.options || {});
        return send(res, 200, {
          schema: customOptionsSchema.version,
          options: { ...getDefaultCustomOptions(), ...(body.options || {}) },
        });
      }
      if (req.method === 'GET' && req.url === '/api/health') {
        return send(res, 200, { ok: true, service: 'HiClash Universal Core' });
      }
      if (req.method === 'POST' && req.url === '/api/sniff') {
        const body = await readJson(req);
        return send(res, 200, sniff(body.input));
      }
      if (req.method === 'POST' && req.url === '/api/chain/compile') {
        const body = await readJson(req);
        return send(res, 200, compile(body.kernel, body.chain));
      }
      if (req.method === 'POST' && req.url === '/api/chain/landing') {
        const body = await readJson(req);
        return send(res, 200, compileMihomoLanding(body.frontName, body.landing));
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
