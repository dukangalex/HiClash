const ruleProviderCommonDomain = {
  type: 'http',
  behavior: 'domain',
  format: 'mrs',
  interval: 86400,
  proxy: 'DIRECT',
  header: {
    'User-Agent': ['mihomo/1.19.32'],
  },
};
