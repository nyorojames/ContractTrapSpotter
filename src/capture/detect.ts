/**
 * Detects if the current page is likely a legal document
 * (ToS, privacy policy, subscription terms, etc.)
 */

const LEGAL_URL_PATTERNS = [
  /terms[-_]?(of[-_]?service|and[-_]?conditions|of[-_]?use)?/i,
  /privacy[-_]?(policy|notice|statement)?/i,
  /\beula\b/i,
  /\btos\b/i,
  /legal[-_]?(terms|notice|agreement)?/i,
  /user[-_]?agreement/i,
  /subscription[-_]?(terms|agreement)/i,
  /billing[-_]?(terms|agreement|policy)/i,
  /acceptable[-_]?use/i,
  /data[-_]?(processing|protection)[-_]?(agreement|policy|addendum)/i,
  /cookie[-_]?(policy|notice)/i,
  /end[-_]?user[-_]?license/i,
];

const LEGAL_HEADING_PATTERNS = [
  /terms\s+(of\s+)?(service|use|conditions)/i,
  /privacy\s+(policy|notice|statement)/i,
  /\beula\b/i,
  /user\s+agreement/i,
  /subscription\s+(terms|agreement)/i,
  /end[\s-]+user\s+license\s+agreement/i,
  /data\s+(processing|protection)\s+(agreement|addendum)/i,
  /acceptable\s+use\s+policy/i,
  /billing\s+(terms|policy)/i,
  /cookie\s+policy/i,
  /legal\s+(terms|notice)/i,
];

export interface DetectionResult {
  isLegal: boolean;
  confidence: number; // 0-1
  matchedSignals: string[];
}

export function detectLegalPage(): DetectionResult {
  const signals: string[] = [];
  let score = 0;

  // Check URL
  const url = window.location.href.toLowerCase();
  for (const pattern of LEGAL_URL_PATTERNS) {
    if (pattern.test(url)) {
      signals.push(`URL matches: ${pattern.source}`);
      score += 3;
      break; // One URL match is enough
    }
  }

  // Check page title
  const title = document.title;
  for (const pattern of LEGAL_HEADING_PATTERNS) {
    if (pattern.test(title)) {
      signals.push(`Title matches: "${title}"`);
      score += 2;
      break;
    }
  }

  // Check headings (h1, h2)
  const headings = document.querySelectorAll('h1, h2');
  for (const heading of headings) {
    const text = heading.textContent || '';
    for (const pattern of LEGAL_HEADING_PATTERNS) {
      if (pattern.test(text)) {
        signals.push(`Heading matches: "${text.trim().substring(0, 80)}"`);
        score += 2;
        break;
      }
    }
    if (score >= 3) break; // Don't over-count headings
  }

  // Check for long text blocks (legal docs tend to be very long)
  const bodyText = document.body?.innerText || '';
  if (bodyText.length > 5000) {
    signals.push('Long document (>5000 chars)');
    score += 1;
  }

  const confidence = Math.min(1, score / 5);

  return {
    isLegal: score >= 2,
    confidence,
    matchedSignals: signals,
  };
}
