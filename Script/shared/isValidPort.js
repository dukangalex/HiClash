function isValidPort(value) {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}
