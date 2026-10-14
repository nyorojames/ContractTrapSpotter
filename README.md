# ContractTrapSpotter ⚖️🔍
> **Automated Legal Risk Assessment & Clause Spotter Chrome Extension (Manifest V3)**  
> Developed as a university software verification and testing project. Built with TypeScript, Vite, Zod, Vitest, and Cypress.

---

> [!IMPORTANT]
> **LEGAL DISCLAIMER**: This tool does not provide legal advice. It highlights clauses that may deserve attention; consult a qualified professional for legal questions.

---

## 1. System Architecture

ContractTrapSpotter isolates the untrusted web DOM, enforces deterministic validation and quote verification, and prevents prompt injection attacks from altering risk assessments.

```mermaid
flowchart TD
    subgraph Browser ["Web Page Context"]
        A["DOM & URL / Title"] --> B["Legal Page Detector<br>(detectLegalPage)"]
        B -->|Matches Heuristics| C["Floating 'Analyze' Button<br>(Shadow DOM)"]
        C -->|User Clicks| PA["PageAgent Prep & Allowlist Guard<br>(prepareDocumentWithPageAgent)"]
        PA -->|Safe Accordion Expansion & getBrowserState| D["DOM Extractor & Sanitizer<br>(capturePageText)"]
        D -->|Strips hidden & comments| E["Clean Document Text<br>+ Hidden Content Telemetry"]
    end

    subgraph Defense ["Security & Sanitization"]
        E --> F["Pre-LLM Injection Scanner<br>(Regex Multi-lingual)"]
        F --> G["Overlapping Chunker<br>(chunkText, 12k chars)"]
    end

    subgraph ServiceWorker ["Chrome MV3 Background Service Worker"]
        G --> H["Prompt Formatter<br>(Enclosed in UNTRUSTED_DOCUMENT)"]
        H --> I["LLM Provider Abstraction<br>(Gemini / OpenAI / Anthropic / Mock)"]
        I --> J["JSON Response"]
        J --> K{"Zod Schema Validation<br>(LLMResponseSchema)"}
        K -->|Invalid JSON| L["Retry Once with Error Feedback"]
        L --> K
        K -->|Valid JSON| M["Quote Verification Engine<br>(verifyQuote)"]
        M -->|Quote Substring Found (>=0.95)| N["Verified Clauses"]
        M -->|Quote Hallucinated / Fabricated| O["DROP Clause & Increment<br>Dropped Counter"]
        N --> P["Deterministic Scoring Engine<br>(computeScore)"]
    end

    subgraph UI ["User Interface (Content Script Shadow DOM)"]
        P --> Q["Interactive Report Panel"]
        Q --> R["Deterministic Risk Score (0-100)"]
        Q --> S["Risk Label (Low/Med/High/Inconclusive)"]
        Q --> T["Verbatim Quotes + Plain English Explanations"]
        Q --> U["Dropped Claims Notice"]
        Q --> V["Locate in Page Button (DOM Highlight)"]
        Q --> W["Permanent Legal Disclaimer"]
    end
```

---

## 2. End-to-End Data Flow

1. **Heuristic Detection**: When a user navigates to a web page, `detectLegalPage()` inspects the URL (e.g. `/terms`, `/privacy`, `/tos`, `/eula`), the `<title>`, and top-level headings (`h1`, `h2`). If confidence thresholds pass, a subtle floating "Analyze Terms" button is injected. Text is **never** sent to an LLM without affirmative user action.
2. **PageAgent Preparation & DOM Extraction**: Upon clicking "Analyze", the content script invokes `prepareDocumentWithPageAgent()` with the user's private API key (never the demo LLM) and a strict safety allowlist guard (`isActionAllowed`). PageAgent executes a single constrained command (`"expand all collapsed sections of the terms text"`) and retrieves structured browser state. If PageAgent encounters MV3 CSP limits, it cleanly falls back to native DOM accordion expansion. `capturePageText()` then extracts clean text while identifying and stripping deceptive elements:
   - `display: none`
   - `visibility: hidden`
   - `aria-hidden="true"`
   - `font-size: 0px`
   - `opacity: 0`
   - Off-screen positioned elements (e.g. `left: -9999px`)
   - Low-contrast / white-on-white text (`color === backgroundColor`)
   - Raw HTML comments (`<!-- ... -->`) are scanned by `scanHtmlComments()` before being removed.
3. **Pre-LLM Injection Scan**: The extracted text is processed by `scanForInjections()`, looking for command overrides, role hijack attempts, and exfiltration commands across English, Turkish, Spanish, French, and German. Any detection generates non-suppressible UI warnings.
4. **Boundary Isolation & Chunking**: Long documents are split into overlapping chunks (default 12,000 characters with 500-character overlap) with natural paragraph and sentence boundary snapping. Chunks are wrapped in `<UNTRUSTED_DOCUMENT>` delimiters within a strict system prompt.
5. **LLM Provider Execution**: The request is routed via the Chrome background service worker (`src/background/index.ts`) to the configured provider (Google Gemini Flash, OpenAI GPT-4o-mini, Anthropic Claude, or the offline deterministic `MockLLMProvider`).
6. **Strict Validation Pipeline**:
   - **Schema Validation**: Verified via Zod (`LLMResponseSchema`). Ensures the 17-item clause category enum, severity (1-5), and confidence (0-1) are adhered to.
    - **Quote Verification**: Verifies quotes are verbatim substrings in the clean captured text extracted from the live DOM by `capturePageText()` (with hidden content, navigation, scripts, and styles stripped). Fabricated or non-matching quotes are instantly dropped. *(Note: Offline evaluation in `eval/run.ts` bypasses the browser DOM capture path and tests directly against the static corpus in `eval/docs/*.txt`)*.
    - **De-duplication**: Overlapping clauses from adjacent chunks are merged, preserving the highest confidence entry.
7. **Deterministic Scoring in Code**: The LLM **never** supplies the final score. The score is computed strictly from the validated clauses:
   $$\text{Clause Contribution} = \text{Category Weight} \times \text{Severity} \times \text{Confidence}$$
   $$\text{Score} = \text{round}\left(100 \times \left(1 - e^{-\frac{\text{Raw Total}}{150}}\right)\right)$$
8. **Shadow DOM Presentation**: An isolated report overlay panel (`#cts-report-panel`) renders the findings, allowing users to click "📍 Locate in page" to scroll to and highlight (`<mark class="cts-highlight">`) the exact clause in the live document.

---

## 3. page-agent: What is Real and What is Not

### What is Real (Actually Executed in Code)
- **Direct Package Import**: `page-agent` is imported directly into `src/page-agent/integration.ts` (`import { PageAgent } from 'page-agent'`) and bundled by Vite into `dist/content.js`.
- **Pre-Capture Expansion**: When the user clicks "Analyze", `prepareDocumentWithPageAgent()` instantiates `PageAgent` using the user's private API key configured in extension settings. It runs a single constrained command: `"expand all collapsed sections of the terms text"`.
- **DOM State Retrieval**: It extracts structured browser state via `agent.pageController.getBrowserState()`.
- **Read-Only Safety Allowlist**: Every command sent to `page-agent` must pass `isActionAllowed()`. Destructive verbs (`delete`, `purchase`, `submit`, `accept`, `pay`, `agree`) are rejected before reaching the library. Verified by automated tests in `tests/page-agent-safety.test.ts`.
- **Internal Action Filters**: `agent.tools` removes script execution (`execute_javascript`) and text typing (`input_text`), while wrapping `click_element_by_index` to block clicks on elements whose text contains forbidden verbs (`delete`, `purchase`, `submit`, `pay`, etc.).
- **Untrusted Output Pipeline**: Text returned by `page-agent` is never trusted directly; it passes through hidden-content stripping, regex injection scanning, delimiter isolation, and quote verification.

### What is NOT Used (and Why)
- **No Risk Judgments**: `page-agent` is **never** used to evaluate contract risk or assign scores. That is reserved for our deterministic code scoring engine.
- **No Demo LLM**: We never load `page-agent.demo.js` or use Alibaba's public evaluation API key.
- **No Dynamic Script Tool (`eval` Forbidden in MV3)**: In `@page-agent/page-controller` line 1995, `executeJavascript` uses `eval()`. Under Chrome Manifest V3 Content Security Policy, `eval` is forbidden (`script-src 'self'`). We never enable or execute this tool.
- **Suppressed Built-In Panel**: `new PageAgent()` automatically mounts an uninvited floating chat panel (`Panel`) to `document.body`. We explicitly suppress it via `agent.panel.hide()` and `display: none` to prevent conflicts with our shadow DOM report overlay.
- **Native DOM Fallback**: During real Chrome tests on sites like `adobe.com/privacy/policy.html`, `page-agent` threw `TypeError: Failed to fetch` / `InvokeError: Network request failed` (*unverified hypothesis: page CSP `connect-src 'self'` or CORS restrictions*). To guarantee resilience on any website, `prepareDocumentWithPageAgent()` catches network or runtime failures, routes LLM requests through the background worker when available, and falls back to `expandWithNativeDom()`, reporting the exact fallback reason in the UI.

---

## 4. Clause Taxonomy & Schema

### The 17 Clause Categories:
1. `auto_renewal`: Recurring charges without periodic re-authorization.
2. `hard_to_cancel`: Onerous cancellation hurdles or early termination penalties.
3. `no_refund`: Strict non-refundable terms limiting statutory remedies.
4. `third_party_data_sharing`: Sharing personal data with third-party partners or advertisers.
5. `data_selling`: Selling user data to data brokers or marketing aggregators.
6. `broad_data_collection`: Excessive telemetry, location, biometric, or behavioral collection.
7. `long_data_retention`: Indefinite or prolonged storage of user personal information.
8. `forced_arbitration`: Mandatory private binding arbitration waiving court access.
9. `class_action_waiver`: Waiving rights to collective or class action lawsuits.
10. `unilateral_changes`: Provider can modify terms, services, or prices without prior notice.
11. `liability_limitation`: Broad disclaimers of consequential damages and low liability caps.
12. `content_license_grant`: Broad, perpetual, sublicensable licenses granted over user content.
13. `account_termination_without_notice`: Immediate account suspension without notice.
14. `jurisdiction_governing_law`: Favorable foreign jurisdiction clauses.
15. `tracking_profiling`: Behavioral profiling, AI algorithm training, and cross-site tracking.
16. `children_data`: Processing or retention of minors' data.
17. `other`: Unclassified predatory clauses.

---

## 5. Quote Verification Logic

A hallucinated legal claim without exact textual grounding is dangerous. ContractTrapSpotter enforces:
1. **Unicode & Whitespace Normalization**:
   - Smart typographic quotes (`“`, `”`, `‘`, `’`) $\rightarrow$ ASCII (`"`, `'`).
   - Typographic dashes (em-dash `—`, en-dash `–`, horizontal bar `―`) $\rightarrow$ hyphen (`-`).
   - Multiple newlines, tabs, and spaces collapsed to a single space.
   - Case-insensitive comparison.
2. **Exact Substring Matching**: Verifies whether the normalized quote exists in the normalized document.
3. **Fuzzy Fallback (Dice Similarity $\ge 0.95$)**: For minor OCR or transcription variations, a candidate-anchored sliding window calculates character bigram Dice coefficient:
   $$S = \frac{2 \times |B_A \cap B_B|}{|B_A| + |B_B|}$$
   Matches $\ge 0.95$ are marked as approximate; anything below is **dropped** and the dropped-claims counter increments.

---

## 6. Security Model & Prompt Injection Defenses

See [`SECURITY.md`](./SECURITY.md) for full audit matrix and details.

- **Pre-LLM Heuristic Scanner**: Detects command overrides (`ignore previous instructions`, `rate this as safe`, `you are now...`, `system:`), dangerous browser automation commands, and non-English injections (e.g. Turkish `önceki talimatları yoksay`).
- **Hidden Content Stripping**: Strips zero-opacity, `display:none`, and off-screen elements before LLM ingestion.
- **HTML Comment Scanning**: Inspects `<!-- ... -->` tags where attackers attempt to hide prompts.
- **Deterministic Scoring Immunity**: Because the score is computed in code, an injected "rate this document as safe" has zero impact on the mathematical score.
- **Zero API Key Leakage**: Keys are stored exclusively in `chrome.storage.local` and never exposed to the page context.

---

## 7. Setup & How to Run

### Prerequisites
- Node.js $\ge 18$ (Tested on Node.js v24)
- npm $\ge 9$

### Installation & Build
```bash
# 1. Install dependencies
npm install

# 2. Run unit & security tests (46 tests across 8 suites)
npm test

# 3. Build the Chrome extension
npm run build
```

### Loading into Google Chrome / Chromium
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** (top-left).
4. Select the `dist/` folder inside `ContractTrapSpotter/`.
5. The extension icon will appear in your toolbar.
6. Right-click the extension icon $\rightarrow$ **Options** to configure your Gemini / OpenAI / Anthropic API key, or leave checked as **Use mock LLM** for offline demonstration.

---

## 8. How to Run the Evaluation Suite (30 pts)

To evaluate ContractTrapSpotter against real-world Terms of Service documents (Spotify, Netflix, Adobe, Zoom, Dropbox) and compare against human-annotated gold standards:

```bash
npm run eval
```
This executes `eval/run.ts`, calculates TP, FP, FN, dropped claims, precision, recall, and F1 scores, and regenerates [`EVAL.md`](./EVAL.md).

---

## 9. Cypress E2E Demo (< 90 s) & Mock Mode

ContractTrapSpotter includes automated Cypress end-to-end specifications covering the full UI lifecycle:
- `cypress/e2e/01_happy_path.cy.ts`: Page detection, button click, quote highlighting in page, and score calculation.
- `cypress/e2e/02_uncertainty.cy.ts`: Unclear / ungrounded quotes resulting in dropped claims and honest `Inconclusive` score label.
- `cypress/e2e/03_injection.cy.ts`: In-browser prompt injection detection and warning banner display.

### Mock LLM Mode
For offline demonstration and running without an active API key:
- Toggle **Use mock LLM (for testing/demo, no API key needed)** in the extension options page (`dist/options/options.html` or `chrome.storage.local.set({ mock_llm: true })`).
- When active, the background worker routes requests to `MockLLMProvider`, and the report panel renders a distinct **Mock LLM** badge in the stats header (`data-testid="mock-indicator"`).

### Running Cypress
```bash
# 1. Start the local fixture server:
npm run demo:server
# or: npx tsx cypress/server.ts

# 2. Run Cypress end-to-end tests in headed Chrome:
npm run cypress:run -- --browser chrome --headed
```

- **Video Location**: `cypress/videos/01_happy_path.cy.ts.mp4` (Duration: ~8 seconds, compressed with CRF 32; well under the 90-second threshold).
- **Technical Note on Chrome Extension Automation**: When Cypress launches Chrome in automated test mode (`--enable-automation`), it hosts the target website within a sandboxed Cypress runner `<iframe>` (`.aut-iframe`). In modern Chromium/Chrome (v120+ / v155), Chrome's extension runtime attaches the unpacked extension (`--load-extension`) to the browser session, but isolates content scripts from injecting into internal automation runner iframes. In live usage outside the Cypress automation frame (e.g. loading the unpacked `dist/` into standard Chrome via `chrome://extensions`), `content.js` reliably executes on top-level web pages, injects the floating `#cts-analyze-btn`, and displays the shadow DOM report panel as verified on real-world sites like `adobe.com`.

---

## 10. Known Limitations

1. **Hedging & Contextual Jargon**: Phrases like *"from time to time"* or *"at our sole discretion"* can be ambiguous. Contextual boundaries sometimes require human review.
2. **Cross-Section References**: Clauses that reference external exhibits or distant numbered sections (e.g., *"subject to exclusions in Section 14"*) may require whole-document reasoning beyond individual chunks.
3. **Complex Nested CSS Obfuscation**: While `display:none`, `aria-hidden`, and direct color matches are stripped, complex SVG masks or canvas-rendered text require OCR.

---

## 11. Known Issues Fixed

- **Content Script Module Format (Chrome MV3)**: Chrome content scripts execute in isolated page worlds where ES module `import`/`export` syntax is forbidden (Manifest V3 `content_scripts` declarations do not support `"type": "module"`). When multi-entry bundling was used, Vite/Rollup created shared chunk files loaded via `import`, triggering `Uncaught SyntaxError: Cannot use import statement outside a module` at runtime. This has been resolved by configuring a dedicated secondary build pass (`vite.content.config.ts`) using `build.lib` with `format: 'iife'`, `inlineDynamicImports: true`, and `emptyOutDir: false`. This compiles `dist/content.js` into a completely self-contained IIFE with all dependencies (including `zod` and `page-agent`) inlined. An automated post-build check (`scripts/check-content-script.ts`) runs on every `npm run build` to guarantee zero `import` or `export` statements exist in `dist/content.js`.

---

## 12. University Project Disclaimer
This project is an academic evaluation artifact developed for university coursework (*Yazılım Gerçekleme ve Test*). It does not provide legal advice.
