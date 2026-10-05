import type { ProductSnapshot } from "@/contracts";

/**
 * Basic validated product import. Rows are "code, name, price" separated by tabs or commas.
 * - A missing price is `null` ("Not entered"), never 0.
 * - A duplicate code never overwrites the existing product; it is reported and skipped.
 */

export interface ImportRow {
  line: number;
  raw: string;
  code: string;
  name: string;
  price: number | null;
  currency: string;
  status: "valid" | "duplicate" | "invalid";
  reason: string | null;
}

const MISSING_PRICE = new Set(["", "-", "—", "–", "n/a", "na", "none", "null"]);

function parsePrice(token: string): { price: number | null; currency: string; ok: boolean } {
  const t = token.trim();
  if (MISSING_PRICE.has(t.toLowerCase())) return { price: null, currency: "USD", ok: true };
  const m = /^([A-Za-z]{3})?\s*([0-9]+(?:[.,][0-9]+)?)\s*([A-Za-z]{3})?$/.exec(t);
  if (!m) return { price: null, currency: "USD", ok: false };
  const value = Number(m[2].replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return { price: null, currency: "USD", ok: false };
  return { price: value, currency: (m[1] ?? m[3] ?? "USD").toUpperCase(), ok: true };
}

export function parseProductRows(text: string, existingCodes: string[]): ImportRow[] {
  const seen = new Set(existingCodes.map((c) => c.trim().toLowerCase()));
  const rows: ImportRow[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === "") return;
    const cells = (raw.includes("\t") ? raw.split("\t") : raw.split(",")).map((c) => c.trim());
    const [code = "", name = "", priceToken = ""] = cells;
    const base = { line: i + 1, raw, code, name, price: null as number | null, currency: "USD" };

    if (code === "" || name === "") {
      rows.push({ ...base, status: "invalid", reason: "A code and a name are required." });
      return;
    }
    const price = parsePrice(priceToken);
    if (!price.ok) {
      rows.push({ ...base, status: "invalid", reason: `Price "${priceToken}" is not a number.` });
      return;
    }
    if (seen.has(code.toLowerCase())) {
      rows.push({ ...base, price: price.price, currency: price.currency, status: "duplicate", reason: "That code already exists; the existing product is unchanged." });
      return;
    }
    seen.add(code.toLowerCase());
    rows.push({ ...base, price: price.price, currency: price.currency, status: "valid", reason: null });
  });
  return rows;
}

function initialsOf(name: string, code: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0]).join("");
  return (letters || code.slice(0, 2)).toUpperCase();
}

/** Snapshots for the valid rows. IDs derive from the code, so importing twice cannot duplicate. */
export function toProductSnapshots(rows: ImportRow[], asOf: string): ProductSnapshot[] {
  return rows
    .filter((r) => r.status === "valid")
    .map((r) => ({
      id: `prod_${r.code.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      code: r.code,
      name: r.name,
      price: r.price,
      currency: r.currency,
      priority: "normal" as const,
      status: "enabled" as const,
      notes: "Imported by operator",
      talkingPoints: [],
      constraints: [],
      initials: initialsOf(r.name, r.code),
      asOf,
    }));
}
