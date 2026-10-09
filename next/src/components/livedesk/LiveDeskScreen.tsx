"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeskSimulation, useLiveDesk, useLiveRecap } from "@/lib/livedesk/hooks";
import { HEALTHY_STOCK, MIN_RISING, MIN_SAMPLE } from "@/lib/livedesk/copilot";
import type {
  CommentIntent, CopilotSuggestion, DeskPlatformFault, DeskProduct, LiveDeskActions, LiveDeskViewModel, RecapViewModel,
} from "@/lib/livedesk/types";
import type { DeskCopy } from "./copy";
import { DeskChart } from "./DeskChart";
import { IconAlert, IconBolt, IconInfo, IconLock, IconPause, IconPin, IconPlay, IconShield, IconSkip, IconUnpin } from "./icons";
import { INTENT_ORDER, clock, headline, num, readSignal, tAiStatus, tAssumption, tBanner, type ReadSignal } from "./i18n";
import { Phone } from "./Phone";
import type { DeskLang } from "./prefs";
import { Sheet, useTrap } from "./Sheet";
import { JBadge, Shell, useShell } from "./Shell";
import { Button, Meter, Num, SimTag, useFlip } from "./ui";

/**
 * The Live Desk: one dominant answer, the product list with one-tap pin, one chart, the comment stream with intent
 * counters, and the SIMULATED host phone. Everything shown comes from the desk's view model; every button calls one of
 * its actions. A suggestion is never shown as a pin: dashed while proposed, the taped card only once the SIMULATED
 * platform shows the product.
 */

type Mode = "observe" | "suggest";

const SKIPS = [30, 60, 300] as const;

/** The suggestion the screen leads with: the newest proposed one of each kind. */
function proposed(view: LiveDeskViewModel, kind: CopilotSuggestion["kind"]): CopilotSuggestion | null {
  return view.copilot.suggestions.find((s) => s.kind === kind && s.state === "proposed") ?? null;
}

const productName = (view: LiveDeskViewModel, id: string): string => view.products.find((p) => p.id === id)?.name ?? id;

// ---- header pieces ----------------------------------------------------------------------------------------------

function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { c } = useShell();
  const [note, setNote] = useState(false);
  return (
    <div className="modes" role="group" aria-label={c.modesLabel}>
      <button type="button" className="mode" aria-pressed={mode === "observe"} onClick={() => setMode("observe")} data-testid="desk-mode-observe">{c.observe}</button>
      <button type="button" className="mode" aria-pressed={mode === "suggest"} onClick={() => setMode("suggest")} data-testid="desk-mode-suggest">{c.suggest}</button>
      <button type="button" className="mode is-locked" aria-disabled="true" aria-expanded={note} aria-controls="lock-note" onClick={() => setNote(!note)} data-testid="desk-mode-experiment">
        <IconLock size={16} />
        {c.experiment}
      </button>
      {note && (
        <div className="popover" id="lock-note" role="note" data-testid="desk-lock-note">
          <p className="popover-title">{c.lockTitle}</p>
          <p>{c.lockBody}</p>
          <Button size="sm" onClick={() => setNote(false)}>{c.lockOk}</Button>
        </div>
      )}
    </div>
  );
}

function LiveStatus({ view }: { view: LiveDeskViewModel }) {
  const { c, lang } = useShell();
  if (view.mode === "ended") {
    return <div className="live-status is-ended" data-testid="desk-live-status">{c.endedAt(view.clock.elapsedLabel)}</div>;
  }
  return (
    <div className="live-status" data-testid="desk-live-status">
      <span className="live-dot" aria-hidden="true" />
      <span className="live-word">{c.live}</span>
      <span className="live-time num">{view.clock.elapsedLabel}</span>
      <span className="live-sep" aria-hidden="true" />
      <span className="live-viewers" data-testid="desk-viewers">
        {view.viewers === null ? <span className="unknown">{c.unknown}</span> : <Num value={view.viewers} format={(n) => num(n, lang)} />}
        <span className="live-unit"> {c.viewersUnit}</span>
      </span>
    </div>
  );
}

// ---- products -------------------------------------------------------------------------------------------------

function ProductMeta({ p, c, lang }: { p: DeskProduct; c: DeskCopy; lang: DeskLang }) {
  if (p.sync.state !== "synced") return <p className="product-meta"><span className="missing">{c.notOnPlatform}</span></p>;
  if (p.priceLabel === null && p.stock === null) return <p className="product-meta"><span className="missing">{c.priceStockMissing}</span></p>;
  return (
    <p className="product-meta">
      {p.priceLabel === null ? <span className="missing">{c.priceMissing}</span> : <span className="num">{p.priceLabel}</span>}
      <span className="dot-sep" aria-hidden="true" />
      {p.stock === null ? <span className="missing">{c.stockMissing}</span> : <span>{c.stockLeft(num(p.stock, lang))}</span>}
    </p>
  );
}

function ProductList({ view, actions, suggested }: { view: LiveDeskViewModel; actions: LiveDeskActions; suggested: string | null }) {
  const { c, lang } = useShell();
  const live = view.mode === "live";
  const ordered = [...view.products].sort((a, b) => Number(b.showing) - Number(a.showing));
  const flip = useFlip<HTMLUListElement>(ordered.map((p) => p.id));
  return (
    <section className="panel products" aria-labelledby="products-h" data-testid="desk-products">
      <div className="panel-head">
        <h2 id="products-h">{c.products} <span className="count num">{view.products.length}</span></h2>
        <SimTag quiet>SIMULATED</SimTag>
      </div>
      <ul className="product-list" ref={flip}>
        {ordered.map((p) => (
          <li key={p.id} data-flip={p.id} className={`product${p.showing ? " is-pinned" : ""}`} data-testid={`desk-product-${p.id}`} data-showing={p.showing ? "true" : "false"}>
            <div className="product-body">
              {p.showing && <p className="pin-state"><span className="pin-word">{c.pinning}</span><SimTag quiet>SIMULATED</SimTag></p>}
              {!p.showing && suggested === p.id && <p className="pin-state is-suggested">{c.suggestedChip}</p>}
              <p className="product-name">{p.name}</p>
              <ProductMeta p={p} c={c} lang={lang} />
            </div>
            {p.showing ? (
              <Button size="sm" icon={<IconUnpin size={18} />} disabled={!live} onClick={() => actions.onUnpin()} aria-label={c.unpinAria(p.name)} data-testid="desk-unpin">{c.unpin}</Button>
            ) : (
              <Button size="sm" variant="ink" icon={<IconPin size={18} />} disabled={!live || p.sync.state !== "synced"} onClick={() => actions.onPin(p.id)}
                aria-label={c.pinAria(p.name)} data-testid={`desk-pin-${p.id}`}>{c.pin}</Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- the answer -------------------------------------------------------------------------------------------------

const BIG: Record<CopilotSuggestion["kind"], readonly string[]> = {
  show_next: ["price", "ready", "cart"],
  flash_sale: ["cart", "cartBefore", "stock"],
};

function Reasons({ signals, kind }: { signals: ReadSignal[]; kind: CopilotSuggestion["kind"] }) {
  const { c } = useShell();
  const big = BIG[kind].map((k) => signals.find((s) => s.key === k)).filter((s): s is ReadSignal => s !== undefined);
  const shown = big.length === 3 ? big : signals.slice(0, 3);
  const rest = signals.filter((s) => !shown.includes(s));
  return (
    <>
      <dl className="reasons">
        {shown.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.count !== null ? <Num value={s.count} /> : <span className={s.missing ? "missing-big" : "text-big"}>{s.text}</span>}</dd>
          </div>
        ))}
      </dl>
      {rest.length > 0 && (
        <dl className="signals-rest" aria-label={c.otherSignals}>
          {rest.map((s) => (
            <div key={s.label}><dt>{s.label}</dt><dd className={s.missing ? "missing" : undefined}>{s.count ?? s.text}</dd></div>
          ))}
        </dl>
      )}
    </>
  );
}

function ConfidenceLine({ s }: { s: CopilotSuggestion }) {
  const { c } = useShell();
  const level = c.confidence[s.confidence];
  return (
    <p className="confidence" data-testid="desk-confidence">
      <JBadge n={4} />
      <Meter level={s.confidence} label={c.confidenceLine(level)} />
      <span>
        <b>{c.confidenceLine(level)}</b>
        <span className="conf-tail">{c.confidenceTail(s.sampleSize)}</span>
        <span className="conf-source"> · {c.sourceLabel}: {c.source[s.source]}</span>
      </span>
    </p>
  );
}

function SuggestionAnswer({ s, view, actions }: { s: CopilotSuggestion; view: LiveDeskViewModel; actions: LiveDeskActions }) {
  const { c, lang } = useShell();
  const name = productName(view, s.productId);
  const low = s.confidence === "low";
  const signals = s.signals.map((x) => readSignal(x, lang));
  return (
    <div className="answer-body" key={`pin-${s.id}`} data-testid={`desk-suggestion-${s.id}`} data-state={s.state}>
      <h2 className="answer-title" data-journey="5"><JBadge n={5} />{headline(s, name, lang)}</h2>
      <p className="answer-lede">{s.source === "ai" ? c.ledeAi : low ? c.ledeLow(s.sampleSize) : c.ledeNormal}</p>
      <div className="why" data-journey="4">
        <Reasons signals={signals} kind={s.kind} />
        <ConfidenceLine s={s} />
      </div>
      <div className="answer-actions">
        <Button size="lg" variant={low ? "secondary" : "primary"} icon={<IconPin />} disabled={view.mode !== "live"} onClick={() => actions.onAcceptSuggestion(s.id)} data-testid={`desk-accept-${s.id}`}>
          {c.acceptPin(name)}
        </Button>
        <Button size="lg" variant="quiet" disabled={view.mode !== "live"} onClick={() => actions.onDismissSuggestion(s.id)} data-testid={`desk-dismiss-${s.id}`}>{c.dismiss}</Button>
        <p className="decide">{c.decide}</p>
      </div>
    </div>
  );
}

/** The last suggestion that is no longer proposed, said as what became of it. */
function LastOutcome({ view }: { view: LiveDeskViewModel }) {
  const { c, lang } = useShell();
  const s = view.copilot.suggestions.find((x) => x.kind === "show_next" && x.state !== "proposed");
  if (!s) return null;
  return (
    <p className="last-outcome" data-testid={`desk-suggestion-${s.id}`} data-state={s.state}>
      <span className="label">{c.lastOutcome} {clock(s.atSec)}</span>
      <span>{headline(s, productName(view, s.productId), lang)}: <b>{c.state[s.state]}</b></span>
    </p>
  );
}

function Answer({ view, actions, mode, recap }: { view: LiveDeskViewModel; actions: LiveDeskActions; mode: Mode; recap: RecapViewModel | null }) {
  const { c, lang } = useShell();
  const next = proposed(view, "show_next");
  const showing = view.products.find((p) => p.id === view.showingProductId) ?? null;
  const since = showing && recap ? [...recap.bands].reverse().find((b) => b.productId === showing.id)?.fromSec ?? null : null;
  const flash = proposed(view, "flash_sale");
  const announce = view.mode === "live" && mode === "suggest"
    ? [next, flash].filter((s): s is CopilotSuggestion => s !== null).map((s) => `SIMULATED. ${headline(s, productName(view, s.productId), lang)}. ${c.state[s.state]}.`).join(" ")
    : "";
  let body: React.ReactNode;
  if (view.mode === "ended") {
    body = (
      <div className="answer-body" key="ended">
        <h2 className="answer-title" data-journey="5"><JBadge n={5} />{c.endedTitle}</h2>
        <p className="answer-lede" data-journey="4"><JBadge n={4} />{c.endedLede}</p>
        <LastOutcome view={view} />
      </div>
    );
  } else if (mode === "observe") {
    body = (
      <div className="answer-body" key="observe">
        <h2 className="answer-title" data-journey="5"><JBadge n={5} />{c.observeTitle}</h2>
        <p className="answer-lede">{c.observeLede}</p>
        <div className="why" data-journey="4">
          <dl className="reasons">
            {(["ask_price", "ask_size", "ready_to_buy"] as const).map((k) => (
              <div key={k}><dt>{c.intent[k]}</dt><dd><Num value={view.intentCounts[k]} /></dd></div>
            ))}
          </dl>
          <p className="confidence"><JBadge n={4} />{c.intentsLabel}</p>
        </div>
      </div>
    );
  } else if (next) {
    body = <SuggestionAnswer s={next} view={view} actions={actions} />;
  } else if (view.clock.elapsedLabel === "00:00") {
    body = (
      <div className="answer-body" key="idle">
        <h2 className="answer-title" data-journey="5"><JBadge n={5} />{c.idleTitle}</h2>
        <p className="answer-lede" data-journey="4"><JBadge n={4} />{c.idleLede}</p>
      </div>
    );
  } else if (showing) {
    body = (
      <div className="answer-body" key={`keep-${showing.id}`}>
        <h2 className="answer-title" data-journey="5"><JBadge n={5} />{c.keepTitle(showing.name)}</h2>
        <p className="answer-lede" data-journey="4"><JBadge n={4} />{c.keepLede(since === null ? null : clock(since))}</p>
        <LastOutcome view={view} />
      </div>
    );
  } else {
    body = (
      <div className="answer-body" key="waiting">
        <h2 className="answer-title" data-journey="5"><JBadge n={5} />{c.waitingTitle}</h2>
        <p className="answer-lede" data-journey="4"><JBadge n={4} />{c.waitingLede(MIN_SAMPLE)}</p>
        <LastOutcome view={view} />
      </div>
    );
  }
  return (
    <section className="panel answer" aria-labelledby="answer-h" data-testid="desk-copilot">
      <p className="answer-kicker" id="answer-h">
        {mode === "observe" ? c.kickerObserve : c.kicker}
        <SimTag quiet>{c.simDataTag}</SimTag>
      </p>
      {body}
      <p className="sr-only" role="status" aria-atomic="true" data-testid="desk-announce">{announce}</p>
      <Flash view={view} actions={actions} mode={mode} primaryTaken={next !== null && next.confidence !== "low"} />
    </section>
  );
}

function Flash({ view, actions, mode, primaryTaken }: { view: LiveDeskViewModel; actions: LiveDeskActions; mode: Mode; primaryTaken: boolean }) {
  const { c, lang } = useShell();
  if (view.mode === "ended") return null;
  if (mode === "observe") return <div className="flash"><IconBolt size={18} /><p>{c.flashObserve}</p></div>;
  const ready = proposed(view, "flash_sale");
  if (ready) {
    const signals = ready.signals.map((x) => readSignal(x, lang));
    return (
      <div className="flash is-ready" data-testid={`desk-suggestion-${ready.id}`} data-state={ready.state}>
        <div className="flash-main">
          <p className="flash-title"><IconBolt size={20} />{ready.source === "ai" ? ready.headline : c.flashReadyTitle}</p>
          <p className="flash-why">
            {c.flashWhy(productName(view, ready.productId))}{" "}
            {signals.map((s, i) => <span key={s.label}>{i ? "; " : ""}{s.label} <b className="num">{s.text}</b></span>)}.{" "}
            {c.confidenceLine(c.confidence[ready.confidence])}{c.confidenceTail(ready.sampleSize)}.
          </p>
        </div>
        <div className="flash-actions">
          <Button variant={primaryTaken ? "secondary" : "primary"} onClick={() => actions.onAcceptSuggestion(ready.id)} data-testid={`desk-accept-${ready.id}`}>{c.flashRun}</Button>
          <Button variant="quiet" onClick={() => actions.onDismissSuggestion(ready.id)} data-testid={`desk-dismiss-${ready.id}`}>{c.dismiss}</Button>
        </div>
      </div>
    );
  }
  const last = view.copilot.suggestions.find((s) => s.kind === "flash_sale");
  const showing = view.products.find((p) => p.id === view.showingProductId) ?? null;
  let text: React.ReactNode;
  if (last && last.state === "accepted") text = c.flashAccepted(productName(view, last.productId));
  else if (last && last.state === "performed") text = c.flashPerformed(productName(view, last.productId));
  else {
    const why = !showing ? c.flashNoPin
      : showing.stock === null ? c.flashStockMissing(showing.name)
      : showing.stock < HEALTHY_STOCK ? c.flashStockLow(showing.name, showing.stock, HEALTHY_STOCK)
      : c.flashRule(MIN_RISING);
    text = <><b>{c.flashNotEnough}</b> {why}</>;
  }
  return <div className="flash" data-testid="desk-flash"><IconBolt size={18} /><p>{text}</p></div>;
}

// ---- comments -------------------------------------------------------------------------------------------------

function Comments({ view }: { view: LiveDeskViewModel }) {
  const { c } = useShell();
  const [filter, setFilter] = useState<CommentIntent | null>(null);
  const shown = view.comments.filter((m) => !filter || m.intent === filter).slice(0, 30);
  const masked = view.comments.filter((m) => m.piiMasked).length;
  return (
    <section className="panel comments" aria-labelledby="comments-h" data-journey="1" data-testid="desk-comments">
      <div className="panel-head">
        <h2 id="comments-h"><JBadge n={1} />{c.comments}</h2>
        <SimTag quiet>SIMULATED</SimTag>
      </div>
      <div className="intents" data-journey="3">
        <p className="intents-label"><JBadge n={3} />{c.intentsLabel}</p>
        <div className="intent-grid" role="group" aria-label={c.intentsGroup}>
          {INTENT_ORDER.map((k) => (
            <button key={k} type="button" className="intent" aria-pressed={filter === k} onClick={() => setFilter(filter === k ? null : k)} data-testid={`desk-intent-${k}`}>
              <span className="intent-name">{c.intent[k]}</span>
              <span className="intent-count"><Num value={view.intentCounts[k]} /></span>
            </button>
          ))}
        </div>
      </div>
      <ol className="stream" tabIndex={0} aria-live="off" aria-label={filter ? c.streamFiltered(c.intent[filter]) : c.streamAll}>
        {shown.map((m) => (
          <li key={m.id} className="cmt" data-testid={`desk-comment-${m.id}`}>
            <p className="cmt-head">
              <span className="cmt-handle">{m.user}</span>
              <span className={`chip intent-chip is-${m.intent}`}>{c.intent[m.intent].toLocaleLowerCase()}</span>
              {m.piiMasked && <span className="chip masked-chip"><IconShield size={14} />{c.masked}</span>}
              <span className="cmt-time num">{clock(m.atSec)}</span>
            </p>
            <p className="cmt-text">{m.text}</p>
          </li>
        ))}
        {shown.length === 0 && <li className="stream-empty">{filter ? c.noCommentsOfKind : c.noComments}</li>}
      </ol>
      <p className="privacy" data-journey="2">
        <JBadge n={2} />
        <IconShield size={16} />
        <span>{c.privacy} {c.privacyCount(masked)}</span>
      </p>
    </section>
  );
}

// ---- overlays -------------------------------------------------------------------------------------------------

function AboutDrawer({ view, liveId, onClose }: { view: LiveDeskViewModel; liveId: string; onClose: () => void }) {
  const { c, lang } = useShell();
  const sim = useDeskSimulation(liveId);
  const faults: DeskPlatformFault[] = ["token_expired", "rate_limited", "server_error"];
  return (
    <Sheet title={c.about} closeLabel={c.close} onClose={onClose} testId="desk-about">
      <section className="about" data-testid="desk-assumptions">
        <h3>{c.aboutSim}</h3>
        <p className="about-intro">{c.aboutSimIntro}</p>
        <ul>{view.assumptions.map((a) => <li key={a}>{tAssumption(a, lang)}</li>)}</ul>
      </section>
      <section className="about">
        <h3>{c.aboutRules}</h3>
        <ul>{c.aboutRuleList({ min: MIN_SAMPLE, rising: MIN_RISING, stock: HEALTHY_STOCK }).map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="about-status">{c.aiStatus}: <span data-testid="desk-ai-status">{tAiStatus(view.copilot, lang)}</span></p>
      </section>
      <section className="about" data-testid="desk-unpin-note">
        <h3>{c.aboutUnpin}</h3>
        <p className="about-intro">{c.aboutUnpinText}</p>
      </section>
      <section className="about">
        <h3>{c.aboutPrivacy}</h3>
        <p className="about-intro">{c.aboutPrivacyText}</p>
      </section>
      <section className="about">
        <h3>{c.aboutRun}</h3>
        <p className="about-intro">{c.aboutRunText}</p>
        <p className="about-status">{c.fingerprint}: <code>{view.fingerprint ?? c.noFingerprint}</code></p>
      </section>
      <section className="about">
        <h3>{c.aboutFault} <SimTag quiet>SIMULATED</SimTag></h3>
        <p className="about-intro">{c.aboutFaultText}</p>
        <div className="state-grid">
          {faults.map((f) => (
            <Button key={f} size="sm" aria-pressed={sim.fault === f} disabled={view.mode !== "live"} onClick={() => sim.setFault(f)} data-testid={`desk-fault-${f}`}>{c.fault[f]}</Button>
          ))}
          <Button size="sm" variant="quiet" disabled={sim.fault === null} onClick={() => sim.setFault(null)} data-testid="desk-fault-clear">{c.faultClear}</Button>
        </div>
      </section>
      <section className="about">
        <h3>{c.aboutDesign}</h3>
        <ul>{c.aboutDesignList.map((d) => <li key={d}>{d}</li>)}</ul>
      </section>
    </Sheet>
  );
}

function ConfirmEnd({ view, onCancel, onConfirm }: { view: LiveDeskViewModel; onCancel: () => void; onConfirm: () => void }) {
  const { c } = useShell();
  const ref = useTrap<HTMLDivElement>(onCancel);
  return (
    <div className="overlay is-center">
      <div className="sheet sheet-center confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-h" aria-describedby="confirm-d" ref={ref} data-testid="desk-end-dialog">
        <h2 id="confirm-h">{c.confirmTitle(view.clock.elapsedLabel)}</h2>
        <p id="confirm-d">{c.confirmBody}</p>
        <div className="row end">
          <Button variant="quiet" onClick={onCancel} data-autofocus="true">{c.confirmKeep}</Button>
          <Button variant="ink" onClick={onConfirm} data-testid="desk-end-confirm">{c.confirmEnd}</Button>
        </div>
      </div>
    </div>
  );
}

// ---- dock -------------------------------------------------------------------------------------------------------

function ClockControls({ view, actions }: { view: LiveDeskViewModel; actions: LiveDeskActions }) {
  const { c } = useShell();
  const live = view.mode === "live";
  return (
    <div className="clock" role="group" aria-label={c.clockLabel} data-testid="desk-clock">
      <span className="clock-now num" aria-label={`${c.clockLabel} ${view.clock.virtualNowLabel}`}>{view.clock.virtualNowLabel}</span>
      <button type="button" className="dock-btn" disabled={!live || view.clock.running} onClick={() => actions.onRun()} data-testid="desk-run">
        <IconPlay size={18} /><span>{c.run}</span>
      </button>
      <button type="button" className="dock-btn" disabled={!live || !view.clock.running} onClick={() => actions.onPause()} data-testid="desk-pause">
        <IconPause size={18} /><span>{c.pause}</span>
      </button>
      <div className="speed" role="group" aria-label={c.speedLabel}>
        {view.clock.speeds.map((v) => (
          <button key={v} type="button" className="dock-btn" aria-pressed={view.clock.speed === v} disabled={!live} onClick={() => actions.onSpeed(v)} data-testid={`desk-speed-${v}`}>{v}×</button>
        ))}
      </div>
      {SKIPS.map((s) => (
        <button key={s} type="button" className="dock-btn" disabled={!live} onClick={() => actions.onSkip(s)} data-testid={`desk-skip-${s}`}>
          {s === 30 && <IconSkip size={18} />}<span>{c.skip(s)}</span>
        </button>
      ))}
      <button type="button" className="dock-btn" onClick={() => actions.onReset()} data-testid="desk-reset">{c.reset}</button>
    </div>
  );
}

// ---- screen -------------------------------------------------------------------------------------------------------

function DeskBody({ view, actions, mode, recap }: { view: LiveDeskViewModel; actions: LiveDeskActions; mode: Mode; recap: RecapViewModel | null }) {
  const { c, lang } = useShell();
  const next = proposed(view, "show_next");
  const suggested = mode === "suggest" && view.mode === "live" && next ? next.productId : null;
  const chart = {
    elapsedSec: recap?.durationSec ?? 0,
    viewers: view.charts.viewers.points,
    carts: recap?.cartsPerMinute ?? [],
    marks: recap?.marks ?? [],
    bands: recap?.bands ?? [],
  };
  return (
    <div className="desk" data-testid="live-desk" data-mode={view.mode}>
      <h1 className="sr-only">{c.deskTitle}: {view.title}</h1>
      <div role="alert" aria-atomic="true" data-testid="desk-banner" className={view.banner ? `banner is-${view.banner.tone}` : "banner-empty"}>
        {view.banner && (
          <>
            <IconAlert className="banner-icon" />
            <div className="banner-text">
              <p className="banner-title">{tBanner(view.banner.text, lang)} <SimTag quiet>SIMULATED</SimTag></p>
              {view.banner.tone !== "info" && <p>{c.bannerHelp}</p>}
            </div>
          </>
        )}
      </div>
      {view.mode === "ended" && (
        <div className="ended-note">
          <span>{c.endedNote(view.clock.elapsedLabel)}</span>
          <Link href={`/desk/${encodeURIComponent(recap?.liveId ?? "")}/recap`} className="btn btn-primary btn-sm" data-testid="desk-recap-link">{c.seeRecap}</Link>
        </div>
      )}
      <div className="desk-grid">
        <div className="col col-left">
          <ProductList view={view} actions={actions} suggested={suggested} />
          <Phone view={view} c={c} lang={lang} />
        </div>
        <div className="col col-center">
          <Answer view={view} actions={actions} mode={mode} recap={recap} />
          <section className="panel chart-panel" aria-labelledby="chart-h" data-testid="desk-chart">
            <div className="panel-head">
              <h2 id="chart-h">{c.chartTitle}</h2>
              <SimTag quiet>SIMULATED</SimTag>
            </div>
            <DeskChart data={chart} variant="live" c={c} lang={lang} />
            <p className="chart-note">{c.chartNote}</p>
          </section>
        </div>
        <div className="col col-right">
          <Comments view={view} />
        </div>
      </div>
    </div>
  );
}

function DeskLoading() {
  return (
    <div className="desk" aria-busy="true" data-testid="desk-loading">
      <div className="desk-grid">
        <div className="col col-left"><span className="skeleton" style={{ height: 220 }} /><span className="skeleton" style={{ flex: 1 }} /></div>
        <div className="col col-center"><span className="skeleton" style={{ height: 56, width: "70%" }} /><span className="skeleton" style={{ height: 96 }} /><span className="skeleton" style={{ flex: 1 }} /></div>
        <div className="col col-right"><span className="skeleton" style={{ height: 64 }} /><span className="skeleton" style={{ flex: 1 }} /></div>
      </div>
    </div>
  );
}

function NotFound() {
  const { c } = useShell();
  return (
    <div className="desk-empty" data-testid="desk-not-found">
      <div className="empty">
        <h1>{c.notFound}</h1>
        <p>{c.notFoundHelp}</p>
        <Link href="/start" className="btn btn-primary btn-md">{c.start}</Link>
      </div>
    </div>
  );
}

/** The header's End live, or the way to the recap once the live has ended. */
function EndControl({ view, liveId, onEnd }: { view: LiveDeskViewModel; liveId: string; onEnd: () => void }) {
  const { c } = useShell();
  return (
    <span className="jtarget" data-journey="6">
      <JBadge n={6} />
      {view.mode === "ended" ? (
        <Link href={`/desk/${encodeURIComponent(liveId)}/recap`} className="btn btn-ink btn-md" data-testid="desk-recap">{c.seeRecap}</Link>
      ) : (
        <Button variant="ink" onClick={onEnd} data-testid="desk-end">{c.endLive}</Button>
      )}
    </span>
  );
}

export function LiveDeskScreen({ liveId }: { liveId: string }) {
  const { view, actions } = useLiveDesk(liveId);
  const recap = useLiveRecap(liveId);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("suggest");
  const [about, setAbout] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (ending && view?.mode === "ended") router.push(`/desk/${encodeURIComponent(liveId)}/recap`);
  }, [ending, view?.mode, router, liveId]);

  if (!view) {
    return <Shell screen="desk">{mounted ? <NotFound /> : <DeskLoading />}</Shell>;
  }
  const live = view.mode === "live";
  return (
    <Shell
      screen="desk"
      modalOpen={about || confirm}
      headerModes={<ModeSwitch mode={mode} setMode={setMode} />}
      headerStatus={<LiveStatus view={view} />}
      headerEnd={<EndControl view={view} liveId={liveId} onEnd={() => setConfirm(true)} />}
      dockStart={<span className="dock-print">{"· "}<DeskFingerprint view={view} /></span>}
      dockCenter={<ClockControls view={view} actions={actions} />}
      dockEnd={<AboutButton onOpen={() => setAbout(true)} />}
      onSpace={live ? () => (view.clock.running ? actions.onPause() : actions.onRun()) : undefined}
    >
      <DeskBody view={view} actions={actions} mode={mode} recap={recap} />
      {about && <AboutDrawer view={view} liveId={liveId} onClose={() => setAbout(false)} />}
      {confirm && live && (
        <ConfirmEnd view={view} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); setEnding(true); actions.onEndLive(); }} />
      )}
    </Shell>
  );
}

function DeskFingerprint({ view }: { view: LiveDeskViewModel }) {
  const { c } = useShell();
  return <span><span className="dock-label">{c.fingerprint} </span><code data-testid="desk-fingerprint" title={c.fingerprint}>{view.fingerprint ?? c.noFingerprint}</code></span>;
}

function AboutButton({ onOpen }: { onOpen: () => void }) {
  const { c } = useShell();
  return (
    <button type="button" className="dock-btn" onClick={onOpen} data-testid="desk-about-open">
      <IconInfo size={18} /><span className="dock-label is-wide">{c.about}</span>
    </button>
  );
}
