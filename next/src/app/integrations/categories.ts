export type CapabilityCategory =
  | "available"
  | "manual"
  | "adapter_ready"
  | "unsupported";

export type Variant =
  | "available"
  | "manual"
  | "adapter_ready"
  | "unsupported"
  | "unknown"
  | "unavailable"
  | "not_connected";

export interface CapabilityItem {
  id: string;
  name: string;
  status: string;
  variant: Variant;
  category: CapabilityCategory;
  details: string;
  epistemicNote: string;
  cta?: {
    label: string;
    href: string;
    icon: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
    icon: string;
  };
}

export interface CategoryGroup {
  id: CapabilityCategory;
  title: string;
  badge: string;
  description: string;
  items: CapabilityItem[];
}

export const CATEGORIES: CategoryGroup[] = [
  {
    id: "available",
    title: "Available Today: Core Standalone Operations",
    badge: "Core Operational Loop",
    description:
      "Core live commerce capabilities that operate completely standalone today with zero third-party platform dependencies.",
    items: [
      {
        id: "manual_desk",
        name: "Manual Operation Desk",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "The entire live commerce lifecycle — Prepare, Operate, Review, and Next LIVE — runs with zero external integrations. REAL shows synchronize safely through the shared studio room, while rehearsals run in this browser with zero external network dependencies.",
        epistemicNote:
          "100% operational autonomy: zero external platform dependency during live broadcasts.",
        cta: {
          label: "Plan New LIVE",
          href: "/live/new",
          icon: "ri-add-circle-line",
        },
        secondaryCta: {
          label: "View Sessions",
          href: "/sessions",
          icon: "ri-stack-line",
        },
      },
      {
        id: "simulator",
        name: "Local Rehearsal Simulator & Virtual Clock",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "Deterministic offline rehearsal environment powered by a manual virtual clock and realistic scripted scenarios. Host and operator practice overruns, buffer collapses, and recovery maneuvers without risking live audience or seller account standing.",
        epistemicNote:
          "SIMULATED partition strictly isolated from REAL data: virtual clock advances only on command.",
        cta: {
          label: "Launch Simulator",
          href: "/simulator",
          icon: "ri-flask-line",
        },
      },
      {
        id: "room_authority",
        name: "Multi-Client Room Authority",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "Real-time synchronized studio room authority with optimistic concurrency, room revision tracking, and durable cryptographically logged commands. Multiple studio operators collaborate simultaneously with guaranteed conflict detection.",
        epistemicNote:
          "Append-only event ledger: state changes create durable receipts; history is never silently rewritten.",
        cta: {
          label: "Room Sessions",
          href: "/sessions",
          icon: "ri-team-line",
        },
      },
      {
        id: "variance_analysis",
        name: "Variance Analysis & Learning Feedback",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "Post-broadcast dual knowledge lens ('As Known Then' vs 'With Later Evidence'). Derives actionable Run of Show timeline adjustments for subsequent shows from executed reality, while cloning clean, uncoupled session drafts.",
        epistemicNote:
          "Proposals preserve full historical context without polluting fresh session plans.",
        cta: {
          label: "Review Past Shows",
          href: "/sessions",
          icon: "ri-history-line",
        },
      },
    ],
  },
  {
    id: "manual",
    title: "Manual / Built-In: Native Operator Workflows",
    badge: "First-Class Operator Workflows",
    description:
      "First-class native operator workflows built directly into LiveLift that eliminate reliance on opaque platform APIs.",
    items: [
      {
        id: "catalog_import",
        name: "Manual Product & Catalog Ingestion",
        status: "Manual",
        variant: "manual",
        category: "manual",
        details:
          "Add products by hand, select from pre-packaged sample libraries, or batch-import via CSV/TSV copy-paste. Strict validation preserves unentered prices as null ('Not entered', never fabricated as zero) and enforces product code uniqueness without requiring external catalog sync.",
        epistemicNote:
          "Missing != Zero: Omitted prices and metrics are preserved as null, never falsified as zero.",
        cta: {
          label: "Product Library",
          href: "/products",
          icon: "ri-shopping-bag-3-line",
        },
      },
      {
        id: "cue_reporting",
        name: "Manual Operator Cue & Promotion Reporting",
        status: "Manual",
        variant: "manual",
        category: "manual",
        details:
          "Rapid operator-reported tracking of presenter pins, flash sales, voucher drops, and verbal cues directly from the flight desk while operating TikTok natively. Operates cleanly with zero background scrapers or fragile bots.",
        epistemicNote:
          "Operator reported != Provider observed: Human assertion logged with actor and timestamp.",
        cta: {
          label: "Rehearse Cue Reporting",
          href: "/simulator",
          icon: "ri-hand-heart-line",
        },
      },
      {
        id: "anchor_protection",
        name: "Operator Pacing & Anchor Commitment Protection",
        status: "Manual",
        variant: "manual",
        category: "manual",
        details:
          "Human-in-the-loop drift estimation and buffer management. Overruns surface clean recovery options (shorten pending segments, drop optional segments, re-anchor) and require explicit operator acknowledgement for commitment modifications.",
        epistemicNote:
          "Planned != Actual: Baseline timeline locked; modifications append explicit decisions.",
        cta: {
          label: "Explore Run of Show",
          href: "/simulator",
          icon: "ri-timer-line",
        },
      },
    ],
  },
  {
    id: "adapter_ready",
    title: "Adapter-Ready / Platform-Limited: Bounded Provider Extensions",
    badge: "Intentionally Bounded Extensions",
    description:
      "Standardized provider connectors engineered for official platform APIs, intentionally bounded by published platform limits and rate quotas.",
    items: [
      {
        id: "tiktok_analytics",
        name: "TikTok Shop Post-Stream Analytics",
        status: "Adapter-Ready",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Standardized ingestion client engineered for official TikTok Shop Open Platform Seller APIs (shop_lives/*). Intentionally bounded: TikTok Shop only provisions minute-level metrics after broadcast conclusion, requires an authorized Account Manager, and does not provide real-time comment streams.",
        epistemicNote:
          "Platform boundary: Retrospective reconciliation only; official API does not expose real-time stream.",
      },
      {
        id: "shopee_adapter",
        name: "Shopee Live Pin & Comment Adapter",
        status: "Adapter-Ready",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Standardized connector designed for official Shopee Open Platform API v2 User-level endpoints (update_show_item and get_latest_comment_list). Bounded by 10-second polling windows and platform rate-limits.",
        epistemicNote:
          "Platform boundary: Polling frequency strictly bounded by platform API quota.",
      },
      {
        id: "youtube_client",
        name: "YouTube Live Streaming Client",
        status: "Adapter-Ready",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Ingestion client for official YouTube Data API v3 live chat polling (liveChatMessages.list). Complies strictly with platform quota allocations and exponential backoff.",
        epistemicNote:
          "Platform boundary: Quota-governed polling rate; graceful degradation on quota exhaustion.",
      },
      {
        id: "facebook_adapter",
        name: "Facebook Live Graph API Adapter",
        status: "Adapter-Ready",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Connector for official Meta Graph API polling (live video comments on owned Pages) using chronological cursor resumption and strict permission scopes.",
        epistemicNote:
          "Platform boundary: Limited to owned Page broadcasts with authorized Page access token.",
      },
      {
        id: "workspace_export",
        name: "Workspace Data Export & Audit Portability",
        status: "Available",
        variant: "available",
        category: "adapter_ready",
        details:
          "Full structured JSON export of session snapshots, Run of Show plans, command receipts, and audit trails via /api/v3/workspace/export for downstream merchant analytics and BI pipelines.",
        epistemicNote:
          "Merchant data sovereignty: Complete export anytime without vendor lock-in.",
        cta: {
          label: "Export Workspace",
          href: "/sessions",
          icon: "ri-download-2-line",
        },
      },
      {
        id: "platform_verification",
        name: "Independent Platform Action Verification",
        status: "Unknown",
        variant: "unknown",
        category: "adapter_ready",
        details:
          "Grounded in truth: operator reports are the operator's word. Without an independent, cryptographically verified platform callback channel, platform verification stays Unknown — not failed, not confirmed.",
        epistemicNote:
          "Unknown != Failed: Missing telemetry is neutral; never marked with a false failure badge.",
      },
    ],
  },
  {
    id: "unsupported",
    title: "Not Available / Unsupported: Deliberate Platform Boundaries",
    badge: "Deliberate Platform Guardrails",
    description:
      "Capabilities deliberately unsupported to protect merchant seller accounts, respect terms of service, and uphold legal privacy standards.",
    items: [
      {
        id: "direct_action_control",
        name: "Direct Platform Pin / Action Control",
        status: "Unsupported",
        variant: "unsupported",
        category: "unsupported",
        details:
          "LiveLift never programmatically pins, unpins, or triggers promotions inside TikTok Shop. Autonomous bot actions violate platform Terms of Service, jeopardize merchant account safety, and remove essential human operator discretion. The operator executes actions in TikTok directly and logs them in LiveLift.",
        epistemicNote:
          "Safety guardrail: Zero automated platform tampering or unauthorized bot control.",
      },
      {
        id: "headless_scraping",
        name: "Realtime Headless Stream Engagement Scraping",
        status: "Unavailable",
        variant: "unavailable",
        category: "unsupported",
        details:
          "No reverse-engineered WebSocket or headless stream scraping is connected. Unauthorized scraping violates platform Terms of Service, introduces fragile failure points, and breaches merchant compliance regulations (Law 91/2025/QH15 & Decree 356/2025/NĐ-CP).",
        epistemicNote:
          "Compliance guardrail: Official developer APIs only; zero unauthorized scraping.",
      },
      {
        id: "automated_metric_import",
        name: "Automated Post-LIVE Platform Metric Import",
        status: "Not connected",
        variant: "not_connected",
        category: "unsupported",
        details:
          "Platform figures remain inside TikTok Seller Center. Nothing here is imported, so no metric is shown — an unmeasured figure is never fabricated as zero or defaulted to zero.",
        epistemicNote:
          "Missing != Zero: No fabricated zeroes or placeholder telemetry.",
      },
    ],
  },
];
