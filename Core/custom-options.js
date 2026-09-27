'use strict';

const customOptionsSchema = Object.freeze({
  version: 1,
  type: 'toggle-map',
  source: 'ruleOptionsEnable',
  options: Object.freeze({
    手动选择: { category: '基础策略组', default: true },
    自动选择: { category: '基础策略组', default: true },
    故障转移: { category: '基础策略组', default: true },
    远控工具: { category: '基础策略组', default: true },
    Google: { category: '分流策略', default: true },
    AI: { category: '分流策略', default: true },
    Telegram: { category: '分流策略', default: true },
    Steam: { category: '分流策略', default: true },
    AdBlock: { category: '分流策略', default: true },
    极简模式: { category: '其他', default: false },
    生成地区自动选择组: { category: '其他', default: true },
    隐藏地区手动选择组: { category: '其他', default: false },
    生成倍率组: { category: '其他', default: true },
    分流组添加所有节点: { category: '其他', default: false },
    过滤低倍率节点: { category: '其他', default: false },
    过滤高倍率节点: { category: '其他', default: false },
    过滤非地区节点: { category: '其他', default: true },
    屏蔽国外QUIC: { category: '安全', default: true },
    代理IPV4优先: { category: '网络', default: false },
    代理IPV6优先: { category: '网络', default: false },
    链式代理: { category: '链式代理', default: false },
  }),
});

function getDefaultCustomOptions() {
  return Object.fromEntries(Object.entries(customOptionsSchema.options).map(([key, value]) => [key, value.default]));
}

function validateCustomOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('custom options must be an object');
  }

  const allowed = new Set(Object.keys(customOptionsSchema.options));
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknown.length) {
    throw new Error('unknown custom option: ' + unknown[0]);
  }

  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'boolean') {
      throw new Error('custom option ' + key + ' must be boolean');
    }
  }

  return true;
}

module.exports = {
  customOptionsSchema,
  getDefaultCustomOptions,
  validateCustomOptions,
};
