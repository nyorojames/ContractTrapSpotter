import { describe, it, expect } from 'vitest';
import { LLMResponseSchema, ClauseCategory, DocumentType } from './index';

describe('Schema Validation', () => {
  it('validates a correct LLM response', () => {
    const validData = {
      document_type: 'tos',
      clauses: [
        {
          id: 'clause-1',
          category: 'forced_arbitration',
          severity: 5,
          quote: 'All disputes will be resolved by individual binding arbitration rather than in court.',
          explanation: 'You cannot sue the company in court and must submit to binding arbitration.',
          confidence: 0.95,
        },
      ],
      unclear_sections: [
        {
          quote: 'Subject to third party availability at reasonable discretion.',
          reason: 'Discretion standard is not clearly defined.',
        },
      ],
    };

    const parsed = LLMResponseSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.document_type).toBe('tos');
      expect(parsed.data.clauses).toHaveLength(1);
      expect(parsed.data.clauses[0].category).toBe('forced_arbitration');
    }
  });

  it('rejects invalid categories outside the 17-item taxonomy', () => {
    const invalidData = {
      document_type: 'tos',
      clauses: [
        {
          id: 'c1',
          category: 'unreasonable_user_fee_hike', // Invalid category
          severity: 4,
          quote: 'We may increase fees anytime at our sole discretion.',
          explanation: 'Fees can be increased.',
          confidence: 0.9,
        },
      ],
    };

    const parsed = LLMResponseSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('rejects severity out of 1-5 range', () => {
    const invalidData = {
      document_type: 'tos',
      clauses: [
        {
          id: 'c1',
          category: 'no_refund',
          severity: 6, // Max is 5
          quote: 'All subscription payments are strictly non-refundable.',
          explanation: 'No refunds under any circumstances.',
          confidence: 0.9,
        },
      ],
    };

    const parsed = LLMResponseSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('rejects quotes that are too short (< 10 chars)', () => {
    const invalidData = {
      document_type: 'tos',
      clauses: [
        {
          id: 'c1',
          category: 'no_refund',
          severity: 3,
          quote: 'No refund', // < 10 chars
          explanation: 'No refunds under any circumstances.',
          confidence: 0.9,
        },
      ],
    };

    const parsed = LLMResponseSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });
});
