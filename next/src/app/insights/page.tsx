"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { EnvironmentIdentity, SessionLifecycle } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { EnvironmentBadge } from "@/components/ui";
import { RoomStatusPanel } from "@/components/ops/ConnectionStatus";
import { useSessions, useStoreState } from "@/lib/store/hooks";
import { deriveIntelligence, type SessionAnalytics } from "@/lib/domain/analytics";
import { formatDuration } from "@/lib/domain/time";

const panel = "rounded-xl border border-[#2A303A] bg-[#13161C] p-4 sm:p-6 min-w-0";
const select = "w-full min-h-11 rounded-lg border border-[#39414D] bg-[#1B1F27] px-3 text-[#F5F7FC]";
const cell = "px-3 py-3 align-top";
const time = (seconds: number | null) => seconds === null ? "Not recorded" : formatDuration(seconds);
const variance = (seconds: number | null) => seconds === null ? "Unknown" : `${seconds > 0 ? "+" : seconds < 0 ? "−" : ""}${formatDuration(Math.abs(seconds))}`;
const date = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const outcome = (value: string) => value.replaceAll("_", " ");

/** Both series share a zero origin and maximum. Missing values have no mark. */
function TimingBars({ planned, actual, max }: { planned: number | null; actual: number | null; max: number }): React.ReactElement {
  return <svg viewBox="0 0 200 24" className="w-full max-w-[240px] h-6" aria-hidden="true">
    {planned !== null && <rect x="0" y="2" width={200 * planned / max} height="7" fill="#8A95A5" />}
    {actual !== null && <rect x="0" y="15" width={200 * actual / max} height="7" fill="#DFFF00" />}
  </svg>;
}

function Table({ caption, headings, children }: { caption: string; headings: string[]; children: React.ReactNode }): React.ReactElement {
  return <div className="overflow-x-auto rounded-lg border border-[#2A303A] focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-2" tabIndex={0} role="region" aria-label={caption}>
    <table className="w-full text-left text-sm">
      <caption className="text-left p-3 text-[#B7C1CE]">{caption}</caption>
      <thead className="bg-[#1B1F27] text-[#CAD0DA]"><tr>{headings.map((h) => <th key={h} scope="col" className={`${cell} font-medium`}>{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#2A303A]">{children}</tbody>
    </table>
  </div>;
}

function SessionDetail({ session }: { session: SessionAnalytics }): React.ReactElement {
  const max = Math.max(1, ...session.rows.flatMap((r) => [r.plannedSec ?? 0, r.actualSec ?? 0]));
  return <section className={`${panel} space-y-4`} aria-labelledby="timing-title" data-testid="analytics-detail">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="timing-title" className="text-xl font-medium">Planned vs actual · {session.title}</h2>
      <Link className="min-h-11 inline-flex items-center text-[#DFFF00] underline" href={`/live/${session.id}/${session.lifecycle === "ended" ? "review" : session.lifecycle === "active" ? "operate" : "prepare"}`}>Open {session.lifecycle === "ended" ? "Review" : "session"}</Link>
    </div>
    <p className="text-sm text-[#B7C1CE]">Baseline stays fixed. Gray = planned target; lime = recorded duration. All bars start at zero, with the same maximum ({time(max)}). Missing values have no bar. Overrun / underrun flags use a 15-second threshold.</p>
    <Table caption="Segment timing and operator-declared coverage" headings={["Segment / outcome", "Baseline / current target", "Actual", "Duration difference", "Start difference", "Coverage", "Timing"]}>
      {session.rows.map((row) => <tr key={row.id}>
        <th scope="row" className={`${cell} min-w-[150px] font-normal`}><span className="font-medium">{row.title}</span><div className="text-[#B7C1CE]">{outcome(row.outcome)}</div>{row.followUp && <p>Follow-up: {row.followUp}</p>}</th>
        <td className={cell}>{row.plannedSec === null ? "Not entered" : time(row.plannedSec)} / {row.currentTargetSec === null ? "Not entered" : time(row.currentTargetSec)}</td>
        <td className={cell}>{time(row.actualSec)}</td>
        <td className={`${cell} ${row.overran ? "text-[#F6C875]" : ""}`}>{variance(row.varianceSec)}{row.overran ? " · overrun" : row.underran ? " · underrun" : ""}</td>
        <td className={cell}>{variance(row.startVarianceSec)}</td>
        <td className={cell}>{row.coverage ?? "Not declared"}</td>
        <td className={`${cell} min-w-[140px]`}><TimingBars planned={row.plannedSec} actual={row.actualSec} max={max} /></td>
      </tr>)}
    </Table>
    <h3 className="text-lg font-medium">Cue / report coverage</h3>
    <p className="text-[#CAD0DA]">{session.reports} / {session.cues.length} operator cues have a recorded report · {session.reportCoverage === null ? "Not applicable: no operator cues" : `${Math.round(session.reportCoverage * 100)}% report coverage`}.</p>
    <p className="text-sm text-[#B7C1CE]">{session.environment === "SIMULATED" ? "SIMULATED reports are rehearsal evidence." : "Operator reported performed is an operator claim."} Attempted stays unresolved. No report means unknown. Platform verification: unknown. Segment completion does not prove coverage.</p>
    {session.cues.length > 0 && <Table caption="Operator cues; reports are not provider confirmation" headings={["Cue", "Report state", "Reported at", "Evidence", "Verification"]}>
      {session.cues.map((cue) => <tr key={cue.id}><th scope="row" className={`${cell} font-normal`}>{cue.title}</th><td className={cell}>{cue.state === "performed" ? "Reported performed" : outcome(cue.state)}</td><td className={cell}>{cue.reportedAtMs === null ? "Not recorded" : date(cue.reportedAtMs)}</td><td className={cell}>{outcome(cue.evidence)}</td><td className={cell}>{cue.verification}</td></tr>)}
    </Table>}
    <div className="grid md:grid-cols-2 gap-4">
      <div><h3 className="text-lg font-medium">Operator notes · {session.notes.length}</h3><p className="text-sm text-[#B7C1CE]">No structured categories recorded.</p><ul className="space-y-2 mt-2">{session.notes.map((n) => <li key={n.id} className="break-words">{n.text}<div className="text-xs text-[#B7C1CE]">Recorded {date(n.recordedAtMs)}</div></li>)}</ul></div>
      <div><h3 className="text-lg font-medium">Recovery selections · {session.recoveries.length}</h3><p className="text-sm text-[#B7C1CE]">Recorded decisions; no claim that they caused an outcome.</p><ul className="space-y-2 mt-2">{session.recoveries.map((r) => <li key={r.id} className="break-words">{r.summary}<div className="text-xs text-[#B7C1CE]">{date(r.recordedAtMs)}</div></li>)}</ul></div>
    </div>
    <p className="text-sm text-[#B7C1CE]">Unplanned action reports: {session.actions.length} ({session.actions.filter((a) => a.state === "performed").length} reported performed, {session.actions.filter((a) => a.state === "attempted").length} attempted, {session.actions.filter((a) => a.state === "cancelled").length} cancelled). Platform verification: unknown.</p>
    {(session.corrections > 0 || session.clockDiscontinuities > 0) && <p className="text-[#F6C875]">{session.corrections} appended corrections; {session.clockDiscontinuities} recorded clock discontinuities. Read Review for context; corrections do not overwrite original measurements.</p>}
  </section>;
}

export default function InsightsPage(): React.ReactElement {
  const [environment, setEnvironment] = useState<EnvironmentIdentity>("REAL");
  const [sessionId, setSessionId] = useState("");
  const [lifecycle, setLifecycle] = useState<SessionLifecycle | "all">("ended");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [detailId, setDetailId] = useState("");
  const { hydrated, sessions, remote } = useSessions(environment);
  const local = useStoreState();
  const intelligence = deriveIntelligence(sessions, { environment, sessionId: sessionId || undefined, lifecycle: lifecycle === "all" ? undefined : lifecycle, fromDate, toDate, order });
  const detail = intelligence.sessions.find((s) => s.id === detailId) ?? intelligence.sessions[0];
  const unavailable = environment === "REAL" && remote.snapshot === null;
  const loading = unavailable && remote.connection === "connecting" && remote.problem === null;
  const trendMax = Math.max(1, ...intelligence.ended.flatMap((s) => [s.plannedSpanSec ?? 0, s.durationSec ?? 0]));
  const clear = () => { setSessionId(""); setLifecycle("ended"); setFromDate(""); setToDate(""); setOrder("newest"); };

  return <StandardShell><div className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" data-testid="insights">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-medium">Insights</h1><p className="mt-2 text-[#CAD0DA]">What happened, where the plan shifted, and what you chose for the next LIVE.</p></div><EnvironmentBadge environment={environment} /></div>
    <p className="text-sm text-[#B7C1CE]">LiveLift operational analytics · saved tracking records only. Observation does not establish causation. Dates below use UTC.</p>
    {environment === "REAL" && <RoomStatusPanel />}
    {environment === "REAL" && remote.snapshot && (remote.connection !== "connected" || remote.problem !== null) && <p role="status" className="text-[#F6C875]" data-testid="insights-stale">Last confirmed room history; connection is stale. These insights may be incomplete.</p>}
    {environment === "SIMULATED" && <p className="rounded-lg p-4 bg-[#211F2B] text-[#C8B2FF]">SIMULATED · browser rehearsals only. These are not REAL show results or TikTok analytics.</p>}
    {environment === "SIMULATED" && (local.storage === "unavailable" || local.notices.length > 0) && <p role="status" className="text-[#F6C875]">Browser history may be unavailable or incomplete. {local.notices.join(" ")}</p>}
    <div className={`${panel} grid sm:grid-cols-2 lg:grid-cols-3 gap-4`} aria-label="Analytics filters">
      <div><label htmlFor="analytics-environment">Environment</label><select id="analytics-environment" className={`${select} mt-1`} value={environment} onChange={(e) => { setEnvironment(e.target.value as EnvironmentIdentity); setSessionId(""); setDetailId(""); }}><option>REAL</option><option>SIMULATED</option></select></div>
      <div><label htmlFor="analytics-session">Session</label><select id="analytics-session" className={`${select} mt-1`} value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="">All loaded sessions</option>{sessions.filter((s) => s.environment === environment).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
      <div><label htmlFor="analytics-state">Show state</label><select id="analytics-state" className={`${select} mt-1`} value={lifecycle} onChange={(e) => setLifecycle(e.target.value as SessionLifecycle | "all")}><option value="ended">Ended tracking</option><option value="all">All states</option><option value="planned">Planned</option><option value="active">Active</option></select></div>
      <div><label htmlFor="analytics-from">From date (UTC)</label><input id="analytics-from" type="date" className={`${select} mt-1`} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
      <div><label htmlFor="analytics-to">To date (UTC)</label><input id="analytics-to" type="date" className={`${select} mt-1`} value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
      <div><label htmlFor="analytics-order">Order</label><select id="analytics-order" className={`${select} mt-1`} value={order} onChange={(e) => setOrder(e.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
      <button type="button" className="min-h-11 text-[#DFFF00] underline text-left" onClick={clear}>Clear filters</button>
    </div>
    {fromDate && toDate && fromDate > toDate && <p role="alert" className="text-[#F6C875]">From date must be on or before To date.</p>}
    {!hydrated || loading ? <p role="status">Loading history…</p> : <>
      {intelligence.sessions.length === 0 ? <section className={panel} data-testid="insights-empty"><h2 className="text-xl font-medium">{unavailable ? "REAL history is unavailable" : "No sessions match"}</h2><p className="mt-2 text-[#CAD0DA]">{unavailable ? "The room has not supplied history. This does not mean there were no REAL shows." : "End tracking to see completed-session trends, or choose another state or date range. Missing history is never a zero result."}</p><Link href="/simulator" className="min-h-11 inline-flex items-center text-[#DFFF00] underline">Open Simulator</Link></section> : <>
        <section aria-label="Session summaries" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="analytics-summaries">
          {intelligence.sessions.map((s) => <article key={s.id} className={`${panel} space-y-3`}><EnvironmentBadge environment={s.environment} size="sm" /><h2 className="text-xl font-medium break-words">{s.title}</h2><p className="text-sm text-[#B7C1CE]">{date(s.dateMs)} · {s.lifecycle === "ended" ? "Ended tracking" : s.lifecycle}</p><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[#B7C1CE]">Tracked duration</dt><dd className="text-xl">{time(s.durationSec)}</dd></div><div><dt className="text-[#B7C1CE]">Planned host time</dt><dd className="text-xl">{s.plannedHostSec === null ? "Not entered" : time(s.plannedHostSec)}</dd></div><div><dt className="text-[#B7C1CE]">Recorded completed</dt><dd>{s.completed} / {s.rows.length} segments</dd></div><div><dt className="text-[#B7C1CE]">Not reached</dt><dd>{s.notReached} segments</dd></div><div><dt className="text-[#B7C1CE]">Cue reports</dt><dd>{s.reports} / {s.cues.length}</dd></div><div><dt className="text-[#B7C1CE]">Notes / recoveries</dt><dd>{s.notes.length} / {s.recoveries.length}</dd></div></dl><button type="button" className="min-h-11 text-[#DFFF00] underline" onClick={() => setDetailId(s.id)} aria-pressed={detail?.id === s.id}>Inspect timing · {s.title}</button></article>)}
        </section>
        {detail && <SessionDetail session={detail} />}
      </>}
      <section className={`${panel} space-y-4`} aria-labelledby="trend-title"><h2 id="trend-title" className="text-xl font-medium">Trend across ended sessions</h2><p className="text-sm text-[#B7C1CE]">{intelligence.ended.length} loaded {environment} sessions with ended tracking. Gray = baseline show span including anchor waits; lime = recorded tracking duration. Zero origin; shared maximum {time(trendMax)}. Incomplete durations have no mark. Session date is recorded start, or planned start if missing.</p>
        {intelligence.ended.length > 0 ? <Table caption="Ended-session timing trend; ordered by the selected date order" headings={["Session", "Baseline show span", "Tracked duration", "Cue reports", "Timing"]}>{intelligence.ended.map((s) => <tr key={s.id}><th scope="row" className={`${cell} font-normal min-w-[140px]`}>{s.title}<div className="text-[#B7C1CE]">{date(s.dateMs)}</div></th><td className={cell}>{time(s.plannedSpanSec)}</td><td className={cell}>{time(s.durationSec)}</td><td className={cell}>{s.reports} / {s.cues.length}{s.reportCoverage === null ? " · N/A" : ` · ${Math.round(s.reportCoverage * 100)}%`}</td><td className={`${cell} min-w-[140px]`}><TimingBars planned={s.plannedSpanSec} actual={s.durationSec} max={trendMax} /></td></tr>)}</Table> : <p>No ended sessions available for this selection.</p>}
        <h3 className="text-lg font-medium">Repeated deviations</h3>{intelligence.patterns.length > 0 ? <ul className="space-y-2">{intelligence.patterns.map((p) => <li key={p.kind}>{outcome(p.kind)} segments overran in {p.overrunSessions} / {p.observedSessions} sessions with comparable timing. Segment kind is recorded; this does not show a cause.</li>)}</ul> : <p className="text-[#B7C1CE]">No segment kind has recorded overruns in two or more selected sessions.</p>}
      </section>
      <section className={`${panel} space-y-4`}><h2 className="text-xl font-medium">Overrun ranking</h2><p className="text-sm text-[#B7C1CE]">Largest 10 recorded overruns against baseline targets, among selected ended sessions.</p>{intelligence.overruns.length > 0 ? <ol className="space-y-3">{intelligence.overruns.slice(0, 10).map((r) => <li key={`${r.sessionId}:${r.id}`} className="flex justify-between gap-3"><span className="min-w-0 break-words">{r.title}<span className="block text-sm text-[#B7C1CE]">{r.sessionTitle} · planned {time(r.plannedSec)} / actual {time(r.actualSec)}</span></span><span className="text-[#F6C875] shrink-0">{variance(r.varianceSec)}</span></li>)}</ol> : <p>No recorded overruns in the available comparable timing.</p>}</section>
      <section className={`${panel} space-y-4`} data-testid="next-live-history"><h2 className="text-xl font-medium">Next LIVE change history</h2><p className="text-sm text-[#B7C1CE]">Selected adjustments saved on the destination plan. Date filters use when that plan was created; show state applies to session summaries above. A selected change is not proof of an improved outcome.</p>{intelligence.nextLive.length > 0 ? <ul className="space-y-4">{intelligence.nextLive.map((n) => <li key={n.destinationId} className="border-t border-[#2A303A] pt-3 break-words"><EnvironmentBadge environment={n.environment} size="sm" /><p className="mt-2">From {n.sessionTitle} → <Link className="text-[#DFFF00] underline" href={`/live/${n.destinationId}/${n.lifecycle === "ended" ? "review" : n.lifecycle === "active" ? "operate" : "prepare"}`}>{n.destinationTitle}</Link></p><p className="text-sm text-[#B7C1CE]">{date(n.createdAtMs)} · {n.lifecycle} · source baseline {n.planVersionId}</p>{n.appliedChanges.length > 0 ? <ul className="list-disc pl-5 mt-2">{n.appliedChanges.map((c) => <li key={c.id}>{c.summary}</li>)}</ul> : <p>No adjustments selected; copied baseline.</p>}{n.changeNote && <p className="mt-2">Operator change note: {n.changeNote}</p>}</li>)}</ul> : <p>No saved Next LIVE plans in this selection. Unselected suggestions are not counted as changes.</p>}</section>
    </>}
    <section className={panel} aria-labelledby="provider-title"><h2 id="provider-title" className="text-xl font-medium">Provider analytics</h2><p className="mt-2 text-[#B7C1CE]">Unavailable: no provider-observed TikTok Shop / LIVE metrics are supplied to Insights. Account connection does not supply show performance analytics. Views, GMV, CTR, conversion, engagement, and sales remain unavailable.</p></section>
  </div></StandardShell>;
}
