import type { Clause } from '../schema';
import type { RiskLabel } from '../score';

const DISCLAIMER = 'This tool does not provide legal advice. It highlights clauses that may deserve attention; consult a qualified professional for legal questions.';

interface ReportData {
  score: number;
  label: RiskLabel | string;
  clauses: Clause[];
  droppedCount: number;
  injectionWarnings: string[];
  uncertaintyReasons: string[];
  documentType: string;
  disclaimer: string;
  hiddenContentCount: number;
  captureMethod?: 'page-agent' | 'native-dom';
  captureFallbackReason?: string;
  isMock?: boolean;
}

/**
 * Highlight a quote in the page by scrolling to it and adding a temporary highlight.
 */
function locateInPage(quote: string): void {
  // Remove existing highlights
  document.querySelectorAll('.cts-highlight').forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
      parent.normalize();
    }
  });

  // Use window.find or TreeWalker to locate the text
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = (node.textContent || '').toLowerCase().replace(/\s+/g, ' ');
    if (text.includes(normalizedQuote)) {
      // Found it - wrap in a highlight span
      const range = document.createRange();
      const startIdx = text.indexOf(normalizedQuote);

      // Map back to the original text positions
      let origIdx = 0;
      let normIdx = 0;
      const origText = node.textContent || '';
      while (normIdx < startIdx && origIdx < origText.length) {
        if (/\s/.test(origText[origIdx])) {
          while (origIdx < origText.length && /\s/.test(origText[origIdx])) origIdx++;
          normIdx++;
        } else {
          origIdx++;
          normIdx++;
        }
      }
      const origStart = origIdx;

      let endNormIdx = normIdx;
      while (endNormIdx < startIdx + normalizedQuote.length && origIdx < origText.length) {
        if (/\s/.test(origText[origIdx])) {
          while (origIdx < origText.length && /\s/.test(origText[origIdx])) origIdx++;
          endNormIdx++;
        } else {
          origIdx++;
          endNormIdx++;
        }
      }
      const origEnd = origIdx;

      try {
        range.setStart(node, origStart);
        range.setEnd(node, Math.min(origEnd, origText.length));

        const highlight = document.createElement('mark');
        highlight.className = 'cts-highlight';
        highlight.style.cssText = 'background: #ffeb3b; padding: 2px 4px; border-radius: 3px; scroll-margin: 100px;';

        range.surroundContents(highlight);
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // If surroundContents fails (crosses element boundaries), just scroll
        node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
  }
}

/**
 * Get color for risk label
 */
function getLabelColor(label: string): string {
  switch (label) {
    case 'Low': return '#4caf50';
    case 'Medium': return '#ff9800';
    case 'High': return '#f44336';
    case 'Inconclusive': return '#9e9e9e';
    default: return '#9e9e9e';
  }
}

/**
 * Get color for severity
 */
function getSeverityColor(severity: number): string {
  if (severity <= 2) return '#4caf50';
  if (severity <= 3) return '#ff9800';
  return '#f44336';
}

/**
 * Create the report panel as a Shadow DOM element
 */
export function createReportPanel(
  data: ReportData,
  sourceText: string,
  onClose: () => void
): HTMLElement {
  const host = document.createElement('div');
  host.id = 'cts-report-panel';
  host.setAttribute('data-testid', 'cts-report-panel');

  const shadow = host.attachShadow({ mode: 'open' });

  const labelColor = getLabelColor(data.label);

  let clausesHtml = '';
  if (data.clauses.length === 0) {
    clausesHtml = '<div class="no-clauses">No risky clauses were verified in this document.</div>';
  } else {
    for (const clause of data.clauses) {
      clausesHtml += `
        <div class="clause" data-testid="clause-item">
          <div class="clause-header">
            <span class="category">${clause.category.replace(/_/g, ' ')}</span>
            <span class="severity" style="background: ${getSeverityColor(clause.severity)}">
              Severity: ${clause.severity}/5
            </span>
            <span class="confidence">Confidence: ${Math.round(clause.confidence * 100)}%</span>
          </div>
          <div class="quote" data-testid="clause-quote">
            "${escapeHtml(clause.quote)}"
          </div>
          <div class="explanation">${escapeHtml(clause.explanation)}</div>
          <button class="locate-btn" data-testid="locate-btn" data-quote="${escapeAttr(clause.quote)}">
            📍 Locate in page
          </button>
        </div>
      `;
    }
  }

  let warningsHtml = '';
  if (data.injectionWarnings.length > 0) {
    warningsHtml = `
      <div class="warnings" data-testid="injection-warnings">
        <div class="warning-title">⚠️ Injection Attempts Detected</div>
        ${data.injectionWarnings.map(w => `<div class="warning-item">${escapeHtml(w)}</div>`).join('')}
      </div>
    `;
  }

  let uncertaintyHtml = '';
  if (data.uncertaintyReasons.length > 0) {
    uncertaintyHtml = `
      <div class="uncertainty" data-testid="uncertainty-notices">
        <div class="uncertainty-title">ℹ️ Uncertainty Notices</div>
        ${data.uncertaintyReasons.map(r => `<div class="uncertainty-item">${escapeHtml(r)}</div>`).join('')}
      </div>
    `;
  }

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        top: 0;
        right: 0;
        width: 420px;
        height: 100vh;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .panel {
        background: #fff;
        color: #333;
        height: 100%;
        overflow-y: auto;
        box-shadow: -2px 0 12px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
      }
      .panel-header {
        background: #1a1a2e;
        color: white;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .panel-title {
        font-size: 16px;
        font-weight: 700;
      }
      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
      }
      .close-btn:hover {
        opacity: 0.8;
      }
      .score-section {
        padding: 20px 16px;
        text-align: center;
        border-bottom: 1px solid #eee;
      }
      .score-value {
        font-size: 48px;
        font-weight: 800;
        color: ${labelColor};
      }
      .score-label {
        font-size: 18px;
        font-weight: 600;
        color: ${labelColor};
        margin-top: 4px;
      }
      .stats {
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-top: 12px;
        font-size: 12px;
        color: #666;
      }
      .disclaimer {
        background: #fff3cd;
        color: #856404;
        padding: 10px 16px;
        font-size: 11px;
        line-height: 1.4;
        border-bottom: 1px solid #ffc107;
      }
      .content {
        padding: 16px;
        flex: 1;
      }
      .clause {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .clause-header {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }
      .category {
        background: #e3f2fd;
        color: #1565c0;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .severity {
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }
      .confidence {
        color: #666;
        font-size: 11px;
      }
      .quote {
        background: #f5f5f5;
        padding: 8px;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 8px;
        font-style: italic;
        border-left: 3px solid #1a73e8;
      }
      .explanation {
        font-size: 13px;
        line-height: 1.5;
        color: #555;
        margin-bottom: 8px;
      }
      .locate-btn {
        background: none;
        border: 1px solid #1a73e8;
        color: #1a73e8;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      }
      .locate-btn:hover {
        background: #e3f2fd;
      }
      .no-clauses {
        text-align: center;
        color: #666;
        padding: 24px;
        font-size: 14px;
      }
      .warnings {
        background: #fff3e0;
        border: 1px solid #ff9800;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .warning-title {
        font-weight: 700;
        color: #e65100;
        margin-bottom: 8px;
      }
      .warning-item {
        font-size: 12px;
        color: #bf360c;
        margin-bottom: 4px;
      }
      .uncertainty {
        background: #e3f2fd;
        border: 1px solid #90caf9;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .uncertainty-title {
        font-weight: 700;
        color: #1565c0;
        margin-bottom: 8px;
      }
      .uncertainty-item {
        font-size: 12px;
        color: #1565c0;
        margin-bottom: 4px;
      }
      .dropped-notice {
        text-align: center;
        color: #f57c00;
        font-size: 12px;
        padding: 8px;
      }
    </style>
    <div class="panel" data-testid="report-panel-inner">
      <div class="panel-header">
        <span class="panel-title">ContractTrapSpotter Report</span>
        <button class="close-btn" data-testid="close-btn">✕</button>
      </div>
      <div class="disclaimer" data-testid="disclaimer">
        ⚖️ ${escapeHtml(DISCLAIMER)}
      </div>
      <div class="score-section">
        <div class="score-value" data-testid="risk-score">${data.score}</div>
        <div class="score-label" data-testid="risk-label">${data.label} Risk</div>
        <div class="stats">
          <span>${data.clauses.length} clauses found</span>
          <span>•</span>
          <span>Type: ${data.documentType}</span>
          ${data.isMock ? `<span>•</span><span class="mock-badge" data-testid="mock-indicator" style="background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">Mock LLM</span>` : ''}
        </div>
        <div class="capture-stat" data-testid="capture-method" style="margin-top: 6px; font-size: 11px; color: #555;">
          Capture: <code>${escapeHtml(data.captureMethod || 'native-dom')}</code>${data.captureFallbackReason ? ` <span style="color:#b71c1c;">(${escapeHtml(data.captureFallbackReason)})</span>` : ''}
        </div>
      </div>
      <div class="content">
        ${warningsHtml}
        ${uncertaintyHtml}
        ${data.droppedCount > 0 ? `<div class="dropped-notice" data-testid="dropped-count">⚠️ ${data.droppedCount} claim(s) dropped because the quote could not be verified</div>` : ''}
        ${clausesHtml}
      </div>
    </div>
  `;

  // Event listeners
  const closeBtn = shadow.querySelector('.close-btn');
  closeBtn?.addEventListener('click', onClose);

  // Locate buttons
  shadow.querySelectorAll('.locate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const quote = (btn as HTMLElement).getAttribute('data-quote') || '';
      locateInPage(quote);
    });
  });

  return host;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
