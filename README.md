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
        C -->|User Clicks| D["DOM Extractor & Sanitizer<br>(capturePageText)"]
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
2. **DOM Extraction & Hidden Content Stripping**: Upon clicking "Analyze", `capturePageText()` extracts clean text while identifying and stripping deceptive elements:
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
5. **LLM Provider Execution**: The request is routed via the Chrome background service worker (`src/background/index.ts`) to the configured provider (Google Gemini 2.0 Flash, OpenAI GPT-4o-mini, Anthropic Claude, or the offline deterministic `MockLLMProvider`).
6. **Strict Validation Pipeline**:
   - **Schema Validation**: Verified via Zod (`LLMResponseSchema`). Ensures the 17-item clause category enum, severity (1-5), and confidence (0-1) are adhered to.
   - **Quote Verification**: Verifies quotes are verbatim substrings in the original document. Fabricated quotes are instantly dropped.
   - **De-duplication**: Overlapping clauses from adjacent chunks are merged, preserving the highest confidence entry.
7. **Deterministic Scoring in Code**: The LLM **never** supplies the final score. The score is computed strictly from the validated clauses:
   $$\text{Clause Contribution} = \text{Category Weight} \times \text{Severity} \times \text{Confidence}$$
   $$\text{Score} = \text{round}\left(100 \times \left(1 - e^{-\frac{\text{Raw Total}}{150}}\right)\right)$$
8. **Shadow DOM Presentation**: An isolated report overlay panel (`#cts-report-panel`) renders the findings, allowing users to click "📍 Locate in page" to scroll to and highlight (`<mark class="cts-highlight">`) the exact clause in the live document.

---

## 3. Role of Alibaba `page-agent`

We researched the official repository (`github.com/alibaba/page-agent`, `@page-agent/core`, `@page-agent/page-controller`) to understand its real architecture.

### What `page-agent` is used for:
- **DOM Hydration & Traversal**: Inspecting the browser state (`getBrowserState()`) as dehydrated, accessible text.
- **Natural Language Page Navigation**: Interacting with dynamic pages to expand collapsed accordions ("Show more", "Read more", `<details>`), scroll down to trigger lazy loading, and follow navigation links to dedicated ToS pages.

### What `page-agent` is NOT used for:
- **Risk Assessment**: `page-agent` is never used to judge legal clauses or assign risk scores.
- **Demo LLM**: We do not use `page-agent`'s built-in demo keys; all requests go through the user's private key or mock provider.
- **Destructive Actions**: A strict read-only action allowlist blocks state-altering verbs:
  - **Permitted**: `scroll`, `expand`, `show more`, `read more`, `open section`, `view full`.
  - **Blocked**: `submit`, `purchase`, `buy`, `accept`, `agree`, `delete`, `sign up`, `checkout`, `pay`.
- **Architectural Fallback**: A native DOM expansion fallback (`expandCollapsedSections()`) is provided in `src/page-agent/integration.ts` ensuring full functionality even if `page-agent`'s browser runtime dependencies are unavailable.

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

# 2. Run unit & security tests (37 tests across 6 suites)
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

## 9. How to Run the Cypress Demo Video (< 90 s)

Cypress tests load the built unpacked extension into Chromium via the `--load-extension` flag and record video execution:

```bash
# 1. Start the local fixture server in one terminal:
npx tsx cypress/server.ts

# 2. Run Cypress end-to-end tests:
npm run cypress:run -- --browser chrome
```
Recorded video will be saved to `cypress/videos/`.

---

## 10. Known Limitations

1. **Hedging & Contextual Jargon**: Phrases like *"from time to time"* or *"at our sole discretion"* can be ambiguous. Contextual boundaries sometimes require human review.
2. **Cross-Section References**: Clauses that reference external exhibits or distant numbered sections (e.g., *"subject to exclusions in Section 14"*) may require whole-document reasoning beyond individual chunks.
3. **Complex Nested CSS Obfuscation**: While `display:none`, `aria-hidden`, and direct color matches are stripped, complex SVG masks or canvas-rendered text require OCR.

---

## 11. University Project Disclaimer
This project is an academic evaluation artifact developed for university coursework (*Yazılım Gerçekleme ve Test*). It does not provide legal advice.
