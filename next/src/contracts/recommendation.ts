import { z } from "zod";

export const RecommendationDecisionSchema = z.enum([
  "proposed",
  "accepted",
  "rejected",
  "overridden",
]);
export type RecommendationDecision = z.infer<typeof RecommendationDecisionSchema>;

export const ExecutionStateSchema = z.enum([
  "not_attempted",
  "attempted",
  "operator_reported",
]);
export type ExecutionState = z.infer<typeof ExecutionStateSchema>;

export const EvidenceClassSchema = z.enum([
  "observed",
  "platform_confirmed",
  "failed",
  "unknown",
  "simulated",
]);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

export const RecommendationRationaleSchema = z.object({
  text: z.string(),
  source: z.string(),
  isFresh: z.boolean().default(true),
});
export type RecommendationRationale = z.infer<typeof RecommendationRationaleSchema>;

export const RecommendationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  targetSegmentId: z.string().nullable().optional(),
  targetProductId: z.string().nullable().optional(),
  targetName: z.string(),
  proposedAction: z.string(),
  rationale: z.array(RecommendationRationaleSchema),
  constraintsStatus: z.string(),
  missingInputsNote: z.string().nullable().optional(),
  decision: RecommendationDecisionSchema.default("proposed"),
  decisionActor: z.string().nullable().optional(),
  decisionAt: z.string().nullable().optional(),
  decisionReason: z.string().optional(),
  executionState: ExecutionStateSchema.default("not_attempted"),
  executionAt: z.string().nullable().optional(),
  evidenceClass: EvidenceClassSchema.default("unknown"),
  evidenceAt: z.string().nullable().optional(),
  isPulledForward: z.boolean().default(false),
  pulledForwardReason: z.string().optional(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;
