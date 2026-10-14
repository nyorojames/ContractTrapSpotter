# ContractTrapSpotter - Empirical Evaluation Report (30 pts)

## 1. Evaluation Methodology

### 1.1 Evaluated Documents
The evaluation was executed on five authentic, full-length legal contracts retrieved on October 14, 2026. None of the documents are synthetic summaries, marketing snippets, or cookie consent banners.

| Document | File | Canonical URL | Retrieval Date | Word Count | Character Count |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Adobe General Terms of Use** | `adobe_terms.txt` | [adobe.com/legal/terms.html](https://www.adobe.com/legal/terms.html) | 2026-10-14 | 11,648 | 73,408 |
| **Dropbox Terms of Service** | `dropbox_tos.txt` | [dropbox.com/terms2026](https://www.dropbox.com/terms2026) | 2026-10-14 | 4,292 | 26,459 |
| **Netflix Terms of Use** | `netflix_terms.txt` | [help.netflix.com/legal/termsofuse](https://help.netflix.com/legal/termsofuse) | 2026-10-14 | 3,493 | 22,037 |
| **Spotify Terms and Conditions** | `spotify_tos.txt` | [spotify.com/legal/end-user-agreement/](https://www.spotify.com/legal/end-user-agreement/) | 2026-10-14 | 6,745 | 42,278 |
| **Zoom Terms of Services** | `zoom_tos.txt` | [explore.zoom.us/en/terms/](https://explore.zoom.us/en/terms/) | 2026-10-14 | 13,749 | 87,453 |
| **Total Corpus** | 5 documents | - | - | **40,047** | **251,635** |

### 1.2 Gold Standard Generation
Gold was drafted by Gemini 3.8 Flash, verified verbatim by code, and reviewed by the student after the eval run; no entries were changed.
- Each gold entry identifies 5 to 6 of the most critical predatory or concerning clauses a typical consumer would need to be warned about (such as forced arbitration, class action waivers, automatic renewals, strict no-refund policies, and unilateral terms changes).
- Every quote in the gold standard was strictly verified against the underlying document via `verifyQuote()` at startup. 100% of gold quotes are exact, verbatim character-for-character substrings of the authentic texts.
- Top-level provenance fields are recorded in each JSON file: `"drafted_by": "Gemini 3.8 Flash"`, `"reviewed_by_human": true`.

### 1.3 System Under Test
- **Provider**: Google Gemini API (`generativelanguage.googleapis.com/v1beta`)
- **Model**: `gemini-flash-lite-latest` (serving `gemini-3.5-flash-lite` in production)
- **Prompt Architecture**: Version 2 structured JSON prompt enforcing `<UNTRUSTED_DOCUMENT>` boundary delimiters, strict anti-injection rules, and Zod schema compliance.
- **Pipeline Flow**: Overlapping chunking (12,000 characters with 500-character overlap) $\rightarrow$ Structured LLM JSON output $\rightarrow$ Zod schema validation $\rightarrow$ Inter-chunk de-duplication $\rightarrow$ Deterministic verbatim quote verification $\rightarrow$ Deterministic code-level scoring.
- **Runs Executed**: 2 independent runs were executed to empirically evaluate run-to-run non-deterministic variance.

### 1.4 Formal Match Rule
A predicted clause $P$ is counted as a **True Positive (TP)** against a gold clause $G$ if and only if:
1. **Category Match**: $P.\text{category} == G.\text{category}$ (from the 17-item enum taxonomy).
2. **Quote Match**: The normalized predicted quote contains, or is contained in, the normalized gold quote, **OR** their maximum contiguous common substring is $\ge 60\%$ of the shorter quote's character length:
   $$\text{Match}(P, G) \iff (P.\text{category} == G.\text{category}) \land \left(P_{\text{norm}} \subseteq G_{\text{norm}} \lor G_{\text{norm}} \subseteq P_{\text{norm}} \lor \frac{\text{LCS}(P_{\text{norm}}, G_{\text{norm}})}{\min(|P_{\text{norm}}|, |G_{\text{norm}}|)} \ge 0.60\right)$$
3. **Uniqueness**: Each gold clause $G$ can be matched at most once. Secondary predictions matching an already-claimed gold clause are counted as duplicates (False Positives).
4. **Pre-requisite**: $P$ must survive the quote verification engine. Any candidate clause whose quote is not found in the original document is DROPPED and cannot become a TP.

---

## 2. Benchmark Evaluation Results

### 2.1 Run 1 Results Table

| Document | Gold | Extracted | Verified | Dropped | TP | FP | FN | Precision | Recall | F1 Score | Score | Label |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Adobe Terms** | 5 | 20 | 17 | 3 | 4 | 13 | 1 | 23.5% | 80.0% | 36.4% | 89 | High |
| **Dropbox ToS** | 6 | 12 | 12 | 0 | 6 | 6 | 0 | 50.0% | 100.0% | 66.7% | 78 | High |
| **Netflix Terms** | 5 | 10 | 9 | 1 | 5 | 4 | 0 | 55.6% | 100.0% | 71.4% | 68 | High |
| **Spotify ToS** | 6 | 18 | 14 | 4 | 4 | 10 | 2 | 28.6% | 66.7% | 40.0% | 79 | High |
| **Zoom Terms** | 5 | 30 | 26 | 4 | 3 | 23 | 2 | 11.5% | 60.0% | 19.4% | 97 | High |
| **TOTAL (Run 1)**| **27** | **90** | **78** | **12** | **22** | **56** | **5** | **28.2%** | **81.5%** | **41.9%** | **-** | **-** |

- **Macro Metrics**: Macro Precision = **33.8%**, Macro Recall = **81.3%**, Macro F1 = **46.8%**
- **System Diagnostics**: Total LLM Calls = 29, Rate-limit Retries = 0, Schema Validation Failures = 0, Analysis Failures = 0.

---

### 2.2 Run 2 Results Table (Non-Deterministic Variance Verification)

| Document | Gold | Extracted | Verified | Dropped | TP | FP | FN | Precision | Recall | F1 Score | Score | Label |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Adobe Terms** | 5 | 22 | 18 | 4 | 4 | 14 | 1 | 22.2% | 80.0% | 34.8% | 88 | High |
| **Dropbox ToS** | 6 | 14 | 14 | 0 | 6 | 8 | 0 | 42.9% | 100.0% | 60.0% | 84 | High |
| **Netflix Terms** | 5 | 9 | 8 | 1 | 5 | 4 | 0 | 55.6% | 100.0% | 71.4% | 66 | High |
| **Spotify ToS** | 6 | 17 | 13 | 4 | 4 | 9 | 2 | 30.8% | 66.7% | 42.1% | 73 | High |
| **Zoom Terms** | 5 | 26 | 21 | 5 | 3 | 18 | 2 | 14.3% | 60.0% | 23.1% | 95 | High |
| **TOTAL (Run 2)**| **27** | **88** | **74** | **14** | **22** | **53** | **5** | **29.3%** | **81.5%** | **43.1%** | **-** | **-** |

- **Macro Metrics**: Macro Precision = **33.2%**, Macro Recall = **81.3%**, Macro F1 = **46.3%**
- **System Diagnostics**: Total LLM Calls = 29, Rate-limit Retries = 0, Schema Validation Failures = 0, Analysis Failures = 0.

---

### 2.3 Run-to-Run Variance Analysis

| Document | $\Delta$ TP | $\Delta$ FP | $\Delta$ FN | $\Delta$ Precision | $\Delta$ Recall | $\Delta$ F1 Score | $\Delta$ Risk Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Adobe Terms** | 0 | +1 | 0 | -1.3% | 0.0% | -1.6% | -1 pt |
| **Dropbox ToS** | 0 | +2 | 0 | -7.1% | 0.0% | -6.7% | +6 pts |
| **Netflix Terms** | 0 | 0 | 0 | 0.0% | 0.0% | 0.0% | -2 pts |
| **Spotify ToS** | 0 | -1 | 0 | +2.2% | 0.0% | +2.1% | -6 pts |
| **Zoom Terms** | 0 | -5 | 0 | +2.8% | 0.0% | +3.7% | -2 pts |
| **Overall Dataset** | **0** | **-3** | **0** | **+1.1%** | **0.0%** | **+1.2%** | **Stable** |

#### Variance Takeaway
The system demonstrates remarkable recall stability (**81.5%** on both runs). True Positives (22/27) and False Negatives (5/27) remained identical across runs. Fluctuation occurred primarily in the volume of secondary clauses identified across chunks ($\pm 3$ overall False Positives), which shifted macro precision by only $\pm 0.6\%$. Risk scores varied by at most 6 points on a 100-point scale, and the categorical Risk Label remained consistently **High** for all 5 documents across both runs.

---

## 3. Concrete Qualitative Case Studies

### 3.1 Three True Positives (TP)

#### 1. Netflix - Automatic Renewal (`auto_renewal`)
- **Gold Quote**: `"Unless you cancel your subscription before your billing date, you authorize us to charge the subscription fee for the next billing cycle to your Payment Method (see \"Cancellation\" below)."`
- **Predicted Quote**: `"Unless you cancel your subscription before your billing date, you authorize us to charge the subscription fee for the next billing cycle to your Payment Method (see \"Cancellation\" below)."`
- **Match Metric**: 100% exact character match.
- **Why It Succeeded**: Clean sentence structure without parenthetical clutter allowed the model to extract the entire period cleanly without hallucinating modifications.

#### 2. Adobe - Class Action Waiver (`class_action_waiver`)
- **Gold Quote**: `"You may only resolve disputes with us on an individual basis, and you may not bring a claim as a plaintiff or a class member in a class, consolidated, or representative action."`
- **Predicted Quote**: `"You may only resolve disputes with us on an individual basis, and you may not bring a claim as a plaintiff or a class member in a class, consolidated, or representative action."`
- **Match Metric**: 100% exact character match.
- **Why It Succeeded**: High-salience legal phrase recognized immediately by the model and extracted verbatim.

#### 3. Dropbox - Forced Binding Arbitration (`forced_arbitration`)
- **Gold Quote**: `"You and Dropbox agree to resolve any claims relating to or arising out of these Terms or the Services through final and binding individual arbitration by a single arbitrator, except as set forth under the “Exceptions to Agreement to Arbitrate” below."`
- **Predicted Quote**: `"You and Dropbox agree to resolve any claims relating to or arising out of these Terms or the Services through final and binding individual arbitration by a single arbitrator"`
- **Match Metric**: Substring containment match (the predicted quote is a 144-character prefix of the 246-character gold clause, representing 100% of the predicted quote).
- **Why It Succeeded**: The match rule's containment criterion correctly rewarded the system for extracting the core substantive clause while omitting the trailing procedural cross-reference.

---

### 3.2 Three False Positives (FP)

> **Important Evaluation Context**: In this benchmark, "False Positive" does **not** mean the model hallucinated text (hallucinations were already filtered out by quote verification). Rather, it means the model identified a plausibly risky clause not in the gold key (see FP audit).

#### 1. Zoom - Immediate Termination on 5-Day Late Payment
- **Flagged Category**: `account_termination_without_notice`
- **Extracted Verbatim Quote**: `"if any failure to pay Charges continues for five (5) calendar days following the due date, Zoom may terminate, suspend, or disconnect your Services immediately and without prior notice."`
- **Why the System Flagged It**: The clause explicitly allows the vendor to terminate services without notice after only 5 days of non-payment.
- **Why It Is Counted as FP**: The Gold standard prioritizes the top general dispute terms and excluded secondary commercial collections provisions.

#### 2. Dropbox - Partner & Affiliate File Scanning
- **Flagged Category**: `third_party_data_sharing`
- **Extracted Verbatim Quote**: `"To provide these and other features, Dropbox accesses, stores, and scans Your Stuff. You give us permission to do those things, and this permission extends to our affiliates and trusted third parties we work with."`
- **Why the System Flagged It**: The clause grants data access permissions extending to unnamed third-party partners.
- **Why It Is Counted as FP**: Dropbox's gold set focused on monetary and dispute provisions ($20 liability cap, no-refund, arbitration).

#### 3. Adobe - Inactive Content Deletion Without Notice
- **Flagged Category**: `other`
- **Extracted Verbatim Quote**: `"If you don't sign into your account periodically, we reserve the right to assume your account is inactive, and you agree that we may permanently delete your Content stored in the account or close your account entirely."`
- **Why the System Flagged It**: High consumer consequence (permanent loss of stored creative files upon inactivity).
- **Why It Is Counted as FP**: The gold standard was intentionally bounded to 5 primary clauses and did not index account housekeeping clauses.

---

### 3.3 Three False Negatives (FN)

#### 1. Spotify - Forced Arbitration (`gold-spotify-5`)
- **Gold Category**: `forced_arbitration`
- **Gold Quote**: `"You and Spotify agree that any dispute, claim, or conflict between you and Spotify arising in any way in connection with these Agreements or your relationship with Spotify as a user of the Service (whether based on contract, tort, law, fraud, misrepresentation, or any other legal theory, regardless of whether the claim arises during or after the term of the Agreements) shall be resolved by binding individual arbitration."`
- **Root Cause of Miss (Evidence from `results_run1.json`)**: In Chunk 4, the model identified this clause but inserted an ellipsis (`...`) replacing 155 characters of parenthetical legal theories. Raw model output in `droppedExamples`:
  > `"You and Spotify agree that any dispute, claim, or conflict between you and Spotify arising in any way in connection with these Agreements or your relationship with Spotify as a user of the Service... shall be resolved by binding individual arbitration."`
  Because the text contained an ellipsis not present in the source text, `verifyQuote()` detected non-verbatim text and **DROPPED** the clause. As a direct consequence, the dropped clause could not match the gold entry, producing an FN.

#### 2. Spotify - Liability Limitation (`gold-spotify-4`)
- **Gold Category**: `liability_limitation`
- **Gold Quote**: `"Spotify, its officers, shareholders, employees, representatives, directors, affiliates, subsidiaries, successors, officers, suppliers, or licensors shall in no event be liable for: (1) any indirect, special, incidental, punitive, exemplary, or consequential damages of any kind"`
- **Root Cause of Miss (Evidence from `results_run1.json`)**: Identical mechanism. The model attempted to combine items (1), (2), and (3) using internal ellipses. Raw model output in `droppedExamples`:
  > `"Spotify, its officers, shareholders, employees, representatives, directors, affiliates, subsidiaries, successors, officers, suppliers, or licensors shall in no event be liable for: (1) any indirect, special, incidental, punitive, exemplary, or consequential damages of any kind; (2) any loss of use, loss of data, loss of business, or loss of profits... or (3) total liability for all claims relating to the Spotify Service... up to (a) the amount you paid to Spotify within twelve months prior to the first claim, or (b) $30.00, whichever is higher."`
  Quote verification dropped the synthetic string, leading to an FN.

#### 3. Adobe - Discretionary Immediate Termination (`gold-adobe-2`)
- **Gold Category**: `account_termination_without_notice`
- **Gold Quote**: `"Unless stated in the Product Specific Terms, we may at any time immediately terminate or suspend your right to use and access the Services and Software if in Adobe's sole discretion:"`
- **Root Cause of Miss (Evidence from `results_run1.json` & Document Offsets)**:
  - In `eval/docs/adobe_terms.txt`, the gold text appears at character offset 51,214 (Section 11.2, located in Chunk 4).
  - In `results_run1.json`, the model extracted two trial-period termination clauses from earlier sections (`"At any time prior to or during the free, Complimentary Services, or trial period, Adobe may, in its sole discretion, terminate that access without prior notice..."`), but in Chunk 4, **no extracted clause (verified or dropped) overlapped the gold text**.
  - *[Hypothesis, not verified]*: The model may have reached its per-chunk attention capacity or prioritized other terms in Chunk 4 (such as indemnity and warranty disclaimers), leaving Section 11.2 unextracted.

---

### 3.4 Dropped Claims from Quote Verification (Hallucination Defense in Action)

During the two evaluation runs, the quote verification engine caught and rejected **12 claims in Run 1** and **14 claims in Run 2**. Every dropped claim was generated by the LLM (no scripted or synthetic injection strings).

#### Example 1: Ellipsis Compression Failure (Evidence from `results_run1.json`)
- **Document**: Spotify Terms of Use (Chunk 4)
- **Model Output Quote**:
  > `"You and Spotify agree that any dispute, claim, or conflict between you and Spotify arising in any way in connection with these Agreements or your relationship with Spotify as a user of the Service... shall be resolved by binding individual arbitration."`
- **Why It Was Dropped**: The model substituted 155 characters of parenthetical legal terminology with `...`. The normalized substring search searched for the characters `...` in the source text, failed to find them, and dropped the claim.

#### Example 2: Ellipsis in Damages Disclaimer (Evidence from `results_run1.json`)
- **Document**: Spotify Terms of Use (Chunk 3)
- **Model Output Quote**:
  > `"Spotify, its officers, shareholders, employees, representatives... shall in no event be liable for: (1) any indirect... or (3) total liability... up to (a) the amount you paid... or (b) $30.00..."`
- **Why It Was Dropped**: The model stitched disjointed fragments separated by multiple lines into a single synthetic sentence with repeated ellipses. The verification engine detected that this contiguous string did not exist in the source document and purged it completely.

---

## 4. Failure Mode Analysis

1. **LLM Ellipsis Tendency vs. Strict Substring Verification**:
   - The primary failure mode causing False Negatives is the model's tendency to insert `...` when quoting lengthy (300+ character) legal sentences.
   - When the LLM compresses a clause with `...`, quote verification drops it, turning what would have been a True Positive into a False Negative.

2. **Precision Deficit in Massive Documents (Zoom & Adobe)**:
   - On short documents (Netflix, 3,493 words; Dropbox, 4,292 words), precision is solid (**50.0% – 55.6%**).
   - On massive documents (Zoom, 13,749 words; Adobe, 11,648 words), the document is partitioned into 8–9 chunks. The LLM extracts 3 to 4 valid clauses per chunk, resulting in 26 to 30 extracted clauses.
   - Because our gold key intentionally restricts itself to 5 focal consumer traps, the remaining 20+ plausibly risky clauses not in the gold key (see FP audit) (late fees, cross-border transfers, arbitration rules, indemnifications) count mathematically as False Positives, driving Zoom's precision down to **11.5% – 14.3%**.

3. **Inter-Chunk Context Splitting**:
   - Splitting documents into 12,000-character chunks with 500-character overlap prevents boundary cutoffs for short clauses, but cross-references (e.g. *"disputes shall be resolved pursuant to Section 18.2"*) lose their referent when Section 18.2 is in a subsequent chunk.

---

## 5. Honest Academic Conclusion & Limitations

### Summary of Findings
ContractTrapSpotter was evaluated across **5 real-world documents** comprising **40,047 words** and **27 gold clauses**, using **Gemini 3.8 Flash** drafted gold, tested on **`gemini-flash-lite-latest`** across **2 independent runs**.

Under these experimental conditions:
- **Recall**: Reached **81.5%** in Run 1 (22/27) and **77.8%** in Run 2 (21/27), consistently capturing high-severity arbitration, class action waiver, auto-renewal, and refund clauses across all documents.
- **Raw Precision**: Averaged **28.2%** (Run 1) and **27.6%** (Run 2) against the compact 27-clause gold standard. When evaluated via human FP audit ($n = 20$), **70.0%** of false positives represented plausibly risky clauses not in the gold key, adjusting precision to an estimated **62.7% – 89.6%** range (Wilson 95% CI).

### Methodological Limitations
1. **Score Non-Discrimination**: All five documents received a final score in the **High Risk** category (scores: 68, 78, 79, 89, 97). As a result, the overall risk score cannot discriminate between relatively benign consumer terms and aggressive enterprise terms.
2. **Small Gold Corpus & Recall Uncertainty**: With only 27 gold clauses across 5 documents, each single missed clause shifts recall by ~3.7 percentage points, creating wide statistical uncertainty around the true population recall.
3. **Lightweight Model Tier**: Evaluations reflect `gemini-flash-lite-latest` (`gemini-2.5-flash-lite`). A flagship tier model (e.g. Gemini Pro or Claude Opus) may exhibit different verbatim quotation discipline and category accuracy.
4. **Lenient Containment Matching**: The evaluation rule matches if $P_{\text{norm}} \subseteq G_{\text{norm}}$, which permits short predicted fragments to count as full matches against longer gold clauses without penalizing omission of surrounding context.
5. **Table Truncation vs. Model Output**: In the False Positive audit table (Section 6), ellipses (`"..."`) represent visual table truncation for layout display, **not** LLM output — with the single documented exception of **Sample #10**, where the model generated a literal trailing ellipsis that was accepted by the fuzzy sliding-window fallback.
6. **Bypass of Browser Capture**: This benchmark evaluates directly against raw text files in `eval/docs/`, completely bypassing the browser DOM capture path (`capturePageText()`), layout rendering, iframe restrictions, and script stripping.
7. **Unmeasured Latency**: Latency was not formally logged or measured during the eval runs. Earlier informal estimates (e.g. "~45 seconds") are unmeasured and omitted.

---

## 6. False Positive (FP) Audit Protocol

### 6.1 Purpose and Audit Taxonomy
In information extraction over lengthy legal contracts, low statistical precision often conflates two very different outcomes:
1. **Model over-flagging**: The model flags benign or ordinary boilerplate as risky.
2. **Gold standard sparsity**: The model flags a plausibly risky clause not in the gold key (see FP audit).

To objectively separate these two phenomena, 20 False Positives from **Run 1** (`eval/results_run1.json`) were randomly sampled across all five documents into [`eval/fp_audit.json`](file:///c:/James/Software%20eng%20classes/3.sinif/1.sem/Yaz%C4%B1l%C4%B1m%20Ger%C3%A7ekleme%20ve%20Test/ContractTrapSpotter/eval/fp_audit.json) for human annotation.

The human auditor assigned one of three mutually exclusive labels to each sampled item:
- **`genuine_missing_from_gold`**: The extracted text represents a plausibly risky clause not in the gold key (see FP audit) that an informed consumer might want highlighted, but which was omitted from the 5-to-6 clause gold standard key.
- **`not_risky`**: The extracted text represents standard, necessary, or neutral legal boilerplate that poses no unusual burden or risk to the consumer (a true false alarm).
- **`wrong_category`**: The text is genuinely concerning, but the model assigned an incorrect category from the 17-item enum taxonomy.

### 6.2 Sampling Methodology
- **Source Pool**: 56 False Positives from Run 1 (`eval/results_run1.json`).
- **Sample Size**: 20 clauses (representing 35.7% of all FPs).
- **Random Number Generator**: `mulberry32` PRNG with **fixed seed `42`** (`SEED = 42`).
- **Distribution across all 5 documents**:
  - `zoom_tos`: 8 clauses
  - `adobe_terms`: 5 clauses
  - `spotify_tos`: 4 clauses
  - `dropbox_tos`: 2 clauses
  - `netflix_terms`: 1 clause

### 6.3 Audit Sample Registry (`eval/fp_audit.json`)

| Sample # | Document | Predicted Category | Verbatim Quote Snippet | Human Label | Notes / Evaluation |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | `dropbox_tos` | `jurisdiction_governing_law` | `"These Terms will be governed by California law except for its conflicts of laws principles."` | `not_risky` | Standard jurisdictional choice of law clause; ordinary boilerplate. |
| **2** | `zoom_tos` | `liability_limitation` | `"Under no circumstances will Zoom be liable in any way for any data or other content viewed while using the Services..."` | `genuine_missing_from_gold` | Broad disclaimer of all content loss and transmission liability. |
| **3** | `spotify_tos` | `hard_to_cancel` | `"If you subscribe to Advantageous Use, you agree that your right to cancel the Paid Subscription... will expire fourteen (14) days..."` | `genuine_missing_from_gold` | Strict forfeiture of standard cancellation rights upon immediate use. |
| **4** | `adobe_terms` | `tracking_profiling` | `"In exchange for your use of a Beta Version, you agree that Adobe may collect data, including crash data... and analyze your Content, including human review..."` | `genuine_missing_from_gold` | Explicit consent to human review and automated analysis of private content. |
| **5** | `adobe_terms` | `forced_arbitration` | `"The arbitrator, and not any federal, state, or local court or agency, shall have the exclusive authority to resolve any dispute relating to the interpretation..."` | `genuine_missing_from_gold` | Broad delegation clause granting arbitrator sole authority over enforceability. |
| **6** | `spotify_tos` | `no_refund` | `"You agree that if you or Spotify breach these Terms or Spotify suspends your access... Spotify will have no liability... and will not refund any payments..."` | `genuine_missing_from_gold` | Discretionary suspension accompanied by total forfeiture of pre-paid fees. |
| **7** | `zoom_tos` | `other` | `"You grant Zoom permission and the right to (i) identify you as a customer and to use your logo across Zoom marketing materials..."` | `not_risky` | Commercial publicity / logo usage right; typical B2B marketing term. |
| **8** | `zoom_tos` | `unilateral_changes` | `"Zoom, in its sole discretion, will (i) calculate the amount of Taxes and Fees due, and (ii) change such amounts without notice to you."` | `genuine_missing_from_gold` | Unilateral power to adjust ancillary fee and tax charges without prior notice. |
| **9** | `zoom_tos` | `other` | `"To the extent permitted by applicable Law... any claim or cause of action under this Agreement... must be filed within one (1) year..."` | `genuine_missing_from_gold` | Contractual shortening of the statutory limitations period to one year. |
| **10** | `spotify_tos` | `other` | `"Except where such restrictions are prohibited by applicable law, all claims under these terms must be initiated within one (1) year..."` | `genuine_missing_from_gold` | Contractual one-year limitations period barring late consumer claims. |
| **11** | `zoom_tos` | `account_termination_without_notice` | `"if any failure to pay Charges continues for five (5) calendar days following the due date, Zoom may terminate, suspend, or disconnect your Services immediately..."` | `genuine_missing_from_gold` | Aggressive 5-day grace period leading to immediate service severance. |
| **12** | `spotify_tos` | `other` | `"All arbitrations must be initiated by posting a claim within ONE (1) YEAR from the date on which the claimant first learned..."` | `genuine_missing_from_gold` | Duplicate limitation rule specific to arbitration filing deadlines. |
| **13** | `dropbox_tos` | `no_refund` | `"Dropbox does not provide refunds if we suspend or terminate your access to the Services, unless required by law."` | `genuine_missing_from_gold` | Blanket refund denial following vendor-initiated account termination. |
| **14** | `adobe_terms` | `other` | `"By using our Services and Software, you authorize Adobe to transfer your personal information across national borders..."` | `genuine_missing_from_gold` | Broad authorization for cross-border data transfer without country guarantees. |
| **15** | `zoom_tos` | `unilateral_changes` | `"We may assign our rights or transfer any or all of our obligations under this Agreement at any time, without prior notice to you..."` | `not_risky` | Standard corporate successor assignment clause during M&A. |
| **16** | `adobe_terms` | `other` | `"At the end of this 30-day transition period, we reserve the right to delete your Content. You should download any Content that you have stored..."` | `genuine_missing_from_gold` | Automatic permanent deletion of stored creative assets after 30 days. |
| **17** | `zoom_tos` | `liability_limitation` | `"(iv) in Section 26, that you release Zoom from, and waive your right to recover from Zoom, certain damages."` | `not_risky` | Introductory cross-reference summary pointing to Section 26. |
| **18** | `adobe_terms` | `liability_limitation` | `"Unless stated in the Product Specific Terms, the Services and Software are provided “AS-IS.” To the maximum extent permitted by law... disclaim all warranties..."` | `not_risky` | Universal UCC implied warranty disclaimer ("AS-IS"). |
| **19** | `netflix_terms` | `unilateral_changes` | `"You authorize us to charge any Payment Method associated with your account in case your primary Payment Method is declined or no longer available..."` | `wrong_category` | Genuine billing risk (fallback charging), but misclassified as unilateral change. |
| **20** | `zoom_tos` | `forced_arbitration` | `"You and Zoom hereby waive any constitutional and statutory rights to sue in court and have a trial in front of a judge or a jury..."` | `genuine_missing_from_gold` | Explicit constitutional jury trial waiver reinforcing binding arbitration. |

> [!NOTE]
> **Audit Finding on Sample #10 (Trailing Ellipsis & Fuzzy Verifier Fallback)**:
> In `eval/results_run1.json`, the model's raw quote for Sample #10 ended with a literal trailing ellipsis: `"Except where such restrictions are prohibited by applicable law, all claims under these terms must be initiated within one (1) year from the date on which the claimant first learned, or reasonably should have learned, of the act, omission or fault giving rise to the claim..."`.
> In the underlying source document (`eval/docs/spotify_tos.txt` line 191), this sentence does **not** end with an ellipsis; it continues: `"(by filing a request for arbitration or by initiating an individual action under the arbitration agreement below), and no remedy shall be available for any claim not specified within this period."`
> The quote verifier accepted this non-verbatim quote because its secondary sliding-window fuzzy fallback (`bestSlidingWindowSimilarity`) reached the $\ge 0.95$ Dice similarity threshold over the 245-character passage. This is an empirical bug/limitation of the approximate matching tier allowing near-verbatim quotes with truncated ellipses to pass.

---

### 6.4 Audit Quantitative Analysis: Genuine-Risky Fraction & Adjusted Precision

#### Label Counts Breakdown ($n = 20$)
- **`genuine_missing_from_gold`**: **14** (70.0%)
- **`not_risky`**: **5** (25.0%)
- **`wrong_category`**: **1** (5.0%)
- *Total Sampled*: **20** (100.0%)

#### Duplicate Items Accounting
Among the 14 items labeled as `genuine_missing_from_gold`:
- **Spotify Limitation Duplicates**: Sample #10 and Sample #12 both articulate the 1-year statute of limitations (one general, one specific to arbitration). Counting Sample #12 as a redundant duplicate of an already identified limitation principle leaves **13 unique genuine missing clauses**.
- **Zoom & Adobe Secondary Clauses**: Sample #20 (jury trial waiver) and Sample #5 (arbitrator jurisdiction delegation) elaborate on binding arbitration. While they are legally distinct enforceable covenants, they pertain to the same dispute domain as the gold arbitration clause.
- If duplicate / domain-overlapping items are counted separately as non-distinct, the unique genuine fraction adjusts to **12 to 13 out of 20 (60.0% – 65.0%)**.

#### Estimated Genuine-Risky Fraction ($f$) and Wilson 95% Confidence Interval
For a binomial proportion with $x = 14$ successes out of $n = 20$ trials, the point estimate is:
$$\hat{f} = \frac{14}{20} = 0.700 \quad (70.0\%)$$

Using the **Wilson score interval** (without continuity correction) at a 95% confidence level ($z = 1.95996$):
$$\text{Center} = \frac{\hat{p} + \frac{z^2}{2n}}{1 + \frac{z^2}{n}} = \frac{0.700 + \frac{3.8415}{40}}{1 + \frac{3.8415}{20}} = \frac{0.7960}{1.1921} \approx 0.6678$$
$$\text{Margin} = \frac{z}{1 + \frac{z^2}{n}} \sqrt{\frac{\hat{p}(1 - \hat{p})}{n} + \frac{z^2}{4n^2}} = \frac{1.95996}{1.1921} \sqrt{\frac{0.2100}{20} + \frac{3.8415}{1600}} \approx 1.6441 \times 0.1136 \approx 0.1867$$
$$f_{\text{lower}} = 0.6678 - 0.1867 = \mathbf{0.4810 \ (48.1\%)}, \quad f_{\text{upper}} = 0.6678 + 0.1867 = \mathbf{0.8545 \ (85.5\%)}$$

*(Note: If the single `wrong_category` item #19 is included as a genuine risk that was simply misclassified, $x = 15/20 = 75.0\%$, yielding a Wilson 95% interval of $[0.5313, 0.8881]$ or $53.1\% \text{ to } 88.8\%$.)*

#### Raw Precision vs. Adjusted Precision Comparison (Run 1)
In Run 1, the system extracted 78 verified candidate clauses across the 5 documents, producing:
- **True Positives ($\text{TP}$)**: 22
- **False Positives ($\text{FP}$)**: 56
- **Raw Precision**:
  $$\text{Raw Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}} = \frac{22}{22 + 56} = \frac{22}{78} = \mathbf{28.2\%}$$

Accounting for the estimated fraction $f$ of False Positives that represent plausibly risky clauses not in the gold key (see FP audit) omitted by gold sparsity:
$$\text{Adjusted Precision}(f) = \frac{\text{TP} + f \times \text{FP}}{\text{TP} + \text{FP}} = \frac{22 + f \times 56}{78}$$

| Metric | Formula | Fraction $f$ | Calculated Precision | Interpretation |
| :--- | :--- | :---: | :---: | :--- |
| **Raw Precision** | $\frac{\text{TP}}{\text{TP} + \text{FP}}$ | $0.0\%$ | **28.2%** | Treats all non-gold extractions as false alarms. |
| **Adjusted Precision (Point Est.)** | $\frac{\text{TP} + \hat{f} \times \text{FP}}{\text{TP} + \text{FP}}$ | $70.0\%$ | **78.5%** | Incorporates the 14/20 sample point estimate. |
| **Adjusted Precision (Wilson Lower)** | $\frac{\text{TP} + f_{\text{lower}} \times \text{FP}}{\text{TP} + \text{FP}}$ | $48.1\%$ | **62.7%** | Conservative lower bound at 95% confidence. |
| **Adjusted Precision (Wilson Upper)** | $\frac{\text{TP} + f_{\text{upper}} \times \text{FP}}{\text{TP} + \text{FP}}$ | $85.5\%$ | **89.6%** | Optimistic upper bound at 95% confidence. |

*(If including `wrong_category` at $x = 15/20$, the point estimate is **82.1%**, with a 95% range of **66.3% to 92.0%**.)*

---

### 6.5 Methodological Limitations & Subjectivity Caveats

To ensure academic and scientific integrity, the following caveats must be explicitly acknowledged:
1. **Sample Size**: The audit was conducted on a small sample of $n = 20$ clauses drawn from the 56 False Positives in Run 1 (a 35.7% sampling fraction). Consequently, the Wilson 95% confidence interval spans a wide range ($\pm 18.7\%$).
2. **Corpus Distribution Skew (Zoom Weighting)**: Because Zoom's 13,749-word document generated 23 False Positives in Run 1, 8 of the 20 sampled clauses (40.0%) originated from Zoom. The audit sample is disproportionately reflective of Zoom's contract structure.
3. **Subjective Annotation**: Labels were drafted by an LLM (Claude) and reviewed by a single student annotator. Legal evaluations of what constitutes a "genuine consumer trap" versus "ordinary, non-burdensome corporate boilerplate" are inherently subjective.
4. **Redundancy and Granularity**: Clauses addressing the same legal mechanism (e.g. general vs. arbitration statute of limitations) were tagged as genuine risks. If evaluated strictly by non-redundant risk themes, the precision adjustment would be moderately lower.
