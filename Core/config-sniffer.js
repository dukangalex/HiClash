'use strict';

/**
 * Universal Config Sniffer
 * Detects share links and the four supported configuration families.
 * Detection is intentionally conservative: ambiguous input is returned as unknown.
 */

const LINK_SCHEMES = [
  'vmess:',
  'vless:',
  'trojan:',
  'hysteria:',
  'hysteria2:',
  'hy2:',
  'ss:',
  'socks:',
  'http:',
  'https:',
];

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function sniffJson(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const has = (key) => Object.prototype.hasOwnProperty.call(value, key);
  if (has('inbounds') && has('outbounds') && (has('route') || has('dns'))) {
    return { format: 'sing-box', kernel: 'sing-box', confidence: 0.99 };
  }
  if (has('inbounds') && has('outbounds') && (has('routing') || has('policy'))) {
    return { format: 'xray', kernel: 'xray', confidence: 0.98 };
  }
  return null;
}

function sniffYaml(text) {
  const hasProxyList = /(^|\n)\s*proxies\s*:/i.test(text);
  const hasRules = /(^|\n)\s*rules\s*:/i.test(text);
  const hasProxyProviders = /(^|\n)\s*proxy-providers\s*:/i.test(text);
  if (hasProxyList || hasRules || hasProxyProviders) {
    return { format: 'mihomo-yaml', kernel: 'mihomo', confidence: 0.97 };
  }
  return null;
}

function sniffShareLink(text) {
  const line = text.trim().split(/\s+/)[0];
  const scheme = LINK_SCHEMES.find((item) => line.toLowerCase().startsWith(item));
  if (!scheme) return null;
  let kernel = 'sing-box';
  if (scheme === 'vmess:' || scheme === 'vless:' || scheme === 'trojan:' || scheme === 'ss:') {
    kernel = 'sing-box';
  }
  return {
    format: 'share-link',
    protocol: scheme.slice(0, -1),
    kernel,
    confidence: 0.9,
  };
}

function sniff(input) {
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input || '');
  const trimmed = text.trim();
  if (!trimmed) return { format: 'unknown', kernel: null, confidence: 0 };

  const link = sniffShareLink(trimmed);
  if (link) return link;

  const parsed = safeJson(trimmed);
  const json = sniffJson(parsed);
  if (json) return json;

  const yaml = sniffYaml(trimmed);
  if (yaml) return yaml;

  return { format: 'unknown', kernel: null, confidence: 0 };
}

module.exports = { sniff };
