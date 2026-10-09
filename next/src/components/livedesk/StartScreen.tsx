"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { useStartFlow } from "@/lib/livedesk/hooks";
import { useLabPreferences } from "@/components/platform/lab/useLabPreferences";
import { deskCopy } from "./copy";
import { DeskFrame, DeskPanel } from "./DeskFrame";
import { ProductList } from "./ProductList";

export function StartScreen() {
  const { view, actions } = useStartFlow();
  const { lang, setLang } = useLabPreferences();
  const c = deskCopy[lang];
  const router = useRouter();
  const [text, setText] = useState("");
  const [startFailed, setStartFailed] = useState(false);
  const importReason = !view.connected ? c.connectFirst : !text.trim() ? c.pasteFirst : null;
  const start = (): void => {
    const id = actions.onStartLive();
    setStartFailed(id === null);
    if (id !== null) router.push(`/desk/${encodeURIComponent(id)}`);
  };
  return (
    <StandardShell>
      <DeskFrame title="start" lang={lang} setLang={setLang}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" data-testid="start-flow">
          <div className="space-y-4">
            <DeskPanel title={`1 · ${c.connect}`} testId="start-connect-panel">
              <p className="text-[var(--simulated)]">{view.platformLabel}</p>
              <p className="mt-1 mb-3">{view.connected ? c.connected : c.disconnected}</p>
              <Button onClick={() => actions.onConnect()} disabled={view.connected} data-testid="start-connect">{c.connect}</Button>
            </DeskPanel>
            <DeskPanel title={`2 · ${c.import}`} testId="start-import-panel">
              <label htmlFor="product-paste" className="block mb-2 font-medium">{c.paste}</label>
              <textarea id="product-paste" rows={5} value={text} onChange={event => setText(event.target.value)} disabled={!view.connected}
                aria-describedby="import-help import-reason" className="w-full min-w-0 p-3 rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono text-[14px]" />
              <p id="import-help" className="text-[14px] text-[var(--text-muted)] mt-2">{c.importHelp}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button onClick={() => actions.onImportText(text)} disabled={importReason !== null} aria-describedby="import-reason" data-testid="start-import">{c.importText}</Button>
                <Button onClick={() => actions.onImportSamplePack()} disabled={!view.connected} data-testid="start-sample">{c.sample}</Button>
              </div>
              <p id="import-reason" className="text-[14px] text-[var(--text-muted)] mt-2">{importReason}</p>
              <p role="status" className="mt-2 text-[14px]">{view.importNote}</p>
            </DeskPanel>
            <DeskPanel title={`3 · ${c.startLive}`} testId="start-live-panel">
              <Button variant="primary" onClick={start} disabled={view.startBlockedReason !== null} aria-describedby="start-reason" data-testid="start-live">{c.startLive}</Button>
              <p id="start-reason" className="mt-2 text-[var(--text-muted)]">{view.startBlockedReason}</p>
              <p role="status" className="mt-2 text-[var(--signal-warn)]">{startFailed ? c.startFailed : null}</p>
            </DeskPanel>
          </div>
          <DeskPanel title={`${c.products} · ${view.products.length}`} testId="start-products">
            <ProductList products={view.products} lang={lang} onRemove={actions.onRemoveProduct} />
          </DeskPanel>
        </div>
      </DeskFrame>
    </StandardShell>
  );
}
