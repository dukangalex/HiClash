/**
 * 预编译 hosts 条目，返回「域名 → 命中条目」的查找函数。
 * 精确 / `+.` / `.` 三类按模式建索引，通配模式保底逐个比对；
 * 同类型命中时取 hosts 中靠前者，与「按优先级排序后线性查找」的结果保持一致。
 * 入参需已按 hostSpecificity 降序排列（同一键只保留最先出现的一条）
 */
function createHostFinder(hostEntries) {
  const exact = new Map();
  const plus = new Map();
  const dot = new Map();
  const wildcards = [];

  hostEntries.forEach((entry, index) => {
    const pattern = entry[0].toLowerCase();
    const level = hostSpecificity(pattern);
    if (level === 0) {
      wildcards.push(entry);
      return;
    }
    const [map, key] =
      level === 3 ? [exact, pattern] : level === 2 ? [plus, pattern.slice(2)] : [dot, pattern.slice(1)];
    if (!map.has(key)) map.set(key, { entry, index });
  });

  const firstOf = (map, keys) => {
    let found = null;
    for (const key of keys) {
      const item = map.get(key);
      if (item && (!found || item.index < found.index)) found = item;
    }
    return found?.entry;
  };

  return (domain) => {
    const exactEntry = exact.get(domain)?.entry;
    if (exactEntry) return exactEntry;

    const parts = domain.split('.');
    const suffixes = parts.map((_, i) => parts.slice(i).join('.'));
    return (
      firstOf(plus, suffixes) ??
      firstOf(dot, suffixes.slice(1)) ??
      wildcards.find(([pattern]) => matchDomainPattern(pattern, domain))
    );
  };
}
