function foldTraditional(text) {
  return String(text).replace(traditionalRegex, (ch) => traditionalToSimplified[ch]);
}
