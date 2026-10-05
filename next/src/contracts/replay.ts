import { z } from "zod";
import { EvidenceClassSchema } from "./recommendation";

export const KnowledgeViewSchema = z.enum([
  "as_known_then",
  "with_later_evidence",
]);
export type KnowledgeView = z.infer<typeof KnowledgeViewSchema>;

export const ReplayEventTypeSchema = z.enum([
  "recommendation",
  "decision",
  "attempt",
  "operator_report",
  "observation",
  "platform_confirmation",
  "segment_transition",
  "gap_start",
  "gap_end",
  "note",
]);
export type ReplayEventType = z.infer<typeof ReplayEventTypeSchema>;

export const ReplayEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  timestamp: z.string(),
  elapsedSeconds: z.number(),
  type: ReplayEventTypeSchema,
  title: z.string(),
  subtitle: z.string(),
  statusText: z.string(),
  icon: z.string(),
  evidenceClass: EvidenceClassSchema,
  isLate: z.boolean().default(false),
  lateReceiptAt: z.string().optional(),
  targetProductId: z.string().nullable().optional(),
  targetSegmentId: z.string().nullable().optional(),
  actor: z.string().optional(),
  details: z.string().optional(),
  relatedRecordIds: z.array(z.string()).default([]),
});
export type ReplayEvent = z.infer<typeof ReplayEventSchema>;

export const ReplayGapSchema = z.object({
  id: z.string(),
  startElapsedMinutes: z.number(),
  endElapsedMinutes: z.number(),
  label: z.string(),
  description: z.string(),
  affectedDecisions: z.array(z.string()).default([]),
});
export type ReplayGap = z.infer<typeof ReplayGapSchema>;
