import { detectLegalPage } from '../capture/detect';
import { capturePageText } from '../capture';
import { scanForInjections, scanHtmlComments } from '../injection/scanner';
import { createReportPanel } from '../ui/panel';

const DISCLAIMER = 'This tool does not provide legal advice. It highlights clauses that may deserve attention; consult a qualified professional for legal questions.';

let analyzeButton: HTMLElement | null = null;
let reportPanel: HTMLElement | null = null;

/**
 * Inject the "Analyze" floating button
 */
function injectAnalyzeButton(): void {
  if (analyzeButton) return;

  analyzeButton = document.createElement('div');
  analyzeButton.id = 'cts-analyze-btn';
  analyzeButton.setAttribute('data-testid', 'cts-analyze-btn');
  
  // Use shadow DOM to isolate styles
  const shadow = analyzeButton.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      button {
        background: #1a73e8;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
      }
      button:hover {
        background: #1557b0;
      }
      button:disabled {
        background: #999;
        cursor: not-allowed;
      }
      .icon {
        font-size: 18px;
      }
    </style>
    <button id="btn">
      <span class="icon">🔍</span>
      <span>Analyze Terms</span>
    </button>
  `;

  const btn = shadow.getElementById('btn')!;
  btn.addEventListener('click', handleAnalyze);

  document.body.appendChild(analyzeButton);
}

/**
 * Handle the Analyze button click
 */
async function handleAnalyze(): Promise<void> {
  if (!analyzeButton) return;
  const shadow = analyzeButton.shadowRoot!;
  const btn = shadow.getElementById('btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = '<span class="icon">⏳</span><span>Analyzing...</span>';

  try {
    // Capture page text
    const capture = capturePageText();

    // Scan HTML comments for injections
    const commentInjections = scanHtmlComments(capture.rawHtml);

    // Send to background for analysis
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE',
      data: {
        text: capture.text,
        url: capture.url,
        title: capture.title,
        hiddenContentCount: capture.hiddenContentDetected.length,
      },
    });

    if (response.type === 'ANALYZE_ERROR') {
      showError(response.error);
      return;
    }

    if (response.type === 'ANALYZE_RESULT') {
      // Add comment injection warnings to the result
      if (commentInjections.length > 0) {
        response.data.injectionWarnings = [
          ...response.data.injectionWarnings,
          ...commentInjections.map((w: { matchedText: string; pattern: string }) => `Injection in HTML comment: "${w.matchedText}" (${w.pattern})`),
        ];
      }
      showReport(response.data, capture.text);
    }
  } catch (err) {
    showError(String(err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="icon">🔍</span><span>Analyze Terms</span>';
  }
}

/**
 * Show the report panel
 */
function showReport(data: any, sourceText: string): void {
  if (reportPanel) {
    reportPanel.remove();
  }
  reportPanel = createReportPanel(data, sourceText, () => {
    reportPanel?.remove();
    reportPanel = null;
  });
  document.body.appendChild(reportPanel);
}

/**
 * Show an error message
 */
function showError(error: string): void {
  if (reportPanel) {
    reportPanel.remove();
  }
  reportPanel = createReportPanel({
    score: 0,
    label: 'Inconclusive',
    clauses: [],
    droppedCount: 0,
    injectionWarnings: [],
    uncertaintyReasons: [`Analysis failed: ${error}`],
    documentType: 'other',
    disclaimer: DISCLAIMER,
    hiddenContentCount: 0,
  }, '', () => {
    reportPanel?.remove();
    reportPanel = null;
  });
  document.body.appendChild(reportPanel);
}

// Main: detect legal page and show button
function init(): void {
  const detection = detectLegalPage();
  if (detection.isLegal) {
    console.log('[ContractTrapSpotter] Legal page detected:', detection.matchedSignals);
    injectAnalyzeButton();
  }
}

// Run detection
init();
