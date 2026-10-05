import { z } from "zod";

export const SegmentTypeSchema = z.enum([
  "opening",
  "product",
  "flash_sale",
  "qa",
  "closing",
  "break",
]);
export type SegmentType = z.infer<typeof SegmentTypeSchema>;

export const SegmentStateSchema = z.enum([
  "pending",
  "current",
  "completed",
  "skipped",
  "deferred",
]);
export type SegmentState = z.infer<typeof SegmentStateSchema>;

export const RunOfShowSegmentSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  plannedOffsetMinutes: z.number().nonnegative(),
  title: z.string().min(1, "Segment title is required"),
  segmentType: SegmentTypeSchema,
  plannedDurationMinutes: z.number().positive(),
  targetDurationMinutes: z.number().positive(), // can be extended by +1m
  actualStartedAt: z.string().nullable().optional(),
  actualEndedAt: z.string().nullable().optional(),
  cue: z.string().optional(),
  notes: z.string().optional(),
  linkedProductIds: z.array(z.string()).default([]),
  leadProductId: z.string().nullable().optional(),
  state: SegmentStateSchema.default("pending"),
});
export type RunOfShowSegment = z.infer<typeof RunOfShowSegmentSchema>;
