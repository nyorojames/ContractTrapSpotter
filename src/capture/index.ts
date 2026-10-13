/**
 * Captures clean text from the page DOM.
 * Strips scripts, styles, nav, cookie banners.
 * Detects and strips hidden content (display:none, visibility:hidden, etc.)
 */

export interface CaptureResult {
  text: string;
  rawHtml: string;
  hiddenContentDetected: HiddenContent[];
  url: string;
  title: string;
  capturedAt: string;
}

export interface HiddenContent {
  type: 'display-none' | 'visibility-hidden' | 'aria-hidden' | 'zero-font' | 'opacity-zero' | 'off-screen' | 'white-on-white';
  text: string;
  element: string; // tag name + first few chars
}

/**
 * Elements to exclude from capture
 */
const EXCLUDED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS',
  'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED',
]);

/**
 * Elements likely to be navigation/chrome, not legal content
 */
const NAV_SELECTORS = [
  'nav', 'header:not(article header)', 'footer',
  '[role="navigation"]', '[role="banner"]',
  '.cookie-banner', '.cookie-consent', '#cookie-consent',
  '.cookie-notice', '#cookie-notice',
  '[class*="cookie"]', '[id*="cookie"]',
];

/**
 * Check if an element is hidden via CSS or attributes.
 */
function detectHidden(el: Element): HiddenContent | null {
  const style = window.getComputedStyle(el);
  const tagDesc = `<${el.tagName.toLowerCase()}>`;
  const text = (el.textContent || '').trim().substring(0, 100);

  if (!text) return null;

  if (style.display === 'none') {
    return { type: 'display-none', text, element: tagDesc };
  }
  if (style.visibility === 'hidden') {
    return { type: 'visibility-hidden', text, element: tagDesc };
  }
  if (el.getAttribute('aria-hidden') === 'true') {
    return { type: 'aria-hidden', text, element: tagDesc };
  }
  const fontSize = parseFloat(style.fontSize);
  if (fontSize === 0 || style.fontSize === '0' || style.fontSize === '0px') {
    return { type: 'zero-font', text, element: tagDesc };
  }
  const opacity = parseFloat(style.opacity);
  if (opacity === 0) {
    return { type: 'opacity-zero', text, element: tagDesc };
  }

  // Off-screen detection
  const rect = el.getBoundingClientRect();
  if (rect.right < 0 || rect.bottom < 0 || rect.left > window.innerWidth + 100 || rect.top > window.innerHeight * 10) {
    // Only flag if it seems deliberately positioned off-screen
    if (style.position === 'absolute' || style.position === 'fixed') {
      return { type: 'off-screen', text, element: tagDesc };
    }
  }

  // White-on-white detection
  if (style.color === style.backgroundColor && style.color !== '' && style.color !== 'transparent') {
    return { type: 'white-on-white', text, element: tagDesc };
  }

  return null;
}

/**
 * Extract clean text from the page, stripping hidden and non-content elements.
 */
export function capturePageText(): CaptureResult {
  const hiddenContentDetected: HiddenContent[] = [];
  const rawHtml = document.documentElement.outerHTML;

  // Remove nav elements from consideration
  const navElements = new Set<Element>();
  for (const selector of NAV_SELECTORS) {
    try {
      document.querySelectorAll(selector).forEach(el => navElements.add(el));
    } catch { /* invalid selector, skip */ }
  }

  function extractText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;

    // Skip excluded tags
    if (EXCLUDED_TAGS.has(el.tagName)) return '';

    // Skip nav elements
    if (navElements.has(el)) return '';

    // Check for hidden content
    const hidden = detectHidden(el);
    if (hidden) {
      hiddenContentDetected.push(hidden);
      return ''; // Strip hidden content
    }

    // Recurse into children
    let text = '';
    for (const child of el.childNodes) {
      text += extractText(child);
    }

    // Add paragraph breaks for block elements
    const blockTags = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'BR', 'HR', 'BLOCKQUOTE']);
    if (blockTags.has(el.tagName)) {
      text = '\n' + text + '\n';
    }

    return text;
  }

  // Find the main content area, or fall back to body
  const mainContent = document.querySelector('main, [role="main"], article, .content, #content') || document.body;
  let text = extractText(mainContent);

  // Clean up whitespace
  text = text
    .replace(/\n{3,}/g, '\n\n')  // max 2 newlines
    .replace(/[ \t]+/g, ' ')      // collapse spaces
    .trim();

  return {
    text,
    rawHtml,
    hiddenContentDetected,
    url: window.location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
  };
}
