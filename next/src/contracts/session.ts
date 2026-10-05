import { z } from "zod";

export const SessionLifecycleSchema = z.enum([
  "planned",
  "active",
  "ended",
  "abandoned",
]);
export type SessionLifecycle = z.infer<typeof SessionLifecycleSchema>;

export const EnvironmentIdentitySchema = z.enum(["REAL", "SIMULATED"]);
export type EnvironmentIdentity = z.infer<typeof EnvironmentIdentitySchema>;

export const OperatorRoleSchema = z.enum(["lead", "assistant"]);
export type OperatorRole = z.infer<typeof OperatorRoleSchema>;

export const OperatorContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: OperatorRoleSchema,
  isLead: z.boolean(),
});
export type OperatorContext = z.infer<typeof OperatorContextSchema>;

export const SessionIdentitySchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Session title is required"),
  scheduledAt: z.string().nullable(),
  actualStartedAt: z.string().nullable(),
  actualEndedAt: z.string().nullable(),
  timezone: z.string().default("Asia/Ho_Chi_Minh"),
  objective: z.string().nullable().optional(),
  accountAssociation: z.string().nullable().optional(),
  environment: EnvironmentIdentitySchema,
  lifecycle: SessionLifecycleSchema,
  revision: z.number().int().nonnegative().default(1),
  currentSegmentId: z.string().nullable(),
  leadOperator: OperatorContextSchema,
  trackedDurationSeconds: z.number().nonnegative().default(0),
});
export type SessionIdentity = z.infer<typeof SessionIdentitySchema>;
