import { z } from "zod";

export const LearningObjectTypeSchema = z.enum([
  "observation",
  "insight",
  "hypothesis",
  "next_live_change",
]);
export type LearningObjectType = z.infer<typeof LearningObjectTypeSchema>;

export const LearningObjectSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: LearningObjectTypeSchema,
  title: z.string(),
  description: z.string(),
  scope: z.enum(["session", "product", "segment"]),
  targetId: z.string().nullable().optional(),
  evidenceRecordIds: z.array(z.string()).default([]),
  isAiSuggested: z.boolean().default(false),
  isAccepted: z.boolean().default(false),
  uncertaintyNote: z.string().optional(),
});
export type LearningObject = z.infer<typeof LearningObjectSchema>;

export const NextLiveChangeTypeSchema = z.enum([
  "duration",
  "order",
  "cue",
  "priority",
  "add_product",
  "constraint",
]);
export type NextLiveChangeType = z.infer<typeof NextLiveChangeTypeSchema>;

export const NextLiveChangeSchema = z.object({
  id: z.string(),
  learningObjectId: z.string(),
  targetType: z.enum(["segment", "product"]),
  targetId: z.string(),
  targetName: z.string(),
  changeType: NextLiveChangeTypeSchema,
  description: z.string(),
  appliedSummary: z.string(),
  isSelected: z.boolean().default(true),
});
export type NextLiveChange = z.infer<typeof NextLiveChangeSchema>;
