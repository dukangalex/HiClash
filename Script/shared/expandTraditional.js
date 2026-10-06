function expandTraditional(source) {
  return source.replace(simplifiedRegex, (ch) => '[' + simplifiedToTraditional[ch] + ']');
}
