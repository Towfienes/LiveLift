import type { Availability, EvidenceOrigin, MetricKey } from "./types";

/**
 * How a value is shown. The single rule: a recorded 0 is a visible "0"; a hole is words ("Not recorded"),
 * never "0", "-" or an empty bar. Words carry the state, so colour is never the only cue.
 */

export const METRIC_LABEL: Record<MetricKey, string> = {
  viewers: "Viewers",
  impressions: "Product impressions",
  clicks: "Product clicks",
  orders: "Orders",
  gmv: "GMV",
  comments: "Comment count",
  likes: "Likes",
  shares: "Shares",
};

/** Short column heads for dense tables. */
export const METRIC_SHORT: Record<MetricKey, string> = {
  viewers: "Viewers",
  impressions: "Impressions",
  clicks: "Clicks",
  orders: "Orders",
  gmv: "GMV",
  comments: "Comments",
  likes: "Likes",
  shares: "Shares",
};

export const AVAILABILITY_WORDS: Record<Exclude<Availability, "available">, string> = {
  missing: "Not recorded",
  unknown: "Unknown",
  unsupported: "Not offered by the provider",
};

export type CellState = "value" | "zero" | Exclude<Availability, "available">;

export interface CellText {
  state: CellState;
  /** What a reader sees. For a recorded value this is the formatted number. */
  text: string;
  /** Spoken form, including the unit or the reason a value is absent. */
  spoken: string;
}

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return Number.isInteger(n) ? integer.format(n) : number.format(n);
}

/** A money amount always names its currency. With no stated currency it stays a bare number, never "$". */
export function formatMoney(n: number, currency: string | null): string {
  if (!currency) return formatCount(n);
  try {
    // Intl joins the code and the amount with a no-break space; a plain space wraps and reads better in tables.
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code" })
      .formatToParts(n)
      .map((p) => (p.type === "literal" ? " " : p.value))
      .join("");
  } catch {
    return `${formatCount(n)} ${currency}`;
  }
}

/** A provider-supplied fraction as a percentage. */
export function formatRate(fraction: number): string {
  const pct = fraction * 100;
  return `${pct.toFixed(pct >= 10 ? 1 : 2).replace(/\.?0+$/, "")}%`;
}

/** value: a number is "recorded" (0 included); null is "missing" unless a more specific availability is given. */
export function cell(value: number | null, availability: Availability | null, kind: { money?: string | null; rate?: boolean; metric?: MetricKey } = {}): CellText {
  const a: Availability = availability ?? (value === null ? "missing" : "available");
  if (a !== "available" || value === null) {
    const state = a === "available" ? "missing" : a;
    return { state, text: AVAILABILITY_WORDS[state], spoken: AVAILABILITY_WORDS[state] };
  }
  const isMoney = kind.metric === "gmv" || kind.money !== undefined;
  const text = kind.rate ? formatRate(value) : isMoney ? formatMoney(value, kind.money ?? null) : formatCount(value);
  return { state: value === 0 ? "zero" : "value", text, spoken: value === 0 ? `${text}, recorded as zero` : text };
}

export const ORIGIN_LABEL: Record<EvidenceOrigin, string> = {
  provider: "Provider observed",
  fixture: "Fixture provider evidence",
};
