/**
 * Normalize text for comparison:
 * - collapse whitespace
 * - lowercase
 * - normalize typographic quotes and dashes
 */
export function normalizeText(text: string): string {
  return text
    // Normalize typographic quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // smart single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // smart double quotes
    // Normalize dashes
    .replace(/[\u2013\u2014\u2015]/g, '-')  // en-dash, em-dash, horizontal bar
    // Collapse whitespace (newlines, tabs, multiple spaces)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Check if a quote is a substring of the source text.
 * Both are normalized before comparison.
 */
export function verifyQuote(quote: string, sourceText: string): { found: boolean; matchType: 'exact' | 'approximate' | 'none'; similarity?: number } {
  const normalizedQuote = normalizeText(quote);
  const normalizedSource = normalizeText(sourceText);

  // Exact normalized match
  if (normalizedSource.includes(normalizedQuote)) {
    return { found: true, matchType: 'exact' };
  }

  // Fuzzy fallback: sliding window similarity
  const similarity = bestSlidingWindowSimilarity(normalizedQuote, normalizedSource);
  if (similarity >= 0.95) {
    return { found: true, matchType: 'approximate', similarity };
  }

  return { found: false, matchType: 'none', similarity };
}

/**
 * Compute best similarity score using a sliding window approach.
 * Uses character-level bigram similarity (Dice coefficient).
 */
function bestSlidingWindowSimilarity(needle: string, haystack: string): number {
  if (needle.length === 0 || haystack.length === 0) return 0;
  if (needle.length > haystack.length) return diceSimilarity(needle, haystack);

  const windowSize = needle.length;
  // Use a step size to avoid O(n*m) complexity on huge texts
  const step = Math.max(1, Math.floor(windowSize / 4));
  let bestScore = 0;

  for (let i = 0; i <= haystack.length - windowSize; i += step) {
    const window = haystack.substring(i, i + windowSize + Math.floor(windowSize * 0.1));
    const score = diceSimilarity(needle, window);
    if (score > bestScore) {
      bestScore = score;
      if (bestScore >= 0.98) return bestScore; // Early exit
    }
  }

  return bestScore;
}

/**
 * Dice coefficient using character bigrams.
 */
function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) || 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = bigramsA.get(bigram);
    if (count && count > 0) {
      bigramsA.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2 * intersectionSize) / (a.length - 1 + b.length - 1);
}
