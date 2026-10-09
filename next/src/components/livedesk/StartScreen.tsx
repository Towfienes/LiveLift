"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentLive, useStartFlow } from "@/lib/livedesk/hooks";
import type { DeskProduct } from "@/lib/livedesk/types";
import { IconCheck, IconLink, IconUpload } from "./icons";
import { tImportNote, tStartBlocked } from "./i18n";
import { Shell, useShell } from "./Shell";
import { Button, SimTag } from "./ui";

type StepState = "todo" | "active" | "done";

/**
 * Start: a navy progress column that says where the live stands, beside one work surface that holds only the step in
 * progress. Start live sits at the foot of the surface at every step, with what is still missing beside it.
 */

function ProgressStep({ n, title, state, status }: { n: number; title: string; state: StepState; status: string }) {
  const { c } = useShell();
  return (
    <li className={`prep-step is-${state}`} aria-current={state === "active" ? "step" : undefined}>
      <span className="prep-mark" aria-hidden="true">{state === "done" ? <IconCheck size={16} /> : n}</span>
      <span className="prep-text">
        <span className="prep-title"><span className="sr-only">{c.stepWord} {n}: </span>{title}<span className="sr-only">, {state === "done" ? c.stepDone : state === "active" ? c.stepActive : c.stepTodo}</span></span>
        <span className="prep-status">{status}</span>
      </span>
    </li>
  );
}

function ProductTable({ products, onRemove, locked }: { products: DeskProduct[]; onRemove: (id: string) => void; locked: boolean }) {
  const { c } = useShell();
  return (
    <table className="ptable" data-testid="start-products">
      <caption className="sr-only">{c.tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{c.colProduct}</th>
          <th scope="col" className="r">{c.colPrice}</th>
          <th scope="col" className="r">{c.colStock}</th>
          <th scope="col">{c.colStatus} <SimTag quiet>SIMULATED</SimTag></th>
          <th scope="col"><span className="sr-only">{c.colAction}</span></th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id} className={`prow is-${p.sync.state}`} data-testid={`desk-product-${p.id}`}>
            <th scope="row">
              {p.name}
              {p.sync.detail !== null && <span className="sync-detail">{c.platformSaid}: <code>{p.sync.detail}</code></span>}
            </th>
            <td className="r num" data-label={c.colPrice}>{p.priceLabel ?? <span className="missing">{c.missing}</span>}</td>
            <td className="r num" data-label={c.colStock}>{p.stock ?? <span className="missing">{c.missing}</span>}</td>
            <td>
              <span className={`status is-${p.sync.state}`}>
                {p.sync.state === "synced" && <IconCheck size={16} />}
                {c.sync[p.sync.state]}
              </span>
            </td>
            <td className="r">
              <Button size="sm" variant="quiet" aria-label={`${c.remove} ${p.name}`} onClick={() => onRemove(p.id)} disabled={locked}>{c.remove}</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** First import: the sample pack is the one primary action until the operator types a list of their own. */
function ImportForm({ connected, first }: { connected: boolean; first: boolean }) {
  const { c } = useShell();
  const { actions } = useStartFlow();
  const [text, setText] = useState("");
  const typed = text.trim() !== "";
  const reason = !connected ? c.connectFirst : !typed ? c.pasteFirst : null;
  const sample = (
    <Button variant={first && !typed ? "primary" : "secondary"} size="lg" disabled={!connected} onClick={() => actions.onImportSamplePack()} data-testid="start-sample">
      {c.sampleBtn}
    </Button>
  );
  return (
    <div className="import-form">
      {first && <div className="import-sample">{sample}<p className="import-or">{c.orPaste}</p></div>}
      <div className="field">
        <label className="field-label" htmlFor="product-paste">{c.paste}</label>
        <span className="field-hint" id="paste-hint">{c.pasteHint}</span>
        <textarea id="product-paste" rows={5} value={text} spellCheck={false} disabled={!connected} aria-describedby="paste-hint import-reason"
          placeholder={"HD-01, Áo hoodie zip, 199000 VND, 24\nCT-03, Túi vải tote, , "} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row">
        <Button variant={typed ? "primary" : "secondary"} size="lg" icon={<IconUpload />} disabled={reason !== null}
          onClick={() => actions.onImportText(text)} aria-describedby="import-reason" data-testid="start-import">{c.importBtn}</Button>
        {!first && sample}
      </div>
      <p id="import-reason" className="step-note">{reason}</p>
    </div>
  );
}

function StartBody() {
  const { c, lang } = useShell();
  const { view, actions } = useStartFlow();
  const live = useCurrentLive();
  const router = useRouter();
  const [startFailed, setStartFailed] = useState(false);
  const synced = view.products.filter((p) => p.sync.state === "synced").length;
  const missing = view.products.filter((p) => p.priceLabel === null || p.stock === null);
  const running = live?.mode === "live";
  const step1: StepState = view.connected ? "done" : "active";
  const step2: StepState = !view.connected ? "todo" : synced > 0 ? "done" : "active";
  const step3: StepState = running ? "done" : view.startBlockedReason === null ? "active" : "todo";
  const blocked = tStartBlocked(view.startBlockedReason, lang);
  const note = tImportNote(view.importNote, lang);
  const start = (): void => {
    const id = actions.onStartLive();
    setStartFailed(id === null);
    if (id !== null) router.push(`/desk/${encodeURIComponent(id)}`);
  };
  return (
    <div className="setup prep-layout" data-testid="start-flow">
      <aside className="prep" aria-labelledby="prep-h">
        <h1 id="prep-h">{c.startTitle}</h1>
        <p className="prep-lede">{c.startLede}</p>
        <ol className="prep-steps">
          <ProgressStep n={1} title={c.connectTitle} state={step1} status={view.connected ? c.connected : c.notConnected} />
          <ProgressStep n={2} title={c.productsTitle} state={step2}
            status={!view.connected ? c.connectFirst : view.products.length ? c.productsSummary(view.products.length, synced, missing.length) : c.emptyProducts} />
          <ProgressStep n={3} title={c.startLiveTitle} state={step3} status={running ? c.liveOpen : step3 === "active" ? c.readyToStart : c.stepTodo} />
        </ol>
        <div className="prep-sim">
          <SimTag>{c.stamp}</SimTag>
          <details className="prep-why">
            <summary>{c.whySim}</summary>
            <p>{c.simNote}</p>
          </details>
        </div>
      </aside>

      <section className="work" aria-labelledby="work-h">
        {!view.connected ? (
          <div className="work-step" key="connect" data-testid="start-connect-panel">
            <h2 id="work-h">{c.connectTitle}</h2>
            <p className="work-lede">{c.connectBody}</p>
            <Button variant="primary" size="lg" icon={<IconLink />} onClick={() => actions.onConnect()} data-testid="start-connect">{c.connectBtn}</Button>
          </div>
        ) : (
          <div className="work-step" key={view.products.length ? "products" : "add"} data-testid="start-import-panel">
            {view.products.length === 0 ? (
              <>
                <h2 id="work-h">{c.addProductsTitle}</h2>
                <p className="work-lede">{c.addProductsLede}</p>
                <ImportForm connected={view.connected} first />
              </>
            ) : (
              <>
                <h2 id="work-h">{c.productsTitle}</h2>
                <p className="work-lede">{c.productsSummary(view.products.length, synced, missing.length)}</p>
                <ProductTable products={view.products} onRemove={actions.onRemoveProduct} locked={running} />
                {missing.map((p) => (
                  <p key={p.id} className="note-warn">{c.missingNote(p.name, c.missingWhat(p.priceLabel === null, p.stock === null))}</p>
                ))}
                <details className="more">
                  <summary>{c.addMore}</summary>
                  <ImportForm connected={view.connected} first={false} />
                </details>
              </>
            )}
            <p role="status" className="step-note">{note}</p>
          </div>
        )}

        <div className="work-foot" data-testid="start-live-panel">
          <div className="work-foot-text">
            {view.startBlockedReason !== null ? (
              <>
                <p className="foot-label">{c.stillNeeded}</p>
                <p id="start-reason" className="foot-reason">{blocked}</p>
              </>
            ) : (
              <p id="start-reason" className="foot-reason is-ready">{c.startBody}</p>
            )}
            <p role="status" className="step-note is-warn">{startFailed ? c.startFailed : null}</p>
          </div>
          <div className="row">
            {running && live && <Link className="btn btn-secondary btn-lg" href={`/desk/${encodeURIComponent(live.id)}`}>{c.openDesk}</Link>}
            <Button variant="primary" size="lg" onClick={start} disabled={view.startBlockedReason !== null} aria-describedby="start-reason" data-testid="start-live">{c.startBtn}</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function StartScreen() {
  return (
    <Shell screen="start">
      <StartBody />
    </Shell>
  );
}
