import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GeminiProvider } from '../src/llm/providers/gemini';
import { buildSystemPrompt, buildUserPrompt } from '../src/llm/prompt';
import { LLMResponseSchema } from '../src/schema';
import { verifyQuote, normalizeText } from '../src/verify/quote-verify';
import { computeScore } from '../src/score';
import { chunkText } from '../src/capture/chunker';
import type { Clause, ClauseCategory } from '../src/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read environment variables manually from .env
function loadEnv(): Record<string, string> {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env file. Real eval requires GEMINI_API_KEY in .env');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const apiKey = env.GEMINI_API_KEY;
if (!apiKey || apiKey.length < 5) {
  throw new Error('GEMINI_API_KEY is missing or invalid in .env. Refusing to run eval with mock.');
}

const modelName = env.LLM_MODEL || 'gemini-flash-lite-latest';

interface GoldClause {
  id: string;
  category: ClauseCategory;
  severity: number;
  quote: string;
  rationale?: string;
}

interface GoldFile {
  document_id: string;
  document_name: string;
  source_url: string;
  retrieval_date: string;
  drafted_by: string;
  reviewed_by_human: boolean;
  notes: string;
  clauses: GoldClause[];
}

export interface DocEvalMetrics {
  docId: string;
  documentName: string;
  wordCount: number;
  totalGold: number;
  totalExtracted: number;
  droppedClaims: number;
  verifiedExtracted: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  score: number;
  riskLabel: string;
  llmCalls: number;
  retries: number;
  schemaFailures: number;
  analysisFailures: number;
  tpMatches: { goldId: string; goldQuote: string; predQuote: string; category: string; overlap: number }[];
  fpClauses: { quote: string; category: string; explanation: string }[];
  fnClauses: { goldId: string; quote: string; category: string; rationale?: string }[];
  droppedExamples: { quote: string; category: string }[];
}

export interface EvalRunSummary {
  runId: string;
  runDate: string;
  provider: string;
  model: string;
  totalLlmCalls: number;
  totalRetries: number;
  totalSchemaFailures: number;
  totalAnalysisFailures: number;
  totalGold: number;
  totalExtracted: number;
  totalDropped: number;
  totalTp: number;
  totalFp: number;
  totalFn: number;
  microPrecision: number;
  microRecall: number;
  microF1: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  docResults: DocEvalMetrics[];
}

/**
 * Longest Contiguous Common Substring length between two normalized strings.
 */
function longestCommonSubstringLength(a: string, b: string): number {
  if (!a || !b) return 0;
  const n = a.length;
  const m = b.length;
  const dp = new Uint16Array(m + 1);
  let maxLen = 0;

  for (let i = 1; i <= n; i++) {
    let prev = 0;
    for (let j = 1; j <= m; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1;
        if (dp[j] > maxLen) maxLen = dp[j];
      } else {
        dp[j] = 0;
      }
      prev = temp;
    }
  }
  return maxLen;
}

/**
 * Exact Match rule specified for eval:
 * A prediction is a TP only if:
 * 1. category is identical
 * 2. AND extracted quote contains, or is contained in, the gold quote,
 *    OR they overlap by >= 60% of the shorter one's characters.
 */
export function checkQuoteMatch(predQuote: string, goldQuote: string): { matches: boolean; ratio: number } {
  const normPred = normalizeText(predQuote);
  const normGold = normalizeText(goldQuote);

  if (normPred.includes(normGold) || normGold.includes(normPred)) {
    return { matches: true, ratio: 1.0 };
  }

  const shorterLen = Math.min(normPred.length, normGold.length);
  if (shorterLen === 0) return { matches: false, ratio: 0 };

  const lcs = longestCommonSubstringLength(normPred, normGold);
  const ratio = lcs / shorterLen;
  return { matches: ratio >= 0.60, ratio };
}

/**
 * Delay helper
 */
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Robust LLM call with retry and exponential backoff for 429/rate-limits
 */
async function callLLMWithBackoff(
  provider: GeminiProvider,
  request: { systemPrompt: string; userPrompt: string; jsonMode: boolean },
  stats: { llmCalls: number; retries: number }
): Promise<string> {
  const maxRetries = 4;
  let delay = 5000; // 5s initial backoff

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    stats.llmCalls++;
    try {
      const response = await provider.call(request);
      // Courtesy delay between API calls to respect rate limits
      await sleep(3500);
      return response;
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');

      if (attempt < maxRetries && isRateLimit) {
        stats.retries++;
        console.warn(`[Gemini API] Rate limit hit (attempt ${attempt + 1}/${maxRetries}). Backing off for ${delay}ms...`);
        await sleep(delay);
        delay *= 2; // exponential backoff
      } else if (attempt < maxRetries && (errMsg.includes('fetch failed') || errMsg.includes('TIMEOUT'))) {
        stats.retries++;
        console.warn(`[Gemini API] Network/Timeout error (attempt ${attempt + 1}/${maxRetries}). Retrying in 4000ms...`);
        await sleep(4000);
      } else {
        throw err;
      }
    }
  }
  throw new Error('Exceeded maximum retries for LLM call');
}

/**
 * Startup sanity verification:
 * Verify every gold quote appears verbatim in its document before starting eval.
 */
function verifyAllGoldQuotesAtStartup(docsDir: string, goldDir: string) {
  console.log('--- Phase C Startup: Verifying all Gold Quotes against documents ---');
  const goldFiles = fs.readdirSync(goldDir).filter(f => f.endsWith('.json'));
  let failureCount = 0;

  for (const gFile of goldFiles) {
    const docId = gFile.replace('.json', '');
    const docPath = path.join(docsDir, `${docId}.txt`);
    const goldPath = path.join(goldDir, gFile);

    if (!fs.existsSync(docPath)) {
      console.error(`ERROR: Document file missing: ${docPath}`);
      failureCount++;
      continue;
    }

    const docText = fs.readFileSync(docPath, 'utf8');
    const gold: GoldFile = JSON.parse(fs.readFileSync(goldPath, 'utf8'));

    for (const clause of gold.clauses) {
      const check = verifyQuote(clause.quote, docText);
      if (!check.found) {
        console.error(`FAIL at startup: Gold quote in ${gFile} [${clause.id}] not found in source!`);
        console.error(`  Quote: "${clause.quote}"`);
        failureCount++;
      }
    }
  }

  if (failureCount > 0) {
    throw new Error(`Startup verification failed: ${failureCount} gold quote(s) could not be verified in source documents.`);
  }
  console.log('Startup check passed: 100% of gold quotes verified verbatim in source docs.\n');
}

/**
 * De-duplicate clauses by quote text
 */
function deduplicateClauses(clauses: Clause[]): Clause[] {
  const seen = new Map<string, Clause>();
  for (const c of clauses) {
    const key = normalizeText(c.quote);
    const existing = seen.get(key);
    if (!existing || c.confidence > existing.confidence) {
      seen.set(key, c);
    }
  }
  return Array.from(seen.values());
}

/**
 * Run evaluation across the 5 corpus documents
 */
export async function runFullEvaluation(runIdentifier: string): Promise<EvalRunSummary> {
  const docsDir = path.resolve(__dirname, 'docs');
  const goldDir = path.resolve(__dirname, 'gold');

  verifyAllGoldQuotesAtStartup(docsDir, goldDir);

  const provider = new GeminiProvider({
    provider: 'gemini',
    apiKey,
    model: modelName,
  });

  const docFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.txt')).sort();
  const docResults: DocEvalMetrics[] = [];

  let totalLlmCalls = 0;
  let totalRetries = 0;
  let totalSchemaFailures = 0;
  let totalAnalysisFailures = 0;

  console.log(`================================================================`);
  console.log(`Starting Evaluation Run: ${runIdentifier}`);
  console.log(`Provider: Google Gemini | Model: ${modelName} | Date: ${new Date().toISOString()}`);
  console.log(`Documents to evaluate: ${docFiles.length}`);
  console.log(`================================================================\n`);

  for (const docFile of docFiles) {
    const docId = docFile.replace('.txt', '');
    const docPath = path.join(docsDir, docFile);
    const goldPath = path.join(goldDir, `${docId}.json`);

    if (!fs.existsSync(goldPath)) {
      console.warn(`Gold file missing for ${docId}, skipping.`);
      continue;
    }

    const docText = fs.readFileSync(docPath, 'utf8');
    const gold: GoldFile = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
    const wordCount = docText.split(/\s+/).filter(Boolean).length;

    console.log(`\n------------------------------------------------------------`);
    console.log(`Evaluating ${docId} (${gold.document_name})`);
    console.log(`Text length: ${docText.length} chars (~${wordCount} words) | Gold clauses: ${gold.clauses.length}`);
    console.log(`------------------------------------------------------------`);

    const docStats = { llmCalls: 0, retries: 0 };
    let docSchemaFailures = 0;
    let docAnalysisFailures = 0;

    // 1. Chunk document
    const chunks = chunkText(docText, 12000, 500);
    console.log(`Document split into ${chunks.length} chunks.`);

    let allRawClauses: Clause[] = [];

    // 2. Analyze chunks with real LLM
    for (const chunk of chunks) {
      console.log(`Analyzing chunk ${chunk.index + 1}/${chunk.totalChunks}...`);
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(chunk.text, { index: chunk.index, total: chunk.totalChunks });

      try {
        let responseText = await callLLMWithBackoff(
          provider,
          { systemPrompt, userPrompt, jsonMode: true },
          docStats
        );

        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          // Retry once with error feedback
          console.warn(`Invalid JSON on chunk ${chunk.index + 1}. Retrying once with error feedback...`);
          const retryPrompt = `${userPrompt}\n\nYour previous response was not valid JSON. Return ONLY valid JSON matching the schema.`;
          responseText = await callLLMWithBackoff(
            provider,
            { systemPrompt, userPrompt: retryPrompt, jsonMode: true },
            docStats
          );
          try {
            parsed = JSON.parse(responseText);
          } catch (e) {
            console.error(`Permanent JSON parse error on chunk ${chunk.index + 1}`);
            docSchemaFailures++;
            continue;
          }
        }

        // Schema validation with Zod
        const validation = LLMResponseSchema.safeParse(parsed);
        if (!validation.success) {
          console.warn(`Schema validation error on chunk ${chunk.index + 1}. Retrying once...`);
          const errList = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
          const retryPrompt = `${userPrompt}\n\nYour previous response had schema validation errors: ${errList}. Fix and return valid JSON.`;
          responseText = await callLLMWithBackoff(
            provider,
            { systemPrompt, userPrompt: retryPrompt, jsonMode: true },
            docStats
          );
          try {
            const retryParsed = JSON.parse(responseText);
            const retryVal = LLMResponseSchema.safeParse(retryParsed);
            if (retryVal.success) {
              allRawClauses.push(...retryVal.data.clauses);
            } else {
              console.error(`Permanent schema validation failure on chunk ${chunk.index + 1}`);
              docSchemaFailures++;
            }
          } catch {
            docSchemaFailures++;
          }
        } else {
          allRawClauses.push(...validation.data.clauses);
        }
      } catch (err) {
        console.error(`Analysis failure on chunk ${chunk.index + 1}:`, err);
        docAnalysisFailures++;
      }
    }

    // 3. Deduplicate extracted clauses across chunks
    const deduplicated = deduplicateClauses(allRawClauses);
    const totalExtracted = deduplicated.length;

    // 4. Quote verification pipeline
    const verifiedExtracted: Clause[] = [];
    const droppedExamples: { quote: string; category: string }[] = [];
    let droppedClaims = 0;

    for (const c of deduplicated) {
      const res = verifyQuote(c.quote, docText);
      if (res.found) {
        verifiedExtracted.push(c);
      } else {
        droppedClaims++;
        droppedExamples.push({ quote: c.quote, category: c.category });
        console.log(`[DROPPED CLAIM] Hallucinated/unverified quote: "${c.quote.substring(0, 80)}..."`);
      }
    }

    // 5. Compute risk score
    const scoreResult = computeScore(verifiedExtracted, droppedClaims, totalExtracted);

    // 6. Match against Gold Annotations
    // Rule: Same category AND (containment OR overlap >= 60% of shorter)
    // Gold clause matched at most once.
    const matchedGoldIds = new Set<string>();
    const matchedPredIndices = new Set<number>();
    const tpMatches: { goldId: string; goldQuote: string; predQuote: string; category: string; overlap: number }[] = [];

    // Prioritize highest overlap matches
    for (let pIdx = 0; pIdx < verifiedExtracted.length; pIdx++) {
      const pred = verifiedExtracted[pIdx];
      let bestGold: GoldClause | null = null;
      let bestOverlap = 0;

      for (const goldClause of gold.clauses) {
        if (matchedGoldIds.has(goldClause.id)) continue;
        if (pred.category !== goldClause.category) continue;

        const matchCheck = checkQuoteMatch(pred.quote, goldClause.quote);
        if (matchCheck.matches && matchCheck.ratio > bestOverlap) {
          bestOverlap = matchCheck.ratio;
          bestGold = goldClause;
        }
      }

      if (bestGold) {
        matchedGoldIds.add(bestGold.id);
        matchedPredIndices.add(pIdx);
        tpMatches.push({
          goldId: bestGold.id,
          goldQuote: bestGold.quote,
          predQuote: pred.quote,
          category: pred.category,
          overlap: Math.round(bestOverlap * 100),
        });
      }
    }

    const tp = tpMatches.length;
    const fpClauses: { quote: string; category: string; explanation: string }[] = [];
    for (let pIdx = 0; pIdx < verifiedExtracted.length; pIdx++) {
      if (!matchedPredIndices.has(pIdx)) {
        const p = verifiedExtracted[pIdx];
        fpClauses.push({ quote: p.quote, category: p.category, explanation: p.explanation });
      }
    }
    const fp = fpClauses.length;

    const fnClauses: { goldId: string; quote: string; category: string; rationale?: string }[] = [];
    for (const g of gold.clauses) {
      if (!matchedGoldIds.has(g.id)) {
        fnClauses.push({ goldId: g.id, quote: g.quote, category: g.category, rationale: g.rationale });
      }
    }
    const fn = fnClauses.length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    console.log(`Results for ${docId}: TP=${tp}, FP=${fp}, FN=${fn} | P=${(precision*100).toFixed(1)}% R=${(recall*100).toFixed(1)}% F1=${(f1*100).toFixed(1)}% | Dropped=${droppedClaims} Score=${scoreResult.score} (${scoreResult.label})`);

    totalLlmCalls += docStats.llmCalls;
    totalRetries += docStats.retries;
    totalSchemaFailures += docSchemaFailures;
    totalAnalysisFailures += docAnalysisFailures;

    docResults.push({
      docId,
      documentName: gold.document_name,
      wordCount,
      totalGold: gold.clauses.length,
      totalExtracted,
      droppedClaims,
      verifiedExtracted: verifiedExtracted.length,
      tp,
      fp,
      fn,
      precision,
      recall,
      f1,
      score: scoreResult.score,
      riskLabel: scoreResult.label,
      llmCalls: docStats.llmCalls,
      retries: docStats.retries,
      schemaFailures: docSchemaFailures,
      analysisFailures: docAnalysisFailures,
      tpMatches,
      fpClauses,
      fnClauses,
      droppedExamples,
    });
  }

  // Calculate overall metrics
  const totalGold = docResults.reduce((acc, r) => acc + r.totalGold, 0);
  const totalExtracted = docResults.reduce((acc, r) => acc + r.totalExtracted, 0);
  const totalDropped = docResults.reduce((acc, r) => acc + r.droppedClaims, 0);
  const totalTp = docResults.reduce((acc, r) => acc + r.tp, 0);
  const totalFp = docResults.reduce((acc, r) => acc + r.fp, 0);
  const totalFn = docResults.reduce((acc, r) => acc + r.fn, 0);

  const microPrecision = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 0;
  const microRecall = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 0;
  const microF1 = microPrecision + microRecall > 0 ? (2 * microPrecision * microRecall) / (microPrecision + microRecall) : 0;

  const macroPrecision = docResults.reduce((acc, r) => acc + r.precision, 0) / (docResults.length || 1);
  const macroRecall = docResults.reduce((acc, r) => acc + r.recall, 0) / (docResults.length || 1);
  const macroF1 = docResults.reduce((acc, r) => acc + r.f1, 0) / (docResults.length || 1);

  const summary: EvalRunSummary = {
    runId: runIdentifier,
    runDate: new Date().toISOString(),
    provider: 'Google Gemini',
    model: modelName,
    totalLlmCalls,
    totalRetries,
    totalSchemaFailures,
    totalAnalysisFailures,
    totalGold,
    totalExtracted,
    totalDropped,
    totalTp,
    totalFp,
    totalFn,
    microPrecision,
    microRecall,
    microF1,
    macroPrecision,
    macroRecall,
    macroF1,
    docResults,
  };

  return summary;
}

// CLI runner
async function main() {
  const run1 = await runFullEvaluation('Run-1');
  const run1Path = path.join(rootDir, 'eval', 'results_run1.json');
  fs.writeFileSync(run1Path, JSON.stringify(run1, null, 2), 'utf8');
  console.log(`Saved Run 1 results to ${run1Path}`);

  console.log('\nPausing 10 seconds before starting Run 2 to measure variance...');
  await sleep(10000);

  const run2 = await runFullEvaluation('Run-2');
  const run2Path = path.join(rootDir, 'eval', 'results_run2.json');
  fs.writeFileSync(run2Path, JSON.stringify(run2, null, 2), 'utf8');
  console.log(`Saved Run 2 results to ${run2Path}`);

  console.log('\n============================================================');
  console.log('EVALUATION COMPARISON (RUN 1 vs RUN 2)');
  console.log('============================================================');
  console.log(`Total Gold Clauses: ${run1.totalGold}`);
  console.log(`Run 1: TP=${run1.totalTp}, FP=${run1.totalFp}, FN=${run1.totalFn} | P=${(run1.microPrecision*100).toFixed(1)}% R=${(run1.microRecall*100).toFixed(1)}% F1=${(run1.microF1*100).toFixed(1)}% | Calls=${run1.totalLlmCalls}`);
  console.log(`Run 2: TP=${run2.totalTp}, FP=${run2.totalFp}, FN=${run2.totalFn} | P=${(run2.microPrecision*100).toFixed(1)}% R=${(run2.microRecall*100).toFixed(1)}% F1=${(run2.microF1*100).toFixed(1)}% | Calls=${run2.totalLlmCalls}`);

  for (let i = 0; i < run1.docResults.length; i++) {
    const d1 = run1.docResults[i];
    const d2 = run2.docResults[i];
    console.log(`\nDoc: ${d1.docId}`);
    console.log(`  Run 1: TP=${d1.tp} FP=${d1.fp} FN=${d1.fn} | F1=${(d1.f1*100).toFixed(1)}% | Score=${d1.score} (${d1.riskLabel}) | Dropped=${d1.droppedClaims}`);
    console.log(`  Run 2: TP=${d2.tp} FP=${d2.fp} FN=${d2.fn} | F1=${(d2.f1*100).toFixed(1)}% | Score=${d2.score} (${d2.riskLabel}) | Dropped=${d2.droppedClaims}`);
    const deltaF1 = ((d2.f1 - d1.f1) * 100).toFixed(1);
    const deltaScore = d2.score - d1.score;
    console.log(`  Variance: ΔF1=${deltaF1}% | ΔScore=${deltaScore} pts`);
  }
}

main().catch(err => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
