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

## Phase 4: Eval ✅
- [x] 5 real ToS documents (Spotify, Netflix, Adobe, Zoom, Dropbox)
- [x] Gold annotations with reviewer tracking
- [x] Eval runner (eval/run.ts)
- [x] EVAL.md with metrics, failure analysis & dropped claims report

## Phase 5: Cypress Demo
- [ ] Local fixture pages
- [ ] Cypress config with extension loading
- [ ] Happy path spec
- [ ] Uncertainty spec
- [ ] Injection spec

## Phase 6: README + Cleanup
- [ ] Architecture diagram (Mermaid)
- [ ] Data flow explanation
- [ ] Known limitations
- [ ] Final disclaimer
