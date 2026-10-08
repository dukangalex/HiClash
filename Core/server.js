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
function isLoopbackHost(req, opts) {
  if (opts && opts.allowAnyHost) return true;
  if (process.env.ALLOW_ANY_HOST === '1') return true;
  const host = String(req.headers.host || '').toLowerCase();
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  if (name === '127.0.0.1' || name === 'localhost' || name === '[::1]') return true;
  if (name.endsWith('.run.app') || name.endsWith('.google.internal') || name.endsWith('.googleusercontent.com'))
    return true;
  return false;
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

function sendDashboard(res, opts, isHead = false) {
  let html;
  try {
    html = fs.readFileSync(DASHBOARD_PATH);
  } catch (_) {
    return send(res, 404, { error: 'dashboard not found' });
  }
  const allowIframe = (opts && opts.allowIframe) || process.env.ALLOW_IFRAME === '1';
  const csp = allowIframe
    ? "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors *"
    : "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'content-security-policy': csp,
  });
  if (isHead) {
    res.end();
  } else {
    res.end(html);
  }
}

function createServer(options) {
  const opts = options || {};
  const server = http.createServer(async (req, res) => {
    try {
      if (!isLoopbackHost(req, opts)) return send(res, 403, { error: 'forbidden host' });
      if ((req.method === 'GET' || req.method === 'HEAD') && (req.url === '/' || req.url === '/index.html')) {
        return sendDashboard(res, opts, req.method === 'HEAD');
      }
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
        return send(res, 200, {
          ok: true,
          service: 'HiClash Universal Core',
          kernel: opts.kernel || 'mihomo',
          uptime: Math.round(process.uptime()),
        });
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
      if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/adapter/status') {
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

/**
 * 解析监听参数。
 * - 本机直接运行（未设置 PORT / K_SERVICE）：只监听 127.0.0.1，保留 Host 校验与禁止 iframe，
 *   控制面没有鉴权，绝不能默认暴露到局域网。
 * - 托管容器（Cloud Run / AI Studio 预览等会注入 PORT）：监听 0.0.0.0，放开 Host 校验与 iframe，
 *   与之前的部署行为一致。
 * HOST / ALLOW_ANY_HOST / ALLOW_IFRAME 可显式覆盖。
 */
function resolveListenOptions(env) {
  const e = env || {};
  const managed = Boolean(e.PORT || e.K_SERVICE);
  const rawPort = e.PORT || e.HICLASH_CORE_PORT || (managed ? 3000 : 8787);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT / HICLASH_CORE_PORT: ' + rawPort);
  }
  const host = e.HOST || (managed ? '0.0.0.0' : '127.0.0.1');
  const loopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  return {
    port,
    host,
    allowAnyHost: e.ALLOW_ANY_HOST === '1' || (managed && !loopback),
    allowIframe: e.ALLOW_IFRAME === '1' || managed,
  };
}

if (require.main === module) {
  let listen;
  try {
    listen = resolveListenOptions(process.env);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (!listen.allowAnyHost && listen.host !== '127.0.0.1' && listen.host !== 'localhost' && listen.host !== '::1') {
    console.warn(
      'Warning: listening on a non-loopback address while Host validation stays on; set ALLOW_ANY_HOST=1 if needed.',
    );
  }
  createServer({ allowIframe: listen.allowIframe, allowAnyHost: listen.allowAnyHost }).listen(
    listen.port,
    listen.host,
    () => {
      console.log(`HiClash Universal Core listening on ${listen.host}:${listen.port}`);
    },
  );
}

module.exports = { createServer, resolveListenOptions };
