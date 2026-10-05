"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { EnvironmentBadge, StatusLabel, Button } from "@/components/ui";
import { SessionIdentity } from "@/contracts";
import { simulator } from "@/lib/simulator/simulatorEngine";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionIdentity[]>([]);
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");

  useEffect(() => {
    setSessions(simulator.listSessions());
  }, []);

  const filteredSessions = sessions.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (lifecycleFilter !== "all" && s.lifecycle !== lifecycleFilter) {
      return false;
    }
    if (envFilter !== "all" && s.environment !== envFilter) {
      return false;
    }
    return true;
  });

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1240px] mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[34px] font-medium tracking-tight text-[#F5F7FC]">
              Sessions
            </h1>
            <p className="text-[16px] text-[#B7C1CE] mt-1">
              Find, resume, review, or clone your livestream sessions.
            </p>
          </div>

          <Link href="/live/new">
            <Button variant="primary" icon="ri-add-line">
              Create LIVE
            </Button>
          </Link>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-[10px] bg-[#13161C] border border-[#232935]">
          <div className="relative flex-1 min-w-[240px]">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#8A95A5]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions by title..."
              className="w-full h-10 bg-[#1B1F27] border border-[#2F3642] rounded-[6px] pl-9 pr-3 text-[15px] text-[#F5F7FC] placeholder-[#8A95A5]"
            />
          </div>

          {/* Lifecycle filter */}
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value)}
            className="h-10 bg-[#1B1F27] border border-[#2F3642] rounded-[6px] px-3 text-[14px] text-[#CAD0DA]"
          >
            <option value="all">All Lifecycles</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>

          {/* Environment filter */}
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="h-10 bg-[#1B1F27] border border-[#2F3642] rounded-[6px] px-3 text-[14px] text-[#CAD0DA]"
          >
            <option value="all">All Environments</option>
            <option value="REAL">REAL</option>
            <option value="SIMULATED">SIMULATED</option>
          </select>
        </div>

        {/* Sessions Table */}
        <div className="rounded-[12px] bg-[#13161C] border border-[#232935] overflow-hidden" data-testid="sessions-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232935] bg-[#101319] text-[13px] font-mono uppercase text-[#AEB7C5]">
                  <th className="py-3 px-5">Session</th>
                  <th className="py-3 px-4">Environment</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Lifecycle</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202632] text-[15px]">
                {filteredSessions.map((s) => {
                  let actionUrl = `/live/${s.id}/prepare`;
                  let actionLabel = "Open Prepare";
                  let actionVariant: "primary" | "secondary" | "ghost" = "ghost";

                  if (s.lifecycle === "active") {
                    actionUrl = `/live/${s.id}/operate`;
                    actionLabel = "Continue LIVE";
                    actionVariant = "primary";
                  } else if (s.lifecycle === "ended") {
                    actionUrl = `/live/${s.id}/review`;
                    actionLabel = "Open Review";
                    actionVariant = "secondary";
                  }

                  return (
                    <tr key={s.id} className="hover:bg-[#181C24] transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-medium text-[#F5F7FC]">{s.title}</div>
                        {s.objective && (
                          <div className="text-[13px] text-[#8A95A5] mt-0.5 truncate max-w-[360px]">
                            {s.objective}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <EnvironmentBadge environment={s.environment} size="sm" />
                      </td>
                      <td className="py-4 px-4 font-mono text-[14px] text-[#CAD0DA]">
                        {s.scheduledAt ? "Oct 3, 2026 · 20:00" : "Unscheduled"}
                        <div className="text-[12px] text-[#8A95A5]">{s.timezone}</div>
                      </td>
                      <td className="py-4 px-4">
                        <StatusLabel status={s.lifecycle === "active" ? "tracking_active" : s.lifecycle} />
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={actionUrl}>
                            <Button variant={actionVariant} size="sm" icon="ri-arrow-right-line">
                              {actionLabel}
                            </Button>
                          </Link>

                          <Link href={`/live/new`}>
                            <Button variant="ghost" size="sm" title="Clone into new LIVE">
                              <i className="ri-file-copy-line text-[16px]" />
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
        </div>
      </div>
    </StandardShell>
  );
}
