import React from "react";

/**
 * Quiet technical-print art for the empty space on wide screens, in the manner of a spec sheet: faint giant words,
 * registration marks, dotted grids, tick rulers, mono micro-labels, and die-cut stickers from a live seller's desk,
 * drawn in the site's paper, kraft, ink and brick; every colour is a theme token (see `.ld .art` in calm.css).
 * Words only, never numbers, so nothing reads as data. Every piece is hidden from assistive tech and static.
 */

/** Gradients and the dot pattern for one drawing; each drawing has its own ids, so one hidden drawing never blanks another. */
function ArtDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="stop-paper-a" />
        <stop offset="1" className="stop-paper-b" />
      </linearGradient>
      <linearGradient id={`${id}-kraft`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="stop-kraft-a" />
        <stop offset="1" className="stop-kraft-b" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0.6">
        <stop offset="0.2" className="stop-sheen" stopOpacity="0" />
        <stop offset="0.32" className="stop-sheen" stopOpacity="0.5" />
        <stop offset="0.44" className="stop-sheen" stopOpacity="0" />
      </linearGradient>
      <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" className="art-dot" /></pattern>
    </defs>
  );
}

function Sticker({ art, d, fill, children }: { art: string; d: string; fill: "paper" | "kraft"; children?: React.ReactNode }) {
  // die-cut: a soft cut line, a margin, then the body in the site's own paper or kraft, its ink outline and a sheen
  return (
    <g>
      <path d={d} className="stk-cut" />
      <path d={d} className="stk-margin" />
      <path d={d} fill={`url(#${art}-${fill})`} className="stk-ink" />
      <path d={d} fill={`url(#${art}-sheen)`} />
      {children}
    </g>
  );
}

const Reg = ({ x, y }: { x: number; y: number }) => (
  <g className="art-reg"><circle cx={x} cy={y} r="6" /><path d={`M${x} ${y - 10}v20M${x - 10} ${y}h20`} /></g>
);

/** A tick ruler: a tick every 10 units, a longer one every 50; `mark` puts a pointer that many units along. */
function Ruler({ x, y, ticks, width = ticks * 10, mark }: { x: number; y: number; ticks: number; width?: number; mark?: number }) {
  return (
    <g className="art-ruler">
      <path d={`M${x} ${y}H${x + width}`} />
      {Array.from({ length: ticks + 1 }, (_, i) => (<path key={i} d={`M${x + i * 10} ${y}v${i % 5 === 0 ? -8 : -4}`} />))}
      {mark !== undefined && <path d={`M${x + mark} ${y - 16}l6 8 6-8z`} className="art-mark" />}
    </g>
  );
}

/** Start: a phone on air and a shirt with a tag, under "prepare the show". */
export function StartArt() {
  return (
    <div className="start-art art" aria-hidden="true">
      <svg viewBox="0 0 440 320" focusable="false">
        <ArtDefs id="art" />

        <text x="0" y="96" className="art-giant">LIVE</text>
        <text x="236" y="262" className="art-giant">PIN</text>

        <Reg x={12} y={14} />
        <Reg x={424} y={300} />
        <text x="30" y="12" className="art-label">INSTRUCTIONS</text>
        <text x="30" y="26" className="art-label is-big">PREPARE THE SHOW</text>
        <text x="30" y="38" className="art-label is-big">PIN WHAT SELLS</text>
        <g className="art-chips">{["L", "I", "V", "E"].map((ch, i) => (<g key={ch} transform={`translate(${352 + i * 21} 12)`}><circle r="8" /><text y="3.5">{ch}</text></g>))}</g>
        <rect x="380" y="34" width="54" height="36" fill="url(#art-dots)" />
        <g className="art-pill"><rect x="300" y="86" width="64" height="18" rx="9" /><text x="332" y="98.5">ON AIR</text></g>
        <text x="226" y="312" className="art-label">SIMULATED · LIVE DESK</text>

        {/* a phone on air */}
        <g transform="translate(58 112) rotate(-8 60 96)">
          <Sticker art="art" fill="paper" d="M22 0h76a22 22 0 0 1 22 22v148a22 22 0 0 1 -22 22h-76a22 22 0 0 1 -22 -22v-148a22 22 0 0 1 22 -22z">
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
          <Sticker art="art" fill="kraft" d="M56 18q24 18 48 0l46 22-14 36-22-9v76h-68v-76l-22 9-14-36z">
            <path d="M56 18q24 18 48 0" className="stk-line" fill="none" />
            <path d="M58 70v70M102 70v70" className="stk-line is-soft" />
            <g transform="translate(108 92) rotate(14)"><path d="M0 6l6-6h18v28h-24z" className="stk-tag" /><circle cx="6" cy="7" r="2" className="stk-line-fill" /></g>
          </Sticker>
        </g>

        <Ruler x={226} y={294} ticks={20} width={204} mark={106} />
      </svg>
    </div>
  );
}

/** Home: a comment bubble and a ring light, beside "reads comments, suggests what to pin". */
export function HomeArt() {
  const leds = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <div className="home-art art" aria-hidden="true">
      <svg viewBox="0 0 420 320" focusable="false">
        <ArtDefs id="home-art" />

        <text x="0" y="100" className="art-giant">READ</text>

        <Reg x={12} y={14} />
        <Reg x={404} y={302} />
        <text x="30" y="12" className="art-label">HOW IT WORKS</text>
        <text x="30" y="26" className="art-label is-big">READ THE ROOM</text>
        <text x="30" y="38" className="art-label is-big">SUGGEST · YOU DECIDE</text>
        <rect x="346" y="4" width="63" height="36" fill="url(#home-art-dots)" />
        <g className="art-pill"><rect x="40" y="262" width="72" height="18" rx="9" /><text x="76" y="274.5">YOU PIN</text></g>

        {/* a comment from the room */}
        <g transform="translate(26 124) rotate(-6 80 56)">
          <Sticker art="home-art" fill="kraft" d="M18 0h124a18 18 0 0 1 18 18v56a18 18 0 0 1 -18 18h-84l-26 20 6-20h-20a18 18 0 0 1 -18 -18v-56a18 18 0 0 1 18 -18z">
            <circle cx="26" cy="26" r="8" className="stk-tag" />
            <path d="M42 26h86M22 48h112M22 66h70" className="stk-line" />
            <path d="M118 62c0-5 7-8 10-3 3-5 10-2 10 3 0 6-10 11-10 11s-10-5-10-11z" className="stk-heart" />
          </Sticker>
        </g>

        {/* a ring light with a phone in its clamp */}
        <g transform="translate(232 70) rotate(7 80 104) scale(0.92)">
          <Sticker art="home-art" fill="paper" d="M80 12a68 68 0 1 1 0 136a68 68 0 1 1 0 -136zM74 140h12v56h-12zM50 194h60a7 7 0 0 1 0 14h-60a7 7 0 0 1 0 -14z">
            <circle cx="80" cy="80" r="56" fill="none" stroke="url(#home-art-kraft)" strokeWidth="20" />
            <circle cx="80" cy="80" r="66" className="stk-line is-thin" fill="none" />
            <circle cx="80" cy="80" r="46" className="stk-screen" />
            <g className="stk-leds">{leds.map((a) => <path key={a} d="M80 28v-4" transform={`rotate(${a} 80 80)`} />)}</g>
            <rect x="66" y="56" width="28" height="48" rx="5" className="stk-tag" />
            <circle cx="80" cy="62" r="2.4" className="stk-live-dot" />
            <path d="M74 98h12" className="stk-line is-thin" />
          </Sticker>
        </g>

        <Ruler x={150} y={302} ticks={22} mark={64} />
      </svg>
    </div>
  );
}

/** Recap: a clapperboard, the end of the show. */
export function RecapArt() {
  // diagonal stripes across the clapper bar, from its lower edge to its upper edge
  const stripes = [0.06, 0.28, 0.5, 0.72].map((t) => `M${3 + 94 * t} ${42 - 16 * t}L${94 * (t + 0.1)} ${26 - 16 * (t + 0.1)}`);
  return (
    <div className="recap-art art" aria-hidden="true">
      <svg viewBox="0 0 280 116" focusable="false">
        <ArtDefs id="recap-art" />
        <Reg x={10} y={14} />
        <text x="26" y="11" className="art-label">END OF SHOW</text>
        <text x="26" y="25" className="art-label is-big">THAT&apos;S A WRAP</text>
        <rect x="26" y="40" width="54" height="27" fill="url(#recap-art-dots)" />
        <Ruler x={0} y={108} ticks={14} mark={34} />
        <g transform="translate(160 10) rotate(-5 48 50)">
          <Sticker art="recap-art" fill="kraft" d="M0 30h96v58a6 6 0 0 1 -6 6h-84a6 6 0 0 1 -6 -6zM0 26l94 -16 3 16 -94 16z">
            <path d={stripes.join("")} className="stk-stripe" />
            <circle cx="5" cy="34" r="2.2" className="stk-line-fill" />
            <path d="M10 50h76" className="stk-line is-soft" />
            <text x="48" y="76" className="stk-live-text is-big">WRAP</text>
          </Sticker>
        </g>
      </svg>
    </div>
  );
}

/** Legacy: a kraft folder with a planning sheet in it, the earlier screens kept on file. */
export function LegacyArt() {
  return (
    <div className="legacy-art art" aria-hidden="true">
      <svg viewBox="0 0 360 350" focusable="false">
        <ArtDefs id="legacy-art" />

        <text x="0" y="100" className="art-giant">PLAN</text>

        <Reg x={12} y={14} />
        <Reg x={344} y={338} />
        <text x="30" y="12" className="art-label">ARCHIVE</text>
        <text x="30" y="26" className="art-label is-big">EARLIER SCREENS</text>
        <text x="30" y="38" className="art-label is-big">SAME LINKS, OWN LOOK</text>
        <rect x="286" y="4" width="63" height="36" fill="url(#legacy-art-dots)" />

        {/* a planning sheet, half out of the folder */}
        <g transform="translate(92 96) rotate(-5 80 90)">
          <Sticker art="legacy-art" fill="paper" d="M8 0h144a8 8 0 0 1 8 8v164a8 8 0 0 1 -8 8h-144a8 8 0 0 1 -8 -8v-164a8 8 0 0 1 8 -8z">
            <path d="M20 22h90M20 40h120M20 58h104M20 76h120" className="stk-line is-soft" />
            <rect x="20" y="92" width="40" height="14" rx="7" className="stk-live" />
          </Sticker>
        </g>

        {/* the folder */}
        <g transform="translate(40 168) rotate(3 104 72)">
          <Sticker art="legacy-art" fill="kraft" d="M0 14a8 8 0 0 1 8 -8h52l12 12h128a8 8 0 0 1 8 8v110a8 8 0 0 1 -8 8h-192a8 8 0 0 1 -8 -8z">
            <path d="M0 34h208" className="stk-line is-soft" />
            <rect x="70" y="62" width="72" height="30" className="stk-tag" />
            <path d="M80 72h52M80 82h34" className="stk-line is-thin" />
          </Sticker>
        </g>

        <Ruler x={170} y={338} ticks={15} mark={84} />
      </svg>
    </div>
  );
}
