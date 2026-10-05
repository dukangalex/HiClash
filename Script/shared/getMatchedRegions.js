function getMatchedRegions(proxyName) {
  if (regionMatchCache.has(proxyName)) {
    return regionMatchCache.get(proxyName);
  }

  const text = foldTraditional(proxyName);
  const regions = allRegionDefinitions.filter((region) => region.regex.test(text));
  const geoMatches = regions.filter((region) => regionDefinitions.includes(region));
  const otherMatches = regions.filter((region) => !regionDefinitions.includes(region));
  let selectedGeo = geoMatches;
  if (geoMatches.length > 1) {
    const matchLength = (region) => {
      const match = text.match(region.regex);
      return match ? match[0].length : 0;
    };
    const bestLen = Math.max(...geoMatches.map(matchLength));
    selectedGeo = geoMatches.filter((region) => matchLength(region) === bestLen);
  }
  const result = [...selectedGeo, ...otherMatches];
  regionMatchCache.set(proxyName, result);

  return result;
}
