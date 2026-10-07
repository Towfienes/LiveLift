import type { Review } from "@/lib/domain";
import type { MetricKey, MinuteEvidenceBucket, TimeWindow } from "./types";

/**
 * Where provider minutes meet the recorded show. Everything here is geometry over two things LiveLift already
 * has: the segment windows the operator's commands recorded (the Review rows) and the provider's minute grid.
 * It decides nothing about which segment "owns" a minute: a minute that overlaps two segments stays unassigned.
 */

export interface RecordedWindow extends TimeWindow {
  segmentId: string;
  title: string;
  kind: string;
  productId: string | null;
  plannedSec: number | null;
  actualSec: number;
  varianceSec: number | null;
  overran: boolean;
  underran: boolean;
}

/** The segments that have a complete recorded interval, in the order they started. Skipped or incomplete ones have none. */
export function recordedWindows(review: Review): RecordedWindow[] {
  const out: RecordedWindow[] = [];
  for (const r of review.rows) {
    if (!r.actual) continue;
    out.push({
      segmentId: r.segmentId,
      title: r.title,
      kind: r.kind,
      productId: r.productId,
      startMs: r.actual.startMs,
      endMs: r.actual.endMs,
      plannedSec: r.baseline?.durSec ?? null,
      actualSec: r.actual.durSec,
      varianceSec: r.durationVarianceSec,
      overran: r.overran,
      underran: r.underran,
    });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

export const overlaps = (a: TimeWindow, b: TimeWindow): boolean => a.startMs < b.endMs && b.startMs < a.endMs;
export const isInside = (inner: TimeWindow, outer: TimeWindow): boolean => inner.startMs >= outer.startMs && inner.endMs <= outer.endMs;

/** Provider minutes lying entirely inside a window. Only these can be attributed to it without a judgement call. */
export const bucketsInside = (buckets: MinuteEvidenceBucket[], w: TimeWindow): MinuteEvidenceBucket[] => buckets.filter((b) => isInside(b, w));

/** Start times of provider minutes that overlap two or more recorded windows, plus any the server marked ambiguous. */
export function boundaryStarts(buckets: MinuteEvidenceBucket[], windows: TimeWindow[], serverMarked: Iterable<number> = []): Set<number> {
  const out = new Set<number>(serverMarked);
  for (const b of buckets) {
    let hits = 0;
    for (const w of windows) if (overlaps(b, w)) hits += 1;
    if (hits >= 2) out.add(b.startMs);
  }
  return out;
}

export interface SeriesStat {
  key: MetricKey;
  recorded: number;
  zero: number;
  missing: number;
  max: number | null;
  maxAtMs: number | null;
  /** Sum of the recorded minutes. null when none was recorded: a sum of nothing is not zero. */
  sum: number | null;
  state: "values" | "all_zero" | "all_missing";
}

export function seriesStat(buckets: MinuteEvidenceBucket[], key: MetricKey): SeriesStat {
  let recorded = 0;
  let zero = 0;
  let sum = 0;
  let max: number | null = null;
  let maxAtMs: number | null = null;
  for (const b of buckets) {
    const v = b[key];
    if (v === null) continue;
    recorded += 1;
    if (v === 0) zero += 1;
    sum += v;
    if (max === null || v > max) {
      max = v;
      maxAtMs = b.startMs;
    }
  }
  const missing = buckets.length - recorded;
  return {
    key,
    recorded,
    zero,
    missing,
    max,
    maxAtMs,
    sum: recorded === 0 ? null : sum,
    state: recorded === 0 ? "all_missing" : zero === recorded ? "all_zero" : "values",
  };
}

export const MINUTE_MS = 60_000;
