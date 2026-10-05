import { z } from "zod";

export const CapabilityStatusSchema = z.enum([
  "available",
  "delayed",
  "unavailable",
  "unknown",
  "stale",
]);
export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>;

export const CapabilityItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: CapabilityStatusSchema,
  detail: z.string().optional(),
  lastUpdated: z.string().optional(),
});
export type CapabilityItem = z.infer<typeof CapabilityItemSchema>;

export const OperatingCapabilitiesSchema = z.object({
  manualOperation: CapabilityItemSchema,
  productCatalog: CapabilityItemSchema,
  postLiveAnalytics: CapabilityItemSchema,
  realtimeEngagement: CapabilityItemSchema,
  productActionControl: CapabilityItemSchema,
  actionVerification: CapabilityItemSchema,
});
export type OperatingCapabilities = z.infer<typeof OperatingCapabilitiesSchema>;
