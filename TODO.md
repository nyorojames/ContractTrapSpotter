# ContractTrapSpotter - TODO

## Phase 1: Scaffold + Capture + Panel ✅
- [x] Project scaffold (Vite + TS + Manifest V3)
- [x] Module structure
- [x] Content script: legal page detection
- [x] Content script: Analyze button injection
- [x] DOM capture with hidden content detection
- [x] Shadow DOM report panel
- [x] page-agent integration for DOM reading & safe allowlist
- [x] Options page for API key

## Phase 2: Schema + LLM + Validation + Scoring ✅
- [x] Zod schemas for LLM response
- [x] LLM provider abstraction (Gemini/OpenAI/Anthropic)
- [x] LLM call with structured JSON mode
- [x] Quote verification (normalized substring check)
- [x] Fuzzy match fallback (>= 0.95 similarity)
- [x] Deterministic scoring algorithm
- [x] Chunking with overlapping offsets
- [x] De-duplication of clauses across chunks
- [x] Validation pipeline: schema -> enum -> quote -> dedupe -> drop
- [x] Unit tests for quote verification, scoring, schema, chunker

## Phase 3: Injection Defenses ✅
- [x] Pre-LLM injection regex scanner (multilingual)
- [x] Hidden content stripping (display:none, aria-hidden, white-on-white, offscreen)
- [x] page-agent action allowlist (read-only)
- [x] Injection test fixtures (9 attack vectors)
- [x] Vitest injection tests (100% pass)
- [x] SECURITY.md with honest vulnerability evaluation

## Phase 4: Real LLM Evaluation ✅
- [x] Full authentic corpus (Spotify, Netflix, Adobe, Zoom, Dropbox; 40,047 words)
- [x] Gold annotations drafted from full texts with exact quotes, verified 100% verbatim by code
- [x] Real Google Gemini Flash eval runner with exponential backoff on 429 and strict match rule (>=60% overlap or containment)
- [x] Two complete evaluation runs executed to quantify run-to-run non-deterministic variance
- [x] EVAL.md rewritten with honest TP/FP/FN metrics, qualitative case studies, dropped claims & failure analysis

## Phase 5: Cypress Demo ✅
- [x] Local fixture pages (tos_page, ambiguous_page, injection_page)
- [x] Fixture HTTP test server (cypress/server.ts)
- [x] Cypress config with MV3 extension loading & video recording
- [x] Happy path spec (01_happy_path.cy.ts)
- [x] Uncertainty spec (02_uncertainty.cy.ts)
- [x] Injection spec (03_injection.cy.ts)

## Phase 6: README + Cleanup ✅
- [x] Architecture diagram (Mermaid flowchart)
- [x] Data flow explanation (end-to-end steps)
- [x] Role of page-agent & safe action allowlist
- [x] Schema, quote verification & deterministic scoring formulas
- [x] SECURITY.md with prompt injection testing
- [x] Known limitations & honest failure analysis
- [x] Permanent legal disclaimer displayed at all times
