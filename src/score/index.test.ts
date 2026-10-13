import { describe, it, expect } from 'vitest';
import { computeScore } from './index';
import type { Clause } from '../schema';

describe('Deterministic Scoring Engine', () => {
  it('returns score 0 and Low risk when no clauses are detected', () => {
    const result = computeScore([], 0, 0);
    expect(result.score).toBe(0);
    expect(result.label).toBe('Low');
    expect(result.breakdown).toHaveLength(0);
  });

  it('marks document as Inconclusive if > 50% claims were dropped and verified clauses < 3', () => {
    const clauses: Clause[] = [
      {
        id: 'c1',
        category: 'unilateral_changes',
        severity: 2,
        quote: 'We may modify terms',
        explanation: 'Terms can be updated',
        confidence: 0.8,
      },
    ];
    // 1 verified, 5 dropped out of 6 total claims
    const result = computeScore(clauses, 5, 6);
    expect(result.label).toBe('Inconclusive');
  });

  it('computes deterministic score based on category weight, severity, and confidence', () => {
    const highRiskClauses: Clause[] = [
      {
        id: 'c1',
        category: 'data_selling', // weight 10
        severity: 5,
        quote: 'We sell your personal data to ad brokers',
        explanation: 'Data selling is dangerous',
        confidence: 1.0,
      },
      {
        id: 'c2',
        category: 'forced_arbitration', // weight 9
        severity: 5,
        quote: 'All claims must be submitted to binding arbitration',
        explanation: 'Cannot sue in court',
        confidence: 1.0,
      },
      {
        id: 'c3',
        category: 'class_action_waiver', // weight 9
        severity: 5,
        quote: 'You waive your right to a class action lawsuit',
        explanation: 'No class actions',
        confidence: 1.0,
      },
    ];

    // total raw: 10*5*1 + 9*5*1 + 9*5*1 = 50 + 45 + 45 = 140
    // score = round(100 * (1 - e^(-140/150))) = round(100 * (1 - e^-0.9333)) = round(100 * (1 - 0.3932)) = 61
    const result = computeScore(highRiskClauses, 0, 3);
    expect(result.score).toBeGreaterThan(50);
    expect(result.breakdown).toHaveLength(3);
    expect(result.label).toBe('Medium');
  });

  it('caps score at High for high-severity accumulative clauses', () => {
    const clauses: Clause[] = [
      { id: '1', category: 'data_selling', severity: 5, quote: 'q1', explanation: 'e1', confidence: 1.0 },
      { id: '2', category: 'forced_arbitration', severity: 5, quote: 'q2', explanation: 'e2', confidence: 1.0 },
      { id: '3', category: 'class_action_waiver', severity: 5, quote: 'q3', explanation: 'e3', confidence: 1.0 },
      { id: '4', category: 'children_data', severity: 5, quote: 'q4', explanation: 'e4', confidence: 1.0 },
      { id: '5', category: 'third_party_data_sharing', severity: 5, quote: 'q5', explanation: 'e5', confidence: 1.0 },
    ];
    // raw = 50 + 45 + 45 + 45 + 40 = 225
    // score = 100 * (1 - e^(-225/150)) = 100 * (1 - e^-1.5) = 100 * (1 - 0.2231) = 78
    const result = computeScore(clauses, 0, 5);
    expect(result.score).toBeGreaterThanOrEqual(66);
    expect(result.label).toBe('High');
  });

  it('is completely deterministic and not affected by external prompt claims', () => {
    const clause: Clause = {
      id: 'single',
      category: 'auto_renewal',
      severity: 2,
      quote: 'auto renews each month',
      explanation: 'renews automatically',
      confidence: 0.9,
    };
    const res1 = computeScore([clause], 0, 1);
    const res2 = computeScore([clause], 0, 1);
    expect(res1.score).toBe(res2.score);
    expect(res1.label).toBe(res2.label);
  });
});
