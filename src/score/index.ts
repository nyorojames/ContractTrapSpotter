import type { Clause, ClauseCategory } from '../schema';

/**
 * Category risk weights (higher = more concerning to users)
 */
const CATEGORY_WEIGHTS: Record<ClauseCategory, number> = {
  data_selling: 10,
  forced_arbitration: 9,
  class_action_waiver: 9,
  children_data: 9,
  third_party_data_sharing: 8,
  broad_data_collection: 8,
  tracking_profiling: 7,
  account_termination_without_notice: 7,
  long_data_retention: 6,
  hard_to_cancel: 6,
  no_refund: 5,
  unilateral_changes: 7,
  auto_renewal: 4,
  liability_limitation: 5,
  content_license_grant: 5,
  jurisdiction_governing_law: 3,
  other: 3,
};

export type RiskLabel = 'Low' | 'Medium' | 'High' | 'Inconclusive';

export interface ScoreResult {
  score: number; // 0-100
  label: RiskLabel;
  breakdown: { category: ClauseCategory; contribution: number }[];
}

/**
 * Compute a deterministic risk score from validated clauses.
 *
 * Formula per clause: weight(category) * severity * confidence
 * Total: sum of clause scores, normalized to 0-100.
 *
 * The LLM NEVER supplies the overall score.
 */
export function computeScore(clauses: Clause[], droppedCount: number, totalClauses: number): ScoreResult {
  if (clauses.length === 0) {
    const isInconclusive = totalClauses > 0 && droppedCount > totalClauses * 0.5;
    return {
      score: 0,
      label: isInconclusive ? 'Inconclusive' : 'Low',
      breakdown: [],
    };
  }

  const breakdown: { category: ClauseCategory; contribution: number }[] = [];
  let rawTotal = 0;

  for (const clause of clauses) {
    const weight = CATEGORY_WEIGHTS[clause.category] || 3;
    // Per-clause contribution: weight * severity * confidence
    // Max single clause: 10 * 5 * 1.0 = 50
    const contribution = weight * clause.severity * clause.confidence;
    rawTotal += contribution;
    breakdown.push({ category: clause.category, contribution });
  }

  // Normalize: max theoretical = 50 per clause, assume ~10 clauses for "maximum risk"
  // Use a soft cap: score = 100 * (1 - e^(-rawTotal / 150))
  const score = Math.round(100 * (1 - Math.exp(-rawTotal / 150)));
  const capped = Math.min(100, Math.max(0, score));

  // Determine label
  let label: RiskLabel;
  if (droppedCount > totalClauses * 0.5 && clauses.length < 3) {
    label = 'Inconclusive';
  } else if (capped <= 30) {
    label = 'Low';
  } else if (capped <= 65) {
    label = 'Medium';
  } else {
    label = 'High';
  }

  return { score: capped, label, breakdown };
}
