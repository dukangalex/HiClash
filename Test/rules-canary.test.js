'use strict';

/**
 * 规则集金丝雀：脚本引用的是官方 meta-rules-dat 的 `meta` 分支，会随上游每天更新。
 * 这里下载并解码官方规则集，检查「数量没有异常波动」「标志性域名/IP 分类仍然正确」，
 * 以便尽早发现上游被投毒、误推送或格式损坏。需要联网与真实 Mihomo 二进制：
 *
 *   MIHOMO_BIN=/path/to/mihomo node Test/rules-canary.test.js
 *
 * 退出码：0 通过；1 金丝雀告警（规则内容异常）；2 网络/环境问题（不代表规则有问题）。
 * 有意的大幅变化请更新基线：UPDATE_CANARY_BASELINE=1 MIHOMO_BIN=... node Test/rules-canary.test.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MIHOMO_BIN = process.env.MIHOMO_BIN;
const BASE = 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/';
const BASELINE_PATH = path.join(__dirname, 'rules-canary-baseline.json');
const TOLERANCE = 0.25; // 相对基线允许的数量波动
const repoRoot = path.join(__dirname, '..');

function envFail(message) {
  console.error('[canary:env] ' + message);
  process.exit(2);
}
function alarm(message) {
  console.error('[canary:ALARM] ' + message);
  process.exit(1);
}

if (!MIHOMO_BIN || !fs.existsSync(MIHOMO_BIN)) envFail('MIHOMO_BIN must point to a mihomo binary');

async function download(file, dest) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(BASE + file, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  envFail('download failed for ' + file + ': ' + lastError.message);
}

function decode(behavior, mrsPath, outPath) {
  const r = spawnSync(MIHOMO_BIN, ['convert-ruleset', behavior, 'mrs', mrsPath, outPath], { encoding: 'utf8' });
  if (r.status !== 0)
    alarm('cannot decode ' + path.basename(mrsPath) + ' (corrupt or format changed): ' + (r.stderr || r.stdout));
  return fs
    .readFileSync(outPath, 'utf8')
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
}

function domainMatcher(entries) {
  const suffixes = new Set();
  const exact = new Set();
  for (const e of entries) {
    if (e.startsWith('+.')) suffixes.add(e.slice(2));
    else if (e.startsWith('.')) suffixes.add(e.slice(1));
    else exact.add(e);
  }
  const covers = (domain) => {
    if (exact.has(domain)) return true;
    const parts = domain.split('.');
    for (let i = 0; i < parts.length; i += 1) if (suffixes.has(parts.slice(i).join('.'))) return true;
    return false;
  };
  return { covers, suffixes };
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}
function cidrMatcher(entries) {
  const ranges = [];
  for (const e of entries) {
    const [addr, bitsRaw] = e.split('/');
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(addr)) continue; // IPv6 在此不检查
    const size = 2 ** (32 - Number(bitsRaw === undefined ? 32 : bitsRaw));
    const start = Math.floor(ipv4ToInt(addr) / size) * size;
    ranges.push([start, start + size - 1]);
  }
  return (ip) => {
    const n = ipv4ToInt(ip);
    return ranges.some(([a, b]) => n >= a && n <= b);
  };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiclash-canary-'));
  try {
    const files = { cn: 'geosite/cn.mrs', notcn: 'geosite/geolocation-%21cn.mrs', cnip: 'geoip/cn.mrs' };
    for (const [key, file] of Object.entries(files)) await download(file, path.join(dir, key + '.mrs'));

    const cn = decode('domain', path.join(dir, 'cn.mrs'), path.join(dir, 'cn.txt'));
    const notcn = decode('domain', path.join(dir, 'notcn.mrs'), path.join(dir, 'notcn.txt'));
    const cnip = decode('ipcidr', path.join(dir, 'cnip.mrs'), path.join(dir, 'cnip.txt'));
    const counts = { cn: cn.length, notcn: notcn.length, cnip: cnip.length };
    console.log('official rule-set sizes:', JSON.stringify(counts));

    if (process.env.UPDATE_CANARY_BASELINE === '1') {
      fs.writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n', 'utf8');
      console.log('baseline updated');
      return;
    }

    // 1. 数量相对基线不能剧变（被清空、被灌水、格式变化都会触发）。
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    for (const key of Object.keys(baseline)) {
      const ratio = counts[key] / baseline[key];
      if (ratio < 1 - TOLERANCE || ratio > 1 + TOLERANCE) {
        alarm(
          `${key}: ${counts[key]} entries vs baseline ${baseline[key]} (x${ratio.toFixed(2)}, tolerance ±${TOLERANCE * 100}%)`,
        );
      }
    }

    // 2. 标志性域名分类。
    const cnM = domainMatcher(cn);
    const notcnM = domainMatcher(notcn);
    for (const d of ['baidu.com', 'qq.com', 'taobao.com', 'alipay.com', 'bilibili.com', 'weibo.com']) {
      if (!cnM.covers(d)) alarm(`${d} should be in cn but is not`);
      if (notcnM.covers(d)) alarm(`${d} is in cn and must not be in geolocation-!cn`);
    }
    for (const d of ['google.com', 'youtube.com', 'github.com', 'facebook.com', 'openai.com', 'telegram.org']) {
      if (cnM.covers(d)) alarm(`${d} must NOT be in cn (would be sent DIRECT)`);
      if (!notcnM.covers(d)) alarm(`${d} should be in geolocation-!cn but is not`);
    }

    // 3. 标志性 IP。
    const inCn = cidrMatcher(cnip);
    for (const ip of ['114.114.114.114', '223.5.5.5', '119.29.29.29'])
      if (!inCn(ip)) alarm(`${ip} should be in geoip cn`);
    for (const ip of ['8.8.8.8', '1.1.1.1', '9.9.9.9'])
      if (inCn(ip)) alarm(`${ip} must NOT be in geoip cn (would be sent DIRECT)`);

    // 4. cn 与 geolocation-!cn 的域名级重叠比例（排除整个顶级域条目）。
    let overlap = 0;
    for (const s of cnM.suffixes) {
      if (!s.includes('.')) continue;
      const parts = s.split('.');
      let hit = false;
      for (let i = 0; i < parts.length - 1 && !hit; i += 1) hit = notcnM.suffixes.has(parts.slice(i).join('.'));
      if (hit) overlap += 1;
    }
    const overlapRatio = overlap / Math.max(1, cnM.suffixes.size);
    console.log(`cn ∩ !cn (domain level): ${overlap} (${(overlapRatio * 100).toFixed(2)}% of cn)`);
    if (overlapRatio > 0.05)
      alarm(`cn / geolocation-!cn overlap is ${(overlapRatio * 100).toFixed(1)}% (>5%): lists look inconsistent`);

    // 5. 自托管补充名单（本仓库）必须仍是合法的 mrs，且条目数与源文件一致。
    const own = decode('domain', path.join(repoRoot, 'Rules', 'cn-additional-list.mrs'), path.join(dir, 'own.txt'));
    const ownSource = fs
      .readFileSync(path.join(repoRoot, 'Rules', 'cn-additional-list.txt'), 'utf8')
      .split('\n')
      .filter(Boolean);
    if (own.length !== ownSource.length)
      alarm(`cn-additional-list.mrs has ${own.length} entries but .txt has ${ownSource.length}`);

    console.log('Rules canary passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => envFail(err.stack || String(err)));
