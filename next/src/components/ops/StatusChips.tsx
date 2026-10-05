import React from "react";
import type { AnchorForecast } from "@/lib/domain";
import { formatClock, formatDuration, formatSigned } from "@/lib/domain";

/**
 * Status signals: text + icon + colour (colour is secondary). No pill ladder.
 * Amber warns, red is controlled, violet marks SIMULATED/evidence, lime marks the one live action.
 */

export type Tone = "neutral" | "lime" | "warn" | "danger" | "violet" | "muted";

const TONE: Record<Tone, string> = {
  neutral: "text-[#CAD0DA]",
  lime: "text-[#DFFF00]",
  warn: "text-[#F6C875]",
  danger: "text-[#F4A4A4]",
  violet: "text-[#C8B2FF]",
  muted: "text-[#9AA5B5]",
};

export function Signal({
  tone = "neutral",
  icon,
  children,
  className = "",
  title,
}: {
  tone?: Tone;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}): React.ReactElement {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 text-[14px] leading-5 ${TONE[tone]} ${className}`}>
      {icon && <i className={icon} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

/** The hard-anchor commitment, always shown as a lock + committed clock time. */
export function AnchorBadge({
  committedMs,
  tz,
  className = "",
}: {
  committedMs: number;
  tz: string;
  className?: string;
}): React.ReactElement {
  return (
    <Signal tone="neutral" icon="ri-lock-2-line" className={className} title="Hard anchor: this commitment does not move unless you re-anchor it explicitly">
      <span className="tabular-nums">Hard anchor {formatClock(committedMs, tz, true)}</span>
    </Signal>
  );
}

export function anchorSignal(
  anchor: AnchorForecast,
  tz: string
): { tone: Tone; icon: string; text: string } {
  const late = formatDuration(anchor.deficitSec);
  switch (anchor.status) {
    case "on_track":
      return {
        tone: "neutral",
        icon: "ri-checkbox-circle-line",
        text: anchor.bufferSec > 0 ? `On track · ${formatDuration(anchor.bufferSec)} buffer` : "On track · no buffer",
      };
    case "at_risk":
      return { tone: "warn", icon: "ri-error-warning-line", text: `At risk · ${late} late` };
    case "possible_risk":
      return {
        tone: "warn",
        icon: "ri-question-line",
        text: `Possible risk · up to ${formatDuration(anchor.bufferSec)} buffer, end unknown`,
      };
    case "missed":
      return { tone: "danger", icon: "ri-time-line", text: `Missed · ${late} late` };
    case "met":
      return { tone: "neutral", icon: "ri-checkbox-circle-line", text: `Met at ${formatClock(anchor.projectedStartMs, tz, true)}` };
    case "met_late":
      return { tone: "warn", icon: "ri-history-line", text: `Met late · ${late}` };
  }
}

export function AnchorStatus({ anchor, tz }: { anchor: AnchorForecast; tz: string }): React.ReactElement {
  const s = anchorSignal(anchor, tz);
  return (
    <Signal tone={s.tone} icon={s.icon}>
      {s.text}
    </Signal>
  );
}

/** Drift against the immutable baseline. Positive = later than committed. */
export function Drift({
  seconds,
  lowerBound = false,
  className = "",
}: {
  seconds: number | null;
  lowerBound?: boolean;
  className?: string;
}): React.ReactElement | null {
  if (seconds === null) return null;
  if (seconds === 0) return <Signal tone="muted" className={className}>on plan</Signal>;
  return (
    <Signal tone={seconds > 0 ? "warn" : "neutral"} className={`tabular-nums ${className}`}>
      {lowerBound && seconds > 0 ? "≥ " : ""}
      {formatSigned(seconds)}
    </Signal>
  );
}
