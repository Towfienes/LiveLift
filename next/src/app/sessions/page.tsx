"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { Button, EnvironmentBadge, StatusLabel } from "@/components/ui";
import { baselinePlan, formatClock, formatDay } from "@/lib/domain";
import { useSessions } from "@/lib/store/hooks";

function primaryAction(s: Session): { href: string; label: string; variant: "primary" | "secondary" | "ghost" } {
  if (s.lifecycle === "active") return { href: `/live/${s.id}/operate`, label: "Continue LIVE", variant: "primary" };
  if (s.lifecycle === "ended") return { href: `/live/${s.id}/review`, label: "Open Review", variant: "secondary" };
  return { href: `/live/${s.id}/prepare`, label: "Open Prepare", variant: "ghost" };
}

export default function SessionsPage(): React.ReactElement {
  const { hydrated, sessions } = useSessions();
  const [search, setSearch] = useState("");
  const [lifecycle, setLifecycle] = useState("all");
  const [environment, setEnvironment] = useState("all");

  const filtered = useMemo(
    () =>
      sessions
        .filter((s) => (search ? s.title.toLowerCase().includes(search.toLowerCase()) : true))
        .filter((s) => (lifecycle === "all" ? true : s.lifecycle === lifecycle))
        .filter((s) => (environment === "all" ? true : s.environment === environment))
        .sort((a, b) => (a.environment === b.environment ? b.updatedAtMs - a.updatedAtMs : a.environment === "REAL" ? -1 : 1)),
    [sessions, search, lifecycle, environment]
  );

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1240px] mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[34px] font-medium tracking-tight text-[#F5F7FC]">Sessions</h1>
            <p className="text-[16px] text-[#B7C1CE] mt-1">Find the plan, operating desk, or review you need. Shows live in this browser only.</p>
          </div>
          <Link href="/live/new">
            <Button variant="primary" icon="ri-add-line">Create LIVE</Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 flex-wrap p-3 rounded-[10px] bg-[#13161C]">
          <div className="relative flex-1 min-w-[240px]">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#8A95A5]" aria-hidden="true" />
            <label htmlFor="session-search" className="sr-only">Find a session</label>
            <input
              id="session-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a session…"
              className="w-full h-11 bg-[#1B1F27] border border-[#2F3642] rounded-[8px] pl-9 pr-3 text-[15px] text-[#F5F7FC] placeholder-[#8A95A5]"
            />
          </div>
          <label className="sr-only" htmlFor="lifecycle-filter">Lifecycle</label>
          <select id="lifecycle-filter" value={lifecycle} onChange={(e) => setLifecycle(e.target.value)} className="h-11 bg-[#1B1F27] border border-[#2F3642] rounded-[8px] px-3 text-[14px] text-[#CAD0DA]">
            <option value="all">All lifecycles</option>
            <option value="planned">Prepared</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
          <label className="sr-only" htmlFor="environment-filter">Environment</label>
          <select id="environment-filter" value={environment} onChange={(e) => setEnvironment(e.target.value)} className="h-11 bg-[#1B1F27] border border-[#2F3642] rounded-[8px] px-3 text-[14px] text-[#CAD0DA]">
            <option value="all">All environments</option>
            <option value="REAL">REAL</option>
            <option value="SIMULATED">SIMULATED</option>
          </select>
        </div>

        <div className="rounded-[12px] bg-[#13161C] overflow-hidden" data-testid="sessions-table">
          {!hydrated ? (
            <p className="p-6 text-[#9AA5B5]" role="status">Loading shows…</p>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center" data-testid="sessions-empty">
              <i className="ri-stack-line text-[28px] text-[#8A95A5]" aria-hidden="true" />
              <h2 className="text-[22px] font-medium text-[#F5F7FC] mt-2">{sessions.length === 0 ? "Make your first rundown" : "No sessions match"}</h2>
              <p className="text-[15px] text-[#B7C1CE] mt-1">Real shows and simulated rehearsals will appear here.</p>
              <Link href="/live/new" className="inline-block mt-4">
                <Button variant="primary">Create LIVE</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#101319] text-[13px] tracking-[1.2px] uppercase text-[#AEB7C5]">
                    <th className="py-3 px-5 font-normal">Session</th>
                    <th className="py-3 px-4 font-normal">Environment</th>
                    <th className="py-3 px-4 font-normal">Planned start</th>
                    <th className="py-3 px-4 font-normal">Lifecycle</th>
                    <th className="py-3 px-5 font-normal text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202632] text-[15px]">
                  {filtered.map((s) => {
                    const action = primaryAction(s);
                    const start = baselinePlan(s).plannedStartMs;
                    return (
                      <tr key={s.id} className="hover:bg-[#181C24] transition-colors" data-testid={`session-row-${s.id}`}>
                        <td className="py-4 px-5">
                          <div className="font-medium text-[#F5F7FC]">{s.title}</div>
                          {s.derivedFrom && (
                            <div className="text-[13px] text-[#9AA5B5] mt-0.5">
                              planned from {s.derivedFrom.sessionTitle}
                              {s.derivedFrom.appliedChanges.length > 0 ? ` · ${s.derivedFrom.appliedChanges.length} change${s.derivedFrom.appliedChanges.length === 1 ? "" : "s"}` : ""}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4"><EnvironmentBadge environment={s.environment} size="sm" /></td>
                        <td className="py-4 px-4 text-[14px] text-[#CAD0DA] tabular-nums">
                          {formatDay(start, s.timezone)} · {formatClock(start, s.timezone)}
                          <div className="text-[12px] text-[#9AA5B5]">{s.timezone}</div>
                        </td>
                        <td className="py-4 px-4">
                          <StatusLabel status={s.lifecycle === "active" ? "tracking_active" : s.lifecycle === "planned" ? "planned" : "ended"} />
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={action.href}>
                              <Button variant={action.variant} size="sm" icon="ri-arrow-right-line">{action.label}</Button>
                            </Link>
                            <Link href={`/live/new?from=${encodeURIComponent(s.id)}`} aria-label={`Duplicate ${s.title} into a new show`} title="Duplicate the baseline plan into a new show">
                              <Button variant="ghost" size="sm" aria-label={`Duplicate ${s.title}`}>
                                <i className="ri-file-copy-line text-[16px]" aria-hidden="true" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </StandardShell>
  );
}
