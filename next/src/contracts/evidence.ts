import { z } from "zod";
import { EvidenceClassSchema } from "./recommendation";

export const EvidenceSourceSchema = z.enum([
  "operator",
  "provider",
  "platform",
  "simulator",
]);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceFreshnessSchema = z.enum(["fresh", "stale", "unknown"]);
export type EvidenceFreshness = z.infer<typeof EvidenceFreshnessSchema>;

export const MetricFinalitySchema = z.enum([
  "pending",
  "provisional",
  "final",
  "unavailable",
]);
export type MetricFinality = z.infer<typeof MetricFinalitySchema>;

export const EvidenceRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  assertion: z.string(),
  source: EvidenceSourceSchema,
  actor: z.string().nullable().optional(),
  occurredAt: z.string(),
  receivedAt: z.string(),
  evidenceClass: EvidenceClassSchema,
  isLate: z.boolean().default(false),
  targetContext: z.string(),
  targetProductId: z.string().nullable().optional(),
  targetSegmentId: z.string().nullable().optional(),
  details: z.string().optional(),
  platformVerification: EvidenceClassSchema.default("unknown"),
  relatedRecordIds: z.array(z.string()).default([]),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const MetricWindowSchema = z.object({
  id: z.string(),
  metricKey: z.string(),
  label: z.string(),
  unit: z.string(),
  value: z.number().nullable(), // missing != zero
  finality: MetricFinalitySchema,
  source: z.string(),
  windowStart: z.string(),
  windowEnd: z.string(),
  completenessPercent: z.number().min(0).max(100),
  asOfTimestamp: z.string(),
});
export type MetricWindow = z.infer<typeof MetricWindowSchema>;
