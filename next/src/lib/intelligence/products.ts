import type { ProductSnapshot } from "@/contracts";
import type { Review } from "@/lib/domain";
import type { ProductPerformance } from "./types";

/**
 * Provider product rows <-> LiveLift products. A match is only claimed on an exact identifier, or an exact name when
 * no identifier is available, and only when exactly one LiveLift product qualifies. Anything else is shown as
 * "ambiguous" or "not matched": a match is never invented.
 */

export type MatchBasis = "server" | "id" | "code" | "name";

export type ProductMatch =
  | { kind: "matched"; product: ProductSnapshot; basis: MatchBasis }
  | { kind: "ambiguous"; candidates: ProductSnapshot[]; basis: MatchBasis }
  | { kind: "unmatched" };

const norm = (s: string | null): string => (s ?? "").trim().toLowerCase();

export function matchProduct(row: ProductPerformance, products: ProductSnapshot[]): ProductMatch {
  if (row.matchedProductId) {
    const found = products.find((p) => p.id === row.matchedProductId);
    if (found) return { kind: "matched", product: found, basis: "server" };
  }
  const pid = norm(row.productId);
  if (pid !== "") {
    const byId = products.filter((p) => norm(p.id) === pid);
    if (byId.length === 1) return { kind: "matched", product: byId[0], basis: "id" };
    if (byId.length > 1) return { kind: "ambiguous", candidates: byId, basis: "id" };
    const byCode = products.filter((p) => norm(p.code) === pid);
    if (byCode.length === 1) return { kind: "matched", product: byCode[0], basis: "code" };
    if (byCode.length > 1) return { kind: "ambiguous", candidates: byCode, basis: "code" };
  }
  const label = norm(row.productLabel);
  if (label !== "" && pid === "") {
    const byName = products.filter((p) => norm(p.name) === label);
    if (byName.length === 1) return { kind: "matched", product: byName[0], basis: "name" };
    if (byName.length > 1) return { kind: "ambiguous", candidates: byName, basis: "name" };
  }
  return { kind: "unmatched" };
}

export interface ProductRowModel {
  /** Stable React key: provider ids when there are any, otherwise the row's position. */
  key: string;
  row: ProductPerformance;
  match: ProductMatch;
  /** Titles of the segments that ran this product. More than one => the provider's figure is for the whole LIVE. */
  segmentTitles: string[];
  /** How many provider rows resolve to the same LiveLift product (2+ => shown separately, never merged). */
  siblingRows: number;
}

export function buildProductRows(rows: ProductPerformance[], products: ProductSnapshot[], review: Review): ProductRowModel[] {
  const matches = rows.map((r) => matchProduct(r, products));
  const perProduct = new Map<string, number>();
  for (const m of matches) if (m.kind === "matched") perProduct.set(m.product.id, (perProduct.get(m.product.id) ?? 0) + 1);
  return rows.map((row, i) => {
    const match = matches[i];
    const segmentTitles =
      match.kind === "matched" ? review.rows.filter((r) => r.productId === match.product.id && (r.actual !== null || r.outcome === "incomplete")).map((r) => r.title) : [];
    return {
      key: [row.productId ?? "", row.skuId ?? "", i].join("|"),
      row,
      match,
      segmentTitles,
      siblingRows: match.kind === "matched" ? (perProduct.get(match.product.id) ?? 1) : 1,
    };
  });
}

export const MATCH_BASIS_WORDS: Record<MatchBasis, string> = {
  server: "mapped by the server",
  id: "matched on product id",
  code: "matched on product code",
  name: "matched on exact name",
};
