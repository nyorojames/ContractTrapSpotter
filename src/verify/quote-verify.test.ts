import { describe, it, expect } from 'vitest';
import { normalizeText, verifyQuote } from './quote-verify';

describe('Quote Verification Module', () => {
  describe('normalizeText', () => {
    it('collapses multiple whitespace characters and newlines', () => {
      const input = 'This   is a\n\n\ttest   clause.';
      expect(normalizeText(input)).toBe('this is a test clause.');
    });

    it('normalizes smart single and double quotes to standard ASCII', () => {
      const input = '“Terms of ‘Service’ and “Arbitration””';
      expect(normalizeText(input)).toBe('"terms of \'service\' and "arbitration""');
    });

    it('normalizes em-dashes and en-dashes to hyphens', () => {
      const input = 'Clause 1—Arbitration – Governing Law―Jurisdiction';
      expect(normalizeText(input)).toBe('clause 1-arbitration - governing law-jurisdiction');
    });

    it('lowercases all characters', () => {
      const input = 'ALL CAPITAL LETTERS AND Mixed Case';
      expect(normalizeText(input)).toBe('all capital letters and mixed case');
    });
  });

  describe('verifyQuote', () => {
    const documentText = `
      Spotify Terms and Conditions of Use.
      Last updated: January 15, 2025.

      1. Subscription and Automatic Renewal.
      Your subscription will automatically renew at the end of each billing period unless
      you cancel it at least twenty-four (24) hours before the renewal date. If you do not
      cancel, your designated payment method will be charged the recurring fee.

      2. Changes to Service and Pricing.
      We reserve the right to modify or discontinue the service, or change prices, at any time
      without prior notice. Continued use of the service constitutes acceptance of modified terms.

      3. Dispute Resolution and Class Action Waiver.
      You agree that all disputes must be resolved by individual binding arbitration.
      YOU AND SPOTIFY AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS
      INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS ACTION.
    `;

    it('verifies exact quote matches', () => {
      const quote = 'Your subscription will automatically renew at the end of each billing period';
      const result = verifyQuote(quote, documentText);
      expect(result.found).toBe(true);
      expect(result.matchType).toBe('exact');
    });

    it('verifies quotes with mismatched whitespace and casing', () => {
      const quote = 'YOUR   SUBSCRIPTION WILL\nAUTOMATICALLY RENEW   AT THE END OF EACH BILLING PERIOD';
      const result = verifyQuote(quote, documentText);
      expect(result.found).toBe(true);
      expect(result.matchType).toBe('exact');
    });

    it('verifies quotes containing smart typographic quotes or dashes', () => {
      const quote = 'twenty–four (24) hours before the renewal date';
      const result = verifyQuote(quote, documentText);
      expect(result.found).toBe(true);
      expect(result.matchType).toBe('exact');
    });

    it('matches approximate quotes with minor differences (>= 0.95 similarity)', () => {
      // Very slight variation (one character typo in a long sentence)
      const quote = 'Your subscription will automatically renew at the end of each billing periox unless you cancel it';
      const result = verifyQuote(quote, documentText);
      expect(result.found).toBe(true);
      expect(result.matchType).toBe('approximate');
      expect(result.similarity).toBeGreaterThanOrEqual(0.95);
    });

    it('rejects hallucinated quotes not present in the document', () => {
      const quote = 'We may sell your personal health records to marketing affiliates worldwide';
      const result = verifyQuote(quote, documentText);
      expect(result.found).toBe(false);
      expect(result.matchType).toBe('none');
    });

    it('rejects partially fabricated quotes with similarity below 0.95', () => {
      const quote = 'Your subscription will automatically renew unless you send written notice via postal mail to Stockholm';
      const result = verifyQuote(quote, documentText);
      expect(result.found).toBe(false);
      expect(result.matchType).toBe('none');
    });
  });
});
