# ContractTrapSpotter - TODO

## Phase 1: Scaffold + Capture + Panel ✅ (in progress)
- [x] Project scaffold (Vite + TS + Manifest V3)
- [x] Module structure
- [ ] Content script: legal page detection
- [ ] Content script: Analyze button injection
- [ ] DOM capture with hidden content detection
- [ ] Shadow DOM report panel
- [ ] page-agent integration for DOM reading
- [ ] Options page for API key

## Phase 2: Schema + LLM + Validation + Scoring
- [ ] Zod schemas for LLM response
- [ ] LLM provider abstraction (Gemini/OpenAI/Anthropic)
- [ ] LLM call with structured JSON mode
- [ ] Quote verification (normalized substring check)
- [ ] Fuzzy match fallback (>= 0.95 similarity)
- [ ] Deterministic scoring algorithm
- [ ] Chunking with overlapping offsets
- [ ] De-duplication of clauses across chunks
- [ ] Validation pipeline: schema -> enum -> quote -> dedupe -> drop

## Phase 3: Injection Defenses
- [ ] Pre-LLM injection regex scanner
- [ ] Hidden content stripping (display:none, aria-hidden, etc.)
- [ ] page-agent action allowlist (read-only)
- [ ] Injection test fixtures
- [ ] Vitest injection tests
- [ ] SECURITY.md

## Phase 4: Eval
- [ ] 5 real ToS documents
- [ ] Gold annotations
- [ ] Eval runner
- [ ] EVAL.md with metrics

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
