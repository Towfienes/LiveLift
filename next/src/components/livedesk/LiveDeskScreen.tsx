"use client";

import React from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { useLiveDesk } from "@/lib/livedesk/hooks";
import { COMMENT_INTENTS } from "@/lib/livedesk/types";
import { useLabPreferences } from "@/components/platform/lab/useLabPreferences";
import { DeskFrame, DeskPanel } from "./DeskFrame";
import { deskCopy } from "./copy";
import { ProductList } from "./ProductList";
import { DeskChart } from "./DeskChart";
import { HostPreview } from "./HostPreview";

export function LiveDeskScreen({ liveId }: { liveId: string }) {
  const { view, actions } = useLiveDesk(liveId);
  const { lang, setLang } = useLabPreferences();
  const c = deskCopy[lang];
  const live = view?.mode === "live";
  const showingProduct = view?.products.find(product => product.id === view.showingProductId);
  return (
    <StandardShell deskLiveId={view === null ? null : liveId}>
      <DeskFrame title="desk" lang={lang} setLang={setLang}>
        {view === null ? (
          <div data-testid="desk-not-found">
            <h2 className="text-[22px]">{c.unknown}</h2><p className="mt-2">{c.unknownHelp}</p>
            <Link href="/start" className="inline-flex items-center min-h-[44px] underline text-[var(--accent-lime)]">{c.start}</Link>
          </div>
        ) : (
          <div data-testid="live-desk" data-mode={view.mode}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-[20px] font-medium break-words">{view.title}</p>
                <p className="text-[14px] text-[var(--simulated)]">{view.platformLabel} · {c[view.mode]}</p>
              </div>
              <Button variant="danger" disabled={!live} onClick={() => actions.onEndLive()} data-testid="desk-end">{c.end}</Button>
            </div>
            <div role="status" aria-atomic="true" data-testid="desk-banner" className={view.banner ? `mb-4 rounded-[8px] border p-3 ${view.banner.tone === "danger" ? "text-[var(--signal-danger)] border-[var(--signal-danger-line)] bg-[var(--signal-danger-bg)]" : view.banner.tone === "warn" ? "text-[var(--signal-warn)] border-[var(--signal-warn-line)] bg-[var(--signal-warn-bg)]" : "text-[var(--simulated)] border-[var(--simulated-line)] bg-[var(--simulated-bg)]"}` : ""}>
              {view.banner && <>SIMULATED · {view.banner.text}</>}
            </div>
            <DeskPanel title={c.clock} className="mb-4" testId="desk-clock">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-[22px] tabular-nums">{view.clock.virtualNowLabel}<span className="ml-3 text-[14px] text-[var(--text-muted)]">{c.elapsed} {view.clock.elapsedLabel}</span></p>
                <Button onClick={() => actions.onRun()} disabled={!live || view.clock.running} data-testid="desk-run">{c.run}</Button>
                <Button onClick={() => actions.onPause()} disabled={!live || !view.clock.running} data-testid="desk-pause">{c.pause}</Button>
                <label className="inline-flex items-center gap-2 text-[14px]">{c.speed}
                  <select value={view.clock.speed} onChange={event => actions.onSpeed(Number(event.target.value))} disabled={!live} data-testid="desk-speed"
                    className="min-h-[44px] rounded-[8px] bg-[var(--surface-l3)] border border-[var(--border-strong)] px-2">
                    {view.clock.speeds.map(speed => <option value={speed} key={speed}>{speed}×</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {([{ seconds: 30, label: c.skip30 }, { seconds: 60, label: c.skip60 }, { seconds: 300, label: c.skip300 }]).map(skip => <Button key={skip.seconds} size="sm" onClick={() => actions.onSkip(skip.seconds)} disabled={!live} data-testid={`desk-skip-${skip.seconds}`}>{skip.label}</Button>)}
                  <Button size="sm" onClick={() => actions.onReset()} data-testid="desk-reset">{c.reset}</Button>
                </div>
              </div>
            </DeskPanel>
            <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.5fr)_minmax(300px,1fr)]">
              <DeskPanel title={c.products} testId="desk-products">
                <ProductList products={view.products} lang={lang} live={live} onPin={actions.onPin} onUnpin={actions.onUnpin} />
                <p className="text-[13px] text-[var(--text-muted)] mt-4">{c.unpinBasis}</p>
              </DeskPanel>
              <div className="min-w-0 space-y-4">
                <DeskPanel title={c.viewers} testId="desk-viewers"><p className="text-[32px] tabular-nums">{view.viewers ?? c.noViewers}</p></DeskPanel>
                <DeskChart chart={view.charts.viewers} title={c.viewersChart} lang={lang} testId="desk-viewers-chart" />
                <DeskChart chart={view.charts.addToCart} title={showingProduct ? `${c.cartChart} · ${showingProduct.name}` : c.cartChart} lang={lang} testId="desk-cart-chart" />
                <DeskPanel title={c.comments} testId="desk-comments">
                  <h3 className="text-[14px] mb-2">{c.window}</h3>
                  <dl className="flex flex-wrap gap-2 mb-3">
                    {COMMENT_INTENTS.map(intent => <div key={intent} className="rounded-[6px] px-2 py-1 bg-[var(--surface-l3)] text-[13px]"><dt className="inline">{c[intent]}: </dt><dd className="inline tabular-nums">{view.intentCounts[intent]}</dd></div>)}
                  </dl>
                  <ul aria-live="off" aria-label={c.comments} tabIndex={0} className="max-h-[320px] overflow-y-auto space-y-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-lime)]">
                    {view.comments.map(comment => <li key={comment.id} className="text-[14px] break-words" data-testid={`desk-comment-${comment.id}`}>
                      <p><span className="font-medium text-[var(--simulated)]">{comment.user}</span> <span className="text-[12px] text-[var(--text-muted)]">{comment.atSec} s · {c[comment.intent]}{comment.piiMasked ? ` · ${c.masked}` : ""}</span></p>
                      <p>{comment.text}</p>
                    </li>)}
                  </ul>
                  {view.comments.length === 0 && <p className="text-[var(--text-muted)]">{c.noComments}</p>}
                </DeskPanel>
              </div>
              <div className="min-w-0 space-y-4">
                <DeskPanel title={c.copilot} testId="desk-copilot">
                  <p className="text-[var(--ai)] text-[14px]" data-testid="desk-ai-status">{view.copilot.statusLabel}</p>
                  <p className="text-[14px] text-[var(--text-muted)] mt-2">{c.signals}</p>
                  <p className="sr-only" role="status" aria-atomic="true">{view.copilot.suggestions.map(suggestion => `SIMULATED · ${suggestion.headline} · ${c[suggestion.state]}`).join(". ")}</p>
                  {view.copilot.suggestions.map(suggestion => <article key={suggestion.id} className="mt-4 pt-4 border-t border-[var(--border-subtle)]" data-testid={`desk-suggestion-${suggestion.id}`}>
                    <h3 className="font-medium text-[18px] break-words">{suggestion.headline}</h3>
                    <p className="mt-1 text-[13px] text-[var(--simulated)]">SIMULATED · {c.source}: {suggestion.source === "rules" ? c.rules : c.ai} · {c[suggestion.state]}</p>
                    <dl className="my-3 text-[14px] space-y-1">
                      {suggestion.signals.map((signal, index) => <div key={index}><dt className="inline text-[var(--text-muted)]">{signal.label}: </dt><dd className="inline">{signal.value}</dd></div>)}
                      <div><dt className="inline text-[var(--text-muted)]">{c.sampleSize}: </dt><dd className="inline">{suggestion.sampleSize}</dd></div>
                      <div><dt className="inline text-[var(--text-muted)]">{c.confidence}: </dt><dd className="inline">{c[suggestion.confidence]}</dd></div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="assist" size="sm" disabled={!live || suggestion.state !== "proposed"} onClick={() => actions.onAcceptSuggestion(suggestion.id)} data-testid={`desk-accept-${suggestion.id}`}>{c.accept}</Button>
                      <Button size="sm" disabled={!live || suggestion.state !== "proposed"} onClick={() => actions.onDismissSuggestion(suggestion.id)} data-testid={`desk-dismiss-${suggestion.id}`}>{c.dismiss}</Button>
                    </div>
                  </article>)}
                  {view.copilot.suggestions.length === 0 && <p className="mt-3">{c.noSuggestions}</p>}
                  <p className="mt-3 text-[13px] text-[var(--text-muted)]">{c.lifecycle}</p>
                </DeskPanel>
                <HostPreview view={view} lang={lang} />
              </div>
            </div>
            <DeskPanel title={c.assumptions} className="mt-4" testId="desk-assumptions">
              <ul className="list-disc pl-5 text-[14px] text-[var(--text-muted)] space-y-1">{view.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>
              <p className="mt-3 text-[14px]">{c.fingerprint}: <code data-testid="desk-fingerprint">{view.fingerprint ?? c.noFingerprint}</code></p>
              <details className="mt-2"><summary className="min-h-[44px] flex items-center cursor-pointer text-[var(--simulated)]">{c.wire} · SIMULATED</summary><p className="text-[14px] text-[var(--text-muted)]">{c.noWire}</p></details>
            </DeskPanel>
          </div>
        )}
      </DeskFrame>
    </StandardShell>
  );
}
