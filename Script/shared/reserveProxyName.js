/**
 * 若 name 与保留名冲突，返回「节点-<name>」形式且未被占用的安全名称；否则原样返回。
 */
function reserveProxyName(name, reservedNames, usedNames) {
  if (!reservedNames.has(name)) return name;
  let candidate = '节点-' + name;
  let index = 2;
  while (usedNames.has(candidate) || reservedNames.has(candidate)) {
    candidate = '节点-' + name + '-' + index++;
  }
  return candidate;
}
