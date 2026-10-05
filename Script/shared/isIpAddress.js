/**
 * 判断节点 server 是否为 IP 地址（IPv4 / IPv6），用于从节点域名集合中排除 IP 类型的 server
 */
function isIpAddress(server) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(server) || server.includes(':');
}
