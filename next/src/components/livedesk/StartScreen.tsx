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
            <th scope="col">{c.colStatus}</th>
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
 * A quiet technical-print panel for the empty space under the intro, in the manner of a spec sheet: faint giant words,
 * registration marks, a dotted grid, a ruler, and two die-cut stickers from a live seller's desk (a phone on air, a
 * shirt with a tag), drawn in the site's paper, kraft, ink and brick; every colour is a theme token. Words only, never numbers, so nothing reads as data. Hidden from assistive tech, static,
 * and dropped below 1024 px.
 */
function Sticker({ d, fill, sheen = "art-sheen", children }: { d: string; fill: string; sheen?: string; children?: React.ReactNode }) {
  // die-cut: a soft cut line, a margin, then the body in the site's own paper or kraft, its ink outline and a sheen
  return (
    <g>
      <path d={d} className="stk-cut" />
      <path d={d} className="stk-margin" />
      <path d={d} fill={fill} className="stk-ink" />
      <path d={d} fill={`url(#${sheen})`} />
      {children}
    </g>
  );
}

function StartArt() {
  return (
    <div className="start-art" aria-hidden="true">
      <svg viewBox="0 0 440 320" focusable="false">
        <defs>
          <linearGradient id="art-paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="stop-paper-a" />
            <stop offset="1" className="stop-paper-b" />
          </linearGradient>
          <linearGradient id="art-kraft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="stop-kraft-a" />
            <stop offset="1" className="stop-kraft-b" />
          </linearGradient>
          <linearGradient id="art-sheen" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0.2" className="stop-sheen" stopOpacity="0" />
            <stop offset="0.32" className="stop-sheen" stopOpacity="0.5" />
            <stop offset="0.44" className="stop-sheen" stopOpacity="0" />
          </linearGradient>
          <pattern id="art-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" className="art-dot" /></pattern>
        </defs>

        <text x="0" y="96" className="art-giant">LIVE</text>
        <text x="236" y="262" className="art-giant">PIN</text>

        <g className="art-reg"><circle cx="12" cy="14" r="6" /><path d="M12 4v20M2 14h20" /></g>
        <g className="art-reg"><circle cx="424" cy="300" r="6" /><path d="M424 290v20M414 300h20" /></g>
        <text x="30" y="12" className="art-label">INSTRUCTIONS</text>
        <text x="30" y="26" className="art-label is-big">PREPARE THE SHOW</text>
        <text x="30" y="38" className="art-label is-big">PIN WHAT SELLS</text>
        <g className="art-chips">{["L", "I", "V", "E"].map((ch, i) => (<g key={ch} transform={`translate(${352 + i * 21} 12)`}><circle r="8" /><text y="3.5">{ch}</text></g>))}</g>
        <rect x="380" y="34" width="54" height="36" fill="url(#art-dots)" />
        <g className="art-pill"><rect x="300" y="86" width="64" height="18" rx="9" /><text x="332" y="98.5">ON AIR</text></g>
        <text x="226" y="312" className="art-label">LIVELIFT · LIVE DESK</text>

        {/* a phone on air */}
        <g transform="translate(58 112) rotate(-8 60 96)">
          <Sticker fill="url(#art-paper)" d="M22 0h76a22 22 0 0 1 22 22v148a22 22 0 0 1 -22 22h-76a22 22 0 0 1 -22 -22v-148a22 22 0 0 1 22 -22z">
            <rect x="12" y="20" width="96" height="150" rx="12" className="stk-screen" />
            <rect x="46" y="8" width="28" height="6" rx="3" className="stk-line-fill" />
            <g transform="translate(22 32)"><rect width="38" height="16" rx="8" className="stk-live" /><circle cx="9" cy="8" r="3" className="stk-live-dot" /><text x="24" y="11.5" className="stk-live-text">LIVE</text></g>
            <path d="M74 126c0-6 8-9 11-3 3-6 11-3 11 3 0 7-11 13-11 13s-11-6-11-13z" className="stk-heart" />
            <path d="M84 104c0-4 5-6 7-2 2-4 7-2 7 2 0 4-7 8-7 8s-7-4-7-8z" className="stk-heart is-small" />
            <path d="M24 148h44M24 158h30" className="stk-line" />
          </Sticker>
        </g>

        {/* a shirt with a blank swing tag */}
        <g transform="translate(236 118) rotate(8 80 80)">
          <Sticker fill="url(#art-kraft)" d="M56 18q24 18 48 0l46 22-14 36-22-9v76h-68v-76l-22 9-14-36z">
            <path d="M56 18q24 18 48 0" className="stk-line" fill="none" />
            <path d="M58 70v70M102 70v70" className="stk-line is-soft" />
            <g transform="translate(108 92) rotate(14)"><path d="M0 6l6-6h18v28h-24z" className="stk-tag" /><circle cx="6" cy="7" r="2" className="stk-line-fill" /></g>
          </Sticker>
        </g>

        <g className="art-ruler"><path d="M226 294H430" />{Array.from({ length: 21 }, (_, i) => (<path key={i} d={`M${226 + i * 10} 294v${i % 5 === 0 ? -8 : -4}`} />))}<path d="M332 278l6 8 6-8z" className="art-mark" /></g>
      </svg>
    </div>
  );
}

/** The three steps as a sticky run-of-show rail in the left margin of a wide screen; each mark jumps to its step. */
function RunOfShow({ steps }: { steps: { n: number; title: string; state: StepState }[] }) {
  const { c } = useShell();
  return (
    <nav className="ros" aria-label={c.rosLabel} data-testid="start-ros">
      <div className="ros-inner">
        <span className="ros-reg" aria-hidden="true" />
        <span className="ros-hint" aria-hidden="true">{c.rosHint}</span>
        <ol className="ros-line">
          {steps.map(({ n, title, state }) => (
            <li key={n}>
              <a href={`#start-step-${n}`} className={`ros-n is-${state}`} aria-current={state === "active" ? "step" : undefined}
                aria-label={`${c.stepWord} ${n}: ${title}, ${state === "done" ? c.stepDone : state === "active" ? c.stepActive : c.stepTodo}`}>
                <span className="ros-box" aria-hidden="true">{state === "done" ? <IconCheck size={14} /> : n}</span>
                <span className="ros-name" aria-hidden="true">{title}</span>
              </a>
            </li>
          ))}
        </ol>
        <span className="ros-reg" aria-hidden="true" />
      </div>
    </nav>
  );
}

/** What the next screen looks like, drawn as a spec-sheet figure: three blank columns, no numbers, so nothing reads as data. */
function DeskPreview() {
  const { c } = useShell();
  const [products, suggestion, comments] = c.previewCols;
  return (
    <figure className="preview" data-testid="start-preview">
      <div className="preview-sheet" aria-hidden="true">
        <span className="preview-kicker">{c.previewKicker}</span>
        <div className="preview-desk">
          <div className="pv-col">
            <span className="pv-label">{products}</span>
            <span className="pv-card"><i /><i className="is-short" /></span>
            <span className="pv-row" /><span className="pv-row" /><span className="pv-row is-short" />
          </div>
          <div className="pv-col">
            <span className="pv-label">{suggestion}</span>
            <span className="pv-title" /><span className="pv-row" /><span className="pv-row is-short" />
            <span className="pv-pin" />
          </div>
          <div className="pv-col">
            <span className="pv-label">{comments}</span>
            <span className="pv-chips"><i /><i /><i /></span>
            <span className="pv-row" /><span className="pv-row is-short" /><span className="pv-row" />
          </div>
        </div>
        <span className="preview-ruler" />
      </div>
      <figcaption>{c.previewCaption}</figcaption>
    </figure>
  );
}

/** A ring light, the third sticker from the seller's desk, stuck in the right margin of a wide screen. Decorative. */
function RingLight() {
  const leds = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);
  return (
    <div className="start-ring" aria-hidden="true">
      <svg viewBox="0 0 160 220" focusable="false">
        <defs>
          <linearGradient id="ring-paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="stop-paper-a" />
            <stop offset="1" className="stop-paper-b" />
          </linearGradient>
          <linearGradient id="ring-kraft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="stop-kraft-a" />
            <stop offset="1" className="stop-kraft-b" />
          </linearGradient>
          <linearGradient id="ring-sheen" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0.2" className="stop-sheen" stopOpacity="0" />
            <stop offset="0.32" className="stop-sheen" stopOpacity="0.5" />
            <stop offset="0.44" className="stop-sheen" stopOpacity="0" />
          </linearGradient>
        </defs>
        <Sticker fill="url(#ring-paper)" sheen="ring-sheen"
          d="M80 12a68 68 0 1 1 0 136a68 68 0 1 1 0 -136zM74 140h12v56h-12zM50 194h60a7 7 0 0 1 0 14h-60a7 7 0 0 1 0 -14z">
          <circle cx="80" cy="80" r="56" fill="none" stroke="url(#ring-kraft)" strokeWidth="20" />
          <circle cx="80" cy="80" r="66" className="stk-line is-thin" fill="none" />
          <circle cx="80" cy="80" r="46" className="stk-screen" />
          <g className="stk-leds">{leds.map((a) => <path key={a} d="M80 28v-4" transform={`rotate(${a} 80 80)`} />)}</g>
          <rect x="66" y="56" width="28" height="48" rx="5" className="stk-tag" />
          <circle cx="80" cy="62" r="2.4" className="stk-live-dot" />
          <path d="M74 98h12" className="stk-line is-thin" />
        </Sticker>
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
  const stepList = [
    { n: 1, title: c.connectTitle, state: step1 },
    { n: 2, title: c.productsTitle, state: step2 },
    { n: 3, title: c.startLiveTitle, state: step3 },
  ];
  return (
    <div className="setup" data-testid="start-flow">
      <RunOfShow steps={stepList} />
      <RingLight />
      <div className="setup-intro">
        <h1 className="start-title">{c.startTitleLead} <span className="tape-mark">{c.startTitleMark}</span></h1>
        <p className="lede">{c.startLede}</p>
        <div className="sim-note">
          <SimTag>{c.stamp}</SimTag>
          <p>{c.simNote}</p>
        </div>
        <StartArt />
      </div>
      <div className="setup-main">
        <ol className="steps">
          <li id="start-step-1" className={`step is-${step1}`} data-testid="start-connect-panel">
            <StepHead n={1} title={c.connectTitle} state={step1} summary={view.connected ? c.connected : null} />
            <div className="step-body">
              {!view.connected && <p>{c.connectBody}</p>}
              {!view.connected && (
                <Button variant="primary" size="lg" icon={<IconLink />} onClick={() => actions.onConnect()} data-testid="start-connect">{c.connectBtn}</Button>
              )}
            </div>
          </li>
          <li id="start-step-2" className={`step is-${step2}`} data-testid="start-import-panel">
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
          <li id="start-step-3" className={`step is-${step3}`} data-testid="start-live-panel">
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
        <DeskPreview />
      </div>
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
