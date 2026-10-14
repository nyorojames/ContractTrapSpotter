import { createLLMProvider } from '../llm';
import { MockLLMProvider } from '../llm/mock';
import { buildSystemPrompt, buildUserPrompt } from '../llm/prompt';
import { LLMResponseSchema } from '../schema';
import { verifyQuote } from '../verify/quote-verify';
import { computeScore } from '../score';
import { scanForInjections } from '../injection/scanner';
import { chunkText } from '../capture/chunker';
import type { LLMConfig, LLMProviderInterface } from '../llm/types';
import type { Clause } from '../schema';

/**
 * Message types between content script and background
 */
interface AnalyzeRequest {
  type: 'ANALYZE';
  data: {
    text: string;
    url: string;
    title: string;
    hiddenContentCount: number;
    captureMethod?: 'page-agent' | 'native-dom';
    captureFallbackReason?: string;
  };
}

interface AnalyzeResponse {
  type: 'ANALYZE_RESULT';
  data: {
    score: number;
    label: string;
    clauses: Clause[];
    droppedCount: number;
    injectionWarnings: string[];
    uncertaintyReasons: string[];
    documentType: string;
    disclaimer: string;
    hiddenContentCount: number;
    captureMethod: 'page-agent' | 'native-dom';
    captureFallbackReason?: string;
  };
}

interface AnalyzeError {
  type: 'ANALYZE_ERROR';
  error: string;
}

const DISCLAIMER = 'This tool does not provide legal advice. It highlights clauses that may deserve attention; consult a qualified professional for legal questions.';

/**
 * Get LLM config from chrome.storage.local
 */
async function getLLMConfig(): Promise<LLMConfig | null> {
  const result = await chrome.storage.local.get(['llm_provider', 'llm_api_key', 'llm_model']);
  if (!result.llm_api_key) return null;
  return {
    provider: result.llm_provider || 'gemini',
    apiKey: result.llm_api_key,
    model: result.llm_model,
  };
}

/**
 * Create the appropriate LLM provider
 */
async function getProvider(): Promise<LLMProviderInterface> {
  // Check for mock mode or unconfigured state
  const { mock_llm } = await chrome.storage.local.get('mock_llm');
  const config = await getLLMConfig();
  if (mock_llm || !config) {
    console.log('[ContractTrapSpotter] Running in Mock LLM mode (no API key required).');
    return new MockLLMProvider();
  }
  return createLLMProvider(config);
}

/**
 * Analyze a single chunk of text
 */
async function analyzeChunk(
  provider: LLMProviderInterface,
  chunkText: string,
  chunkInfo: { index: number; total: number }
): Promise<{ clauses: Clause[]; documentType: string; unclearSections: { quote: string; reason: string }[] }> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(chunkText, chunkInfo);

  let responseText = await provider.call({
    systemPrompt,
    userPrompt,
    jsonMode: true,
  });

  // Try to parse and validate
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Retry once with error feedback
    const retryPrompt = `${userPrompt}\n\nYour previous response was not valid JSON. Please return ONLY a valid JSON object matching the schema.`;
    responseText = await provider.call({
      systemPrompt,
      userPrompt: retryPrompt,
      jsonMode: true,
    });
    parsed = JSON.parse(responseText); // Let it throw if still invalid
  }

  // Schema validation
  const validation = LLMResponseSchema.safeParse(parsed);
  if (!validation.success) {
    // Retry once with validation errors
    const errors = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    const retryPrompt = `${userPrompt}\n\nYour previous response had validation errors: ${errors}. Please fix and return valid JSON.`;
    responseText = await provider.call({
      systemPrompt,
      userPrompt: retryPrompt,
      jsonMode: true,
    });

    const retryParsed = JSON.parse(responseText);
    const retryValidation = LLMResponseSchema.safeParse(retryParsed);
    if (!retryValidation.success) {
      throw new Error(`Schema validation failed after retry: ${retryValidation.error.message}`);
    }
    return {
      clauses: retryValidation.data.clauses,
      documentType: retryValidation.data.document_type,
      unclearSections: retryValidation.data.unclear_sections || [],
    };
  }

  return {
    clauses: validation.data.clauses,
    documentType: validation.data.document_type,
    unclearSections: validation.data.unclear_sections || [],
  };
}

/**
 * De-duplicate clauses across chunks by quote similarity
 */
function deduplicateClauses(clauses: Clause[]): Clause[] {
  const seen = new Map<string, Clause>();

  for (const clause of clauses) {
    // Use normalized quote as dedup key
    const key = clause.quote.toLowerCase().replace(/\s+/g, ' ').trim();
    const existing = seen.get(key);
    if (!existing || clause.confidence > existing.confidence) {
      seen.set(key, clause);
    }
  }

  return Array.from(seen.values());
}

/**
 * Main analysis pipeline
 */
async function runAnalysis(
  text: string,
  _url: string,
  _title: string,
  hiddenContentCount: number,
  captureMethod: 'page-agent' | 'native-dom' = 'native-dom',
  captureFallbackReason?: string
): Promise<AnalyzeResponse['data']> {
  const provider = await getProvider();

  // 1. Pre-LLM injection scan
  const injections = scanForInjections(text);
  const injectionWarnings = injections.map(w => `Detected injection attempt: "${w.matchedText}" (${w.pattern})`);

  // 2. Chunk the text
  const chunks = chunkText(text);

  // 3. Analyze each chunk
  let allClauses: Clause[] = [];
  let documentType = 'other';

  for (const chunk of chunks) {
    try {
      const result = await analyzeChunk(provider, chunk.text, {
        index: chunk.index,
        total: chunk.totalChunks,
      });
      allClauses = allClauses.concat(result.clauses);
      if (chunk.index === 0) {
        documentType = result.documentType;
      }
    } catch (err) {
      console.error(`Error analyzing chunk ${chunk.index}:`, err);
      // Continue with other chunks
    }
  }

  // 4. De-duplicate
  const deduplicated = deduplicateClauses(allClauses);
  const totalBeforeVerification = deduplicated.length;

  // 5. Quote verification
  const verified: Clause[] = [];
  let droppedCount = 0;

  for (const clause of deduplicated) {
    const result = verifyQuote(clause.quote, text);
    if (result.found) {
      verified.push(clause);
    } else {
      droppedCount++;
      console.warn(`Dropped clause (quote not found): "${clause.quote.substring(0, 80)}..."`);
    }
  }

  // 6. Compute score deterministically
  const scoreResult = computeScore(verified, droppedCount, totalBeforeVerification);

  // 7. Determine uncertainty reasons
  const uncertaintyReasons: string[] = [];
  if (verified.length === 0 && totalBeforeVerification > 0) {
    uncertaintyReasons.push('No clauses could be verified - all quotes were dropped because they could not be found in the original text.');
  }
  if (verified.length === 0 && totalBeforeVerification === 0) {
    uncertaintyReasons.push('No risky clauses were detected in this document.');
  }
  if (droppedCount > totalBeforeVerification * 0.5) {
    uncertaintyReasons.push(`${droppedCount} claims were dropped because the quote could not be verified in the original text.`);
  }
  if (documentType === 'not_legal') {
    uncertaintyReasons.push('This document does not appear to be a legal text.');
  }
  if (text.length > 50000) {
    uncertaintyReasons.push('This is a very long document. Some sections may have been truncated or missed.');
  }
  if (hiddenContentCount > 0) {
    uncertaintyReasons.push(`${hiddenContentCount} hidden content elements were detected and stripped before analysis.`);
  }
  if (injections.length > 0) {
    uncertaintyReasons.push(`${injections.length} possible prompt injection attempt(s) detected in the document. These were not obeyed.`);
  }

  return {
    score: scoreResult.score,
    label: scoreResult.label,
    clauses: verified,
    droppedCount,
    injectionWarnings,
    uncertaintyReasons,
    documentType,
    disclaimer: DISCLAIMER,
    hiddenContentCount,
    captureMethod,
    captureFallbackReason,
  };
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener(
  (message: AnalyzeRequest | { type: string; data?: any }, _sender, sendResponse) => {
    if (message.type === 'ANALYZE') {
      const req = message as AnalyzeRequest;
      runAnalysis(
        req.data.text,
        req.data.url,
        req.data.title,
        req.data.hiddenContentCount,
        req.data.captureMethod || 'native-dom',
        req.data.captureFallbackReason
      )
        .then(result => {
          sendResponse({ type: 'ANALYZE_RESULT', data: result } as AnalyzeResponse);
        })
        .catch(err => {
          sendResponse({ type: 'ANALYZE_ERROR', error: String(err) } as AnalyzeError);
        });
      return true; // Keep channel open for async response
    }

    if (message.type === 'GET_CONFIG') {
      getLLMConfig().then(config => {
        sendResponse({ configured: !!config });
      });
      return true;
    }

    if (message.type === 'PAGE_AGENT_LLM_PROXY') {
      const { body } = message.data || {};
      getLLMConfig().then(async (config) => {
        if (!config) {
          sendResponse({ type: 'PAGE_AGENT_LLM_ERROR', error: 'No API key configured for PageAgent' });
          return;
        }

        // Route through OpenAI-compatible endpoint
        let endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        };

        if (config.provider === 'openai') {
          endpoint = 'https://api.openai.com/v1/chat/completions';
        }

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: typeof body === 'string' ? body : JSON.stringify(body),
          });

          const data = await res.json();
          if (!res.ok) {
            sendResponse({
              type: 'PAGE_AGENT_LLM_ERROR',
              status: res.status,
              error: data?.error?.message || `HTTP ${res.status}`,
              data,
            });
          } else {
            sendResponse({
              type: 'PAGE_AGENT_LLM_SUCCESS',
              status: res.status,
              data,
            });
          }
        } catch (err: any) {
          sendResponse({
            type: 'PAGE_AGENT_LLM_ERROR',
            error: err?.message || String(err),
          });
        }
      });
      return true;
    }
  }
);

console.log('ContractTrapSpotter background service worker loaded.');
