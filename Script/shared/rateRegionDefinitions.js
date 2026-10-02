const rateRegionDefinitions = [
  {
    name: lowRateRegionName,
    regex:
      /^(?!.*(?:剩|期)).*(?:(?<!\d)0\.[0-5]|(?<=[ \[\(|｜丨∣┃\-‐–—−－﹣])0[*×✕✖⨯⨉x倍])|(?:(?<=[ \[\(|｜丨∣┃\-‐–—−－﹣])[*×✕✖⨯⨉x]0(?=[ \)\]]|倍|$))|^(?!.*(?:客户端|软件)).*下载|低倍|免费|(?<![A-Za-z])free(?![A-Za-z])/i,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@assets-v1/Icons/svg/Available.svg',
  },
  {
    name: highRateRegionName,
    regex:
      /(?<=[ \[\(|｜丨∣┃\-‐–—−－﹣])((?:[*×✕✖⨯⨉x]\s*(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?)|(?:(?<![\d.])(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?\s*(?:倍|[*×✕✖⨯⨉x])))/i,
    icon: 'https://fastly.jsdelivr.net/gh/dukangalex/HiClash@assets-v1/Icons/svg/Airport.svg',
  },
];
