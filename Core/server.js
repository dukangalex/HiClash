'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { sniff, compile, compileMihomoLanding, createAdapter } = require('./index');
const { customOptionsSchema, getDefaultCustomOptions, validateCustomOptions } = require('./custom-options');
const { compileMihomoScript } = require('./mihomo-script-runner');

const MAX_BODY_BYTES = 1024 * 1024;
const DASHBOARD_PATH = path.join(__dirname, '..', 'Dashboard', 'index.html');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Reject requests whose Host header is not a loopback name. The control plane
 * only ever listens on loopback; anything else is a DNS-rebinding attempt.
 */
function isLoopbackHost(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]';
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    // Cross-site forms/fetches can send text/plain without a CORS preflight.
    // Requiring application/json forces a preflight, which we never grant.
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
      req.resume();
      return reject(httpError(415, 'content-type must be application/json'));
    }
    // setEncoding keeps multi-byte characters (e.g. Chinese node names) intact
    // when they straddle chunk boundaries.
    req.setEncoding('utf8');
    let body = '';
    let bytes = 0;
    let done = false;
    const fail = (err) => {
      if (done) return;
      done = true;
      reject(err);
    };
    req.on('data', (chunk) => {
      if (done) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BODY_BYTES) {
        req.removeAllListeners('data');
        req.resume();
        return fail(httpError(413, 'request too large'));
      }
      body += chunk;
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(httpError(400, 'invalid JSON: ' + err.message));
      }
    });
    req.on('error', fail);
  });
}

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendDashboard(res) {
  let html;
  try {
    html = fs.readFileSync(DASHBOARD_PATH);
  } catch (_) {
    return send(res, 404, { error: 'dashboard not found' });
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'content-security-policy':
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  res.end(html);
}

function createServer(options) {
  const opts = options || {};
  const server = http.createServer(async (req, res) => {
    try {
      if (!isLoopbackHost(req)) return send(res, 403, { error: 'forbidden host' });
      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) return sendDashboard(res);
      if (req.method === 'GET' && req.url === '/api/custom-options') return send(res, 200, customOptionsSchema);
      if (req.method === 'POST' && req.url === '/api/script/mihomo/compile') {
        const body = await readJson(req);
        const supplied = body.options === undefined ? {} : body.options;
        validateCustomOptions(supplied);
        return send(
          res,
          200,
          compileMihomoScript(body.config || {}, supplied, {
            frontName: body.frontName,
            landing: body.landing,
          }),
        );
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
      return send(res, err.status || 400, { error: err.message });
    }
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.HICLASH_CORE_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Invalid HICLASH_CORE_PORT: ' + process.env.HICLASH_CORE_PORT);
    process.exit(1);
  }
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`HiClash Universal Core listening on 127.0.0.1:${port}`);
  });
}

module.exports = { createServer };
