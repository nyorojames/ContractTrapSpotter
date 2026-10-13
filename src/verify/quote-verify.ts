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
  let bestScore = 0;

  // Extract distinct anchor words from the needle (length >= 3)
  const words = needle.split(/\s+/).filter(w => w.length >= 3);
  const candidates = new Set<number>();

  const checkWords = [
    words[0],
    words[Math.floor(words.length / 2)],
    words[words.length - 1],
  ].filter(Boolean);

  for (const word of checkWords) {
    let idx = haystack.indexOf(word);
    while (idx !== -1 && candidates.size < 30) {
      candidates.add(idx);
      idx = haystack.indexOf(word, idx + 1);
    }
  }

  // Check windows around candidate anchor positions
  for (const pos of candidates) {
    for (let offset = -Math.floor(windowSize / 2); offset <= Math.floor(windowSize / 2); offset += 2) {
      const start = Math.max(0, pos + offset);
      const end = Math.min(haystack.length, start + windowSize);
      if (end - start < Math.floor(windowSize * 0.9)) continue;
      const window = haystack.substring(start, end);
      const score = diceSimilarity(needle, window);
      if (score > bestScore) {
        bestScore = score;
        if (bestScore >= 0.98) return bestScore;
      }
    }
  }

  // Fallback: fine-grained sliding window
  if (bestScore < 0.95) {
    const step = Math.max(1, Math.min(8, Math.floor(windowSize / 8)));
    for (let i = 0; i <= haystack.length - windowSize; i += step) {
      const window = haystack.substring(i, i + windowSize);
      const score = diceSimilarity(needle, window);
      if (score > bestScore) {
        bestScore = score;
        if (bestScore >= 0.98) return bestScore;
      }
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
