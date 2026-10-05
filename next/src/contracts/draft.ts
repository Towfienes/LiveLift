import { z } from "zod";

export const DraftTypeSchema = z.enum([
  "presentation",
  "platform_action",
  "note",
  "end_live",
]);
export type DraftType = z.infer<typeof DraftTypeSchema>;

export const UnsyncedDraftSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  draftType: DraftTypeSchema,
  targetProductId: z.string().nullable().optional(),
  targetAction: z.string().optional(),
  assertion: z.string(),
  capturedAt: z.string(),
  deviceLocal: z.literal(true).default(true),
  confirmedForSubmission: z.boolean().default(false),
  submissionStatus: z
    .enum(["draft", "submitting", "submitted", "unresolved"])
    .default("draft"),
});
export type UnsyncedDraft = z.infer<typeof UnsyncedDraftSchema>;
