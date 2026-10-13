import { z } from 'zod';

export const ClauseCategory = z.enum([
  'auto_renewal',
  'hard_to_cancel',
  'no_refund',
  'third_party_data_sharing',
  'data_selling',
  'broad_data_collection',
  'long_data_retention',
  'forced_arbitration',
  'class_action_waiver',
  'unilateral_changes',
  'liability_limitation',
  'content_license_grant',
  'account_termination_without_notice',
  'jurisdiction_governing_law',
  'tracking_profiling',
  'children_data',
  'other',
]);

export type ClauseCategory = z.infer<typeof ClauseCategory>;

export const DocumentType = z.enum([
  'tos',
  'privacy',
  'subscription',
  'other',
  'not_legal',
]);

export type DocumentType = z.infer<typeof DocumentType>;

export const ClauseSchema = z.object({
  id: z.string().min(1),
  category: ClauseCategory,
  severity: z.number().int().min(1).max(5),
  quote: z.string().min(10),
  explanation: z.string().min(10).max(300),
  confidence: z.number().min(0).max(1),
});

export type Clause = z.infer<typeof ClauseSchema>;

export const UnclearSectionSchema = z.object({
  quote: z.string().min(5),
  reason: z.string().min(5),
});

export type UnclearSection = z.infer<typeof UnclearSectionSchema>;

export const LLMResponseSchema = z.object({
  document_type: DocumentType,
  clauses: z.array(ClauseSchema),
  unclear_sections: z.array(UnclearSectionSchema).optional().default([]),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
