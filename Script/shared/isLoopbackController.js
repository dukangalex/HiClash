function isLoopbackController(value) {
  if (typeof value !== 'string') return false;
  const match = /^(127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})$/i.exec(value.trim());
  return Boolean(match) && isValidPort(Number(match[2]));
}
