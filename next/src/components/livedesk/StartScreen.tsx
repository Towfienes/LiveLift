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

function StepHead({ n, title, state, summary }: { n: number; title: string; state: StepState; summary?: string | null }) {
  const { c } = useShell();
  return (
    <div className="step-head">
      <span className={`step-n is-${state}`} aria-hidden="true">{state === "done" ? <IconCheck size={18} /> : n}</span>
      <h2><span className="sr-only">{c.stepWord} {n}: </span>{title}<span className="sr-only">, {state === "done" ? c.stepDone : state === "active" ? c.stepActive : c.stepTodo}</span></h2>
      {summary && <p className="step-summary">{summary}</p>}
    </div>
  );
}

function ProductTable({ products, onRemove, locked }: { products: DeskProduct[]; onRemove: (id: string) => void; locked: boolean }) {
  const { c } = useShell();
  // A long list scrolls inside its own box, so Start live stays in reach; the header row stays on top while it scrolls.
  return (
    <div className="ptable-scroll" tabIndex={0} role="region" aria-label={c.tableCaption}>
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
    </div>
  );
}

function ImportForm({ connected }: { connected: boolean }) {
  const { c } = useShell();
  const { actions } = useStartFlow();
  const [text, setText] = useState("");
  const reason = !connected ? c.connectFirst : !text.trim() ? c.pasteFirst : null;
  return (
    <div className="import-form">
      <label className="field" htmlFor="product-paste">
        <span className="field-label">{c.paste}</span>
        <textarea id="product-paste" rows={5} value={text} spellCheck={false} disabled={!connected} aria-describedby="import-reason"
          placeholder={"HD-01, Áo hoodie zip, 199000 VND, 24\nCT-03, Túi vải tote, , "} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="row">
        <Button variant={text.trim() ? "primary" : "secondary"} size="lg" icon={<IconUpload />} disabled={reason !== null}
          onClick={() => actions.onImportText(text)} aria-describedby="import-reason" data-testid="start-import">{c.importBtn}</Button>
        <Button variant="secondary" size="lg" disabled={!connected} onClick={() => actions.onImportSamplePack()} data-testid="start-sample">{c.sampleBtn}</Button>
      </div>
      <p id="import-reason" className="step-note">{reason}</p>
    </div>
  );
}

/**
 * A quiet technical-print panel for the empty space under the intro: registration marks, a dotted grid, a tick ruler,
 * two blank taped cards and one ink-outlined iridescent sticker. Words only, never numbers, so nothing reads as data.
 * Hidden from assistive tech, static, and dropped below 1024 px.
 */
function StartArt() {
  return (
    <div className="start-art" aria-hidden="true">
      <svg viewBox="0 0 420 300" focusable="false">
        <defs>
          <linearGradient id="start-iri" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6d4e6" />
            <stop offset="0.35" stopColor="#cfe3f6" />
            <stop offset="0.65" stopColor="#d8f1df" />
            <stop offset="1" stopColor="#f8e6b2" />
          </linearGradient>
          <pattern id="start-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" className="art-dot" /></pattern>
        </defs>
        <g className="art-reg"><circle cx="18" cy="18" r="7" /><path d="M18 6v24M6 18h24" /></g>
        <g className="art-reg"><circle cx="400" cy="200" r="7" /><path d="M400 188v24M388 200h24" /></g>
        <rect x="300" y="14" width="96" height="56" fill="url(#start-dots)" />
        <text x="44" y="22" className="art-label">RUN OF SHOW</text>
        <text x="44" y="34" className="art-label is-soft">SIMULATED PREP</text>
        <g className="art-chips">{["L", "I", "V", "E"].map((ch, i) => (<g key={ch} transform={`translate(${178 + i * 22} 16)`}><circle r="8" /><text y="3.5">{ch}</text></g>))}</g>
        <g transform="rotate(-5 120 170)"><rect x="40" y="110" width="150" height="104" className="art-card" /><rect x="58" y="132" width="70" height="7" className="art-line" /><rect x="58" y="148" width="104" height="5" className="art-line is-soft" /><rect x="58" y="160" width="84" height="5" className="art-line is-soft" /><rect x="92" y="100" width="56" height="16" className="art-tape" transform="rotate(3 120 108)" /></g>
        <g transform="rotate(4 250 190)"><rect x="180" y="134" width="150" height="104" className="art-card" /><rect x="198" y="156" width="62" height="7" className="art-line" /><rect x="198" y="172" width="104" height="5" className="art-line is-soft" /><rect x="198" y="184" width="70" height="5" className="art-line is-soft" /><rect x="230" y="124" width="56" height="16" className="art-tape" transform="rotate(-4 258 132)" /></g>
        <g transform="rotate(-10 336 112)" className="art-sticker"><path d="M306 92h60l-6 66h-48z" fill="url(#start-iri)" /><path d="M321 92v-8a15 15 0 0 1 30 0v8" fill="none" /><path d="M318 112c10 6 26 6 36 0" fill="none" /></g>
        <g className="art-ruler"><path d="M40 268H400" />{Array.from({ length: 37 }, (_, i) => (<path key={i} d={`M${40 + i * 10} 268v${i % 5 === 0 ? -9 : -5}`} />))}<path d="M262 252l6 8 6-8z" className="art-mark" /></g>
        <text x="40" y="288" className="art-label is-soft">PRODUCTS · TAPE · PIN</text>
      </svg>
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
  const step3: StepState = view.startBlockedReason === null ? "active" : running ? "done" : "todo";
  const blocked = tStartBlocked(view.startBlockedReason, lang);
  const note = tImportNote(view.importNote, lang);
  const start = (): void => {
    const id = actions.onStartLive();
    setStartFailed(id === null);
    if (id !== null) router.push(`/desk/${encodeURIComponent(id)}`);
  };
  return (
    <div className="setup" data-testid="start-flow">
      <div className="setup-intro">
        <h1 className="start-title">{c.startTitleLead} <span className="tape-mark">{c.startTitleMark}</span></h1>
        <p className="lede">{c.startLede}</p>
        <div className="sim-note">
          <SimTag>{c.stamp}</SimTag>
          <p>{c.simNote}</p>
        </div>
        <StartArt />
      </div>
      <ol className="steps">
        <li className={`step is-${step1}`} data-testid="start-connect-panel">
          <StepHead n={1} title={c.connectTitle} state={step1} summary={view.connected ? c.connected : null} />
          <div className="step-body">
            {!view.connected && <p>{c.connectBody}</p>}
            {!view.connected && (
              <Button variant="primary" size="lg" icon={<IconLink />} onClick={() => actions.onConnect()} data-testid="start-connect">{c.connectBtn}</Button>
            )}
          </div>
        </li>
        <li className={`step is-${step2}`} data-testid="start-import-panel">
          <StepHead n={2} title={c.productsTitle} state={step2}
            summary={view.products.length ? c.productsSummary(view.products.length, synced, missing.length) : !view.connected ? c.connectFirst : null} />
          {view.connected && (
            <div className="step-body">
              {view.products.length === 0 ? (
                <>
                  <div className="empty-inline">
                    <p className="empty-title">{c.emptyProducts}</p>
                    <p>{c.emptyProductsHelp}</p>
                  </div>
                  <ImportForm connected={view.connected} />
                </>
              ) : (
                <>
                  <ProductTable products={view.products} onRemove={actions.onRemoveProduct} locked={running} />
                  {missing.map((p) => (
                    <p key={p.id} className="note-warn">{c.missingNote(p.name, c.missingWhat(p.priceLabel === null, p.stock === null))}</p>
                  ))}
                  <details className="more">
                    <summary>{c.addMore}</summary>
                    <ImportForm connected={view.connected} />
                  </details>
                </>
              )}
              <p role="status" className="step-note">{note}</p>
            </div>
          )}
        </li>
        <li className={`step is-${step3}`} data-testid="start-live-panel">
          <StepHead n={3} title={c.startLiveTitle} state={step3} />
          <div className="step-body">
            {view.startBlockedReason === null && <p>{c.startBody}</p>}
            <div className="row">
              <Button variant="primary" size="lg" onClick={start} disabled={view.startBlockedReason !== null} aria-describedby="start-reason" data-testid="start-live">{c.startBtn}</Button>
              {running && live && <Link className="btn btn-secondary btn-lg" href={`/desk/${encodeURIComponent(live.id)}`}>{c.openDesk}</Link>}
            </div>
            <p id="start-reason" className="step-note">{blocked}</p>
            <p role="status" className="step-note is-warn">{startFailed ? c.startFailed : null}</p>
          </div>
        </li>
      </ol>
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
