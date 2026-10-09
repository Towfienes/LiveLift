import React, { useId } from "react";
import type { DeskChart as ChartView } from "@/lib/livedesk/types";
import { DeskPanel } from "./DeskFrame";
import { deskCopy } from "./copy";

export function DeskChart({ chart, title, lang, testId }: { chart: ChartView; title: string; lang: "en" | "vi"; testId: string }) {
  const c = deskCopy[lang];
  const id = useId();
  const maxTime = Math.max(1, ...chart.points.map(point => point.atSec), ...chart.markers.map(marker => marker.atSec));
  const maxValue = Math.max(1, ...chart.points.map(point => point.value));
  const x = (second: number): number => 16 + second / maxTime * 448;
  const y = (value: number): number => 124 - value / maxValue * 108;
  return (
    <DeskPanel title={title} testId={testId}>
      <figure>
        <svg viewBox="0 0 480 144" role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`} className="w-full h-[144px]">
          <title id={`${id}-title`}>{title} · SIMULATED</title>
          <desc id={`${id}-summary`}>{chart.summary}</desc>
          {[16, 70, 124].map(row => <line key={row} x1={16} y1={row} x2={464} y2={row} stroke="var(--border-subtle)" />)}
          {chart.points.length > 0 && <polyline fill="none" stroke="var(--accent-lime)" strokeWidth={2}
            points={chart.points.map(point => `${x(point.atSec)},${y(point.value)}`).join(" ")} />}
          {chart.points.map(point => <circle key={point.atSec} cx={x(point.atSec)} cy={y(point.value)} r={3} fill="var(--accent-lime)" />)}
          {chart.markers.map((marker, index) => <g key={`${marker.atSec}-${index}`}>
            <title>{marker.label} · {marker.atSec} s · SIMULATED</title>
            <line x1={x(marker.atSec)} x2={x(marker.atSec)} y1={16} y2={124} stroke="var(--simulated)" strokeDasharray="4 4" />
            <circle cx={x(marker.atSec)} cy={16} r={4} fill="var(--simulated)" />
          </g>)}
        </svg>
        <figcaption className="text-[14px] text-[var(--text-muted)]">{chart.summary}</figcaption>
      </figure>
      <p className="mt-2 text-[13px] text-[var(--text-muted)]">{c.markers}</p>
      <details className="mt-2 text-[13px]">
        <summary className="min-h-[44px] flex items-center cursor-pointer text-[var(--simulated)]">{c.chartDetails}</summary>
        {chart.points.length === 0 ? <p>{c.noPoints}</p> : <ul>{chart.points.map(point => <li key={point.atSec}>{point.atSec} s: {point.value} {chart.unit}</li>)}</ul>}
        <ul className="mt-2">{chart.markers.map((marker, index) => <li key={index}>{marker.atSec} s: {marker.label} · SIMULATED</li>)}</ul>
      </details>
    </DeskPanel>
  );
}
