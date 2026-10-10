"use client";

import React from "react";
import { CardHoodie, CardStack, CardTote, CommentChips, HostPhone, InkArrow, PaperClip, PriceTag, Rack, RingLight, UnknownNote } from "./brand";
import { useShell } from "./Shell";

/**
 * Decoration for the empty space on wide screens, in the manner of a printed spec sheet: registration marks at the
 * corners, a kicker, a tick ruler with its caption, a faint giant word, and the brand drawings (`brand.tsx`, generated
 * from docs/brand/assets) arranged on it. Words only, never numbers, so nothing reads as data. Hidden from assistive
 * tech, static, and every colour is a theme token.
 */

/** A registration mark, as on a printed spec sheet. */
export function Cross({ className }: { className: string }) {
  return (
    <svg className={`spec-cross ${className}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 1v14M1 8h14" fill="none" strokeWidth="1" />
      <circle cx="8" cy="8" r="3.4" fill="none" strokeWidth="1" />
    </svg>
  );
}

/** A tick ruler: a long tick every ten, a middle one every five; the brick pointer sits at `mark` (0 to 400). */
export function SpecRuler({ label, mark = 300 }: { label?: string; mark?: number }) {
  return (
    <div className="spec-ruler">
      <svg viewBox="0 0 400 22" preserveAspectRatio="none" width="100%" height="22" focusable="false" aria-hidden="true">
        {Array.from({ length: 41 }, (_, i) => (
          <line key={i} className="spec-tick" x1={i * 10} x2={i * 10} y1={22} y2={i % 10 === 0 ? 6 : i % 5 === 0 ? 12 : 17} />
        ))}
        <path className="spec-mark" d={`M${mark} 2 l6 0 l-3 7 z`} />
      </svg>
      {label && <span className="spec-kicker">{label}</span>}
    </div>
  );
}

/** One drawing placed on a sheet's stage: left, top and width in percent of the stage, and a tilt in degrees. */
function Spot({ left, top, width, tilt = 0, children }: { left: number; top: number; width: number; tilt?: number; children: React.ReactNode }) {
  return <span className="sheet-spot" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, rotate: `${tilt}deg` }}>{children}</span>;
}

function Sheet({ className, kicker, ruler, giant, children }: { className: string; kicker: string; ruler?: string; giant?: string; children: React.ReactNode }) {
  return (
    <div className={`sheet-art ${className}`} aria-hidden="true">
      <Cross className="tl" />
      <Cross className="tr" />
      <Cross className="bl" />
      <Cross className="br" />
      <span className="spec-kicker">{kicker}</span>
      <div className="sheet-stage">
        {giant && <svg className="sheet-giant" viewBox="0 0 300 100" focusable="false"><text x="0" y="86">{giant}</text></svg>}
        {children}
      </div>
      <SpecRuler label={ruler} />
    </div>
  );
}

/** Start: the rack, the product taped up, the ring light; "prepare the show". */
export function StartArt() {
  const { c } = useShell();
  return (
    <Sheet className="start-art" kicker={c.art.start.kicker} ruler={c.art.start.ruler} giant="LIVE">
      <Spot left={0} top={26} width={56}><Rack /></Spot>
      <Spot left={50} top={30} width={27} tilt={-4}><CardHoodie /></Spot>
      <Spot left={79} top={2} width={19}><RingLight /></Spot>
    </Sheet>
  );
}

/** Recap: the products of the show and what the room said; "end of show". */
export function RecapArt() {
  const { c } = useShell();
  return (
    <Sheet className="recap-art" kicker={c.art.recap.kicker}>
      <Spot left={8} top={0} width={20}><CardStack /></Spot>
      <Spot left={36} top={26} width={22}><InkArrow /></Spot>
      <Spot left={66} top={2} width={26}><CommentChips /></Spot>
    </Sheet>
  );
}

/** Legacy: the earlier planning screens, kept on file. */
export function LegacyArt() {
  const { c } = useShell();
  return (
    <Sheet className="legacy-art" kicker={c.art.legacy.kicker} ruler={c.art.legacy.ruler} giant="PLAN">
      <Spot left={6} top={20} width={42} tilt={-3}><CardStack /></Spot>
      <Spot left={40} top={12} width={7}><PaperClip /></Spot>
      <Spot left={56} top={48} width={34} tilt={6}><PriceTag /></Spot>
    </Sheet>
  );
}

/** Home's four steps, each with its drawing: connect (the host's phone), products, go live (the ring light), the desk. */
export function StepArt({ step }: { step: number }) {
  const Drawing = [HostPhone, CardTote, RingLight, CommentChips][step] ?? CardStack;
  return <span className="flow-art" aria-hidden="true"><Drawing /></span>;
}

/** The recap's "what we do not know" box wears the brand's sticky note, in the reader's language. */
export function UnknownSticker() {
  const { c } = useShell();
  return <span className="unknown-sticker" aria-hidden="true"><UnknownNote label={c.unknownBig} /></span>;
}

/** Empty and not-found states: a stack of cards, nothing pinned yet. */
export function EmptyArt() {
  return <span className="empty-art" aria-hidden="true"><CardStack /></span>;
}
