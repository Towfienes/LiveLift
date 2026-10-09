import React from "react";
import { Button } from "@/components/ui";
import type { DeskProduct } from "@/lib/livedesk/types";
import { deskCopy } from "./copy";

export function ProductList({ products, lang, onRemove, onPin, onUnpin, live = false }: {
  products: DeskProduct[]; lang: "en" | "vi"; live?: boolean;
  onRemove?: (id: string) => void; onPin?: (id: string) => void; onUnpin?: () => void;
}) {
  const c = deskCopy[lang];
  return (
    <>
    <ul className="divide-y divide-[var(--border-subtle)]">
      {products.map(product => (
        <li key={product.id} className="py-3 first:pt-0 last:pb-0" data-testid={`desk-product-${product.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 break-words">
              <h3 className="font-medium">{product.name}</h3>
              <p className="text-[14px] text-[var(--text-muted)]">{product.priceLabel ?? c.missing} · {c.stock}: {product.stock ?? c.missing}</p>
              <p className="text-[13px] text-[var(--simulated)]">{c[product.sync.state]}{product.showing ? ` · ${c.showing}` : ""}</p>
              {product.sync.detail !== null && <p className="text-[14px] break-all text-[var(--signal-danger)]">{product.sync.detail}</p>}
            </div>
            {onRemove && <Button size="sm" aria-label={`${c.remove} ${product.name}`} onClick={() => onRemove(product.id)}>{c.remove}</Button>}
          </div>
          {onPin && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant={product.showing ? "secondary" : "primary"} disabled={!live || product.sync.state !== "synced"}
                aria-label={`${c.pin} ${product.name}`} onClick={() => onPin(product.id)} data-testid={`desk-pin-${product.id}`}>{c.pin}</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
    {onUnpin && <Button size="sm" disabled={!live} onClick={() => onUnpin()} data-testid="desk-unpin" className="mt-3">{c.unpin}</Button>}
    </>
  );
}
