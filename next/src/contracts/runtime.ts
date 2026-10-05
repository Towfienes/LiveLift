import { z } from "zod";
import { RecommendationSchema } from "./recommendation";
import { RunOfShowSegmentSchema } from "./runOfShow";
import { ProductSnapshotSchema } from "./product";
import { OperatingCapabilitiesSchema } from "./capabilities";
import { SessionIdentitySchema } from "./session";

export const CommandIntentTypeSchema = z.enum([
  "accept_recommendation",
  "reject_recommendation",
  "start_segment",
  "skip_segment",
  "hold_proposal",
  "resume_proposal",
  "extend_duration",
  "choose_next",
  "report_presentation",
  "report_action",
  "add_note",
  "end_live",
]);
export type CommandIntentType = z.infer<typeof CommandIntentTypeSchema>;

export const CommandStatusSchema = z.enum([
  "idle",
  "pending",
  "acknowledged",
  "rejected",
  "conflicting",
  "unknown",
]);
export type CommandStatus = z.infer<typeof CommandStatusSchema>;

export const CommandResultSchema = z.object({
  id: z.string(),
  intent: CommandIntentTypeSchema,
  status: CommandStatusSchema,
  message: z.string().optional(),
  timestamp: z.string(),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

export const RuntimeSnapshotSchema = z.object({
  session: SessionIdentitySchema,
  currentSegment: RunOfShowSegmentSchema.nullable(),
  presentingProduct: ProductSnapshotSchema.nullable(),
  presentingReportedBy: z.string().nullable().optional(),
  presentingReportedAt: z.string().nullable().optional(),
  pinnedProduct: ProductSnapshotSchema.nullable(),
  pinnedVerification: z
    .enum(["confirmed", "observed", "unknown", "failed"])
    .default("unknown"),
  pinnedReportedBy: z.string().nullable().optional(),
  pinnedReportedAt: z.string().nullable().optional(),
  activeRecommendation: RecommendationSchema.nullable(),
  segments: z.array(RunOfShowSegmentSchema),
  products: z.array(ProductSnapshotSchema),
  capabilities: OperatingCapabilitiesSchema,
  isHeld: z.boolean().default(false),
  lastCommandResult: CommandResultSchema.optional(),
});
export type RuntimeSnapshot = z.infer<typeof RuntimeSnapshotSchema>;
