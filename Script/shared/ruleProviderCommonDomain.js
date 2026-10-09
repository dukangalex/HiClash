const ruleProviderCommonDomain = {
  type: 'http',
  behavior: 'domain',
  format: 'mrs',
  interval: 86400,
  proxy: '默认代理', // 规则集经代理下载，不向 jsDelivr 暴露真实 IP
  header: {
    'User-Agent': ['mihomo/1.19.32'],
  },
};
