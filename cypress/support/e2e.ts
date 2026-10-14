import { scanForInjections } from '../../src/injection/scanner';
import { verifyQuote } from '../../src/verify/quote-verify';
import { computeScore } from '../../src/score';
import type { Clause } from '../../src/schema';

declare global {
  namespace Cypress {
    interface Chainable {
      injectExtension(): Chainable<void>;
    }
  }
}

const MOCK_CLAUSES: Clause[] = [
  {
    id: 'mock-1',
    category: 'auto_renewal',
    severity: 3,
    quote: 'Your subscription will automatically renew',
    explanation: 'The service automatically renews your subscription, which means you may be charged without explicit re-authorization.',
    confidence: 0.9,
  },
  {
    id: 'mock-2',
    category: 'third_party_data_sharing',
    severity: 4,
    quote: 'We may share your personal information with third-party partners',
    explanation: 'Your personal data may be shared with unnamed third parties, giving you limited control over who accesses your information.',
    confidence: 0.85,
  },
  {
    id: 'mock-3',
    category: 'unilateral_changes',
    severity: 3,
    quote: 'We reserve the right to modify these terms at any time without prior notice',
    explanation: 'The company can change the agreement at any time without telling you first, meaning the terms you agreed to could change.',
    confidence: 0.92,
  },
];

function runMockAnalysis(text: string, captureMethod?: string, captureFallbackReason?: string) {
  // 1. Pre-LLM injection scan
  const injections = scanForInjections(text);
  const injectionWarnings = injections.map(
    w => `Detected injection attempt: "${w.matchedText}" (${w.pattern})`
  );

  // 2. Quote verification against text
  const verified: Clause[] = [];
  let droppedCount = 0;

  for (const clause of MOCK_CLAUSES) {
    const result = verifyQuote(clause.quote, text);
    if (result.found) {
      verified.push(clause);
    } else {
      droppedCount++;
    }
  }

  // 3. Compute score deterministically
  const scoreResult = computeScore(verified, droppedCount, MOCK_CLAUSES.length);

  // 4. Uncertainty notices
  const uncertaintyReasons: string[] = [];
  if (verified.length === 0 && MOCK_CLAUSES.length > 0) {
    uncertaintyReasons.push(
      'No clauses could be verified - all quotes were dropped because they could not be found in the original text.'
    );
  }
  if (droppedCount > MOCK_CLAUSES.length * 0.5) {
    uncertaintyReasons.push(
      `${droppedCount} claims were dropped because the quote could not be verified in the original text.`
    );
  }
  if (injections.length > 0) {
    uncertaintyReasons.push(
      `${injections.length} possible prompt injection attempt(s) detected in the document. These were not obeyed.`
    );
  }

  return {
    score: scoreResult.score,
    label: scoreResult.label,
    clauses: verified,
    droppedCount,
    injectionWarnings,
    uncertaintyReasons,
    documentType: 'tos',
    disclaimer:
      'This tool does not provide legal advice. It highlights clauses that may deserve attention; consult a qualified professional for legal questions.',
    hiddenContentCount: 0,
    captureMethod: (captureMethod as any) || 'native-dom',
    captureFallbackReason,
    isMock: true,
  };
}

Cypress.Commands.add('injectExtension', () => {
  cy.readFile('dist/content.js').then((contentJs) => {
    cy.window().then((win) => {
      // Stub chrome APIs on the application window (inside AUT iframe)
      (win as any).chrome = {
        storage: {
          local: {
            get: (_keys: any) =>
              Promise.resolve({
                llm_provider: 'gemini',
                llm_api_key: '',
                llm_model: 'gemini-2.0-flash',
                mock_llm: true,
              }),
            set: () => Promise.resolve(),
          },
        },
        runtime: {
          sendMessage: (message: any) => {
            if (message.type === 'ANALYZE') {
              const resData = runMockAnalysis(
                message.data.text,
                message.data.captureMethod,
                message.data.captureFallbackReason
              );
              return Promise.resolve({
                type: 'ANALYZE_RESULT',
                data: resData,
              });
            }
            if (message.type === 'PAGE_AGENT_LLM_PROXY') {
              return Promise.resolve({ ok: false, error: 'Proxy disabled in mock harness' });
            }
            if (message.type === 'GET_CONFIG') {
              return Promise.resolve({ configured: false });
            }
            return Promise.resolve({});
          },
        },
      };

      // Inject the built content script into the application document
      const doc = win.document;
      const script = doc.createElement('script');
      script.id = 'cts-content-script-harness';
      script.textContent = contentJs;
      doc.body.appendChild(script);
    });
  });
});
