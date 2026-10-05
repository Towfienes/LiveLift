"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { EnvironmentBadge, StatusLabel, Button } from "@/components/ui";
import { SessionIdentity } from "@/contracts";
import { simulator } from "@/lib/simulator/simulatorEngine";

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionIdentity[]>([]);
  const [activeSession, setActiveSession] = useState<SessionIdentity | null>(null);

  useEffect(() => {
    const list = simulator.listSessions();
    setSessions(list);
    const active = list.find((s) => s.lifecycle === "active") || null;
    setActiveSession(active);
  }, []);

  const preparedSessions = sessions.filter((s) => s.lifecycle === "planned");
  const endedSessions = sessions.filter((s) => s.lifecycle === "ended");

  return (
    <StandardShell
      activeSessionId={activeSession?.id}
      activeSessionTitle={activeSession?.title}
    >
      <div className="flex-1 overflow-y-auto w-full max-w-[1160px] mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[34px] leading-[1.2] font-medium tracking-[-0.6px] text-[#F5F7FC]">
              Home
            </h1>
            <p className="text-[16px] leading-6 text-[#B7C1CE] mt-1.5">
              Your next useful action, in one place.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/live/new">
              <Button variant="ghost" icon="ri-add-line">
                Create LIVE
              </Button>
            </Link>
          </div>
        </div>

        {/* Priority 1: Active LIVE Session */}
        {activeSession ? (
          <div className="mt-8 rounded-[12px] bg-[#1B1F27] border border-[#2B3240] p-6 lg:p-7 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] leading-5 font-semibold tracking-[1.7px] text-[#DFFF00] uppercase">
                ACTIVE LIVE
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 text-[15px] font-medium text-[#DFFF00]">
                  <i className="ri-record-circle-line animate-pulse" aria-hidden="true" />
                  <span>{activeSession.environment} · Tracking active</span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-6 mt-5 flex-wrap md:flex-nowrap">
              <div className="flex gap-4 items-center min-w-0">
                <div
                  className="w-[80px] h-[80px] shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center gap-0.5 select-none"
                  aria-hidden="true"
                >
                  <span className="text-[26px] font-medium text-[#D2D9E4]">ZH</span>
                  <span className="text-[13px] font-mono text-[#AFB8C7]">M02</span>
                </div>

                <div className="min-w-0">
                  <p className="text-[14px] font-mono text-[#B7C1CE]">M02</p>
                  <h2 className="text-[24px] font-medium tracking-[-0.6px] text-[#F5F7FC] truncate">
                    {activeSession.title}
                  </h2>
                  <p className="text-[15px] leading-5 text-[#C8CDD6] mt-1">
                    Current segment · M02 Zip Hoodie
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[40px] font-medium tracking-tight text-[#F5F7FC] tabular-nums">
                  17:45
                </div>
                <p className="text-[14px] text-[#B7C1CE] mt-0.5">
                  {activeSession.leadOperator.name} is Lead
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-[#262C38] flex-wrap">
              <p className="text-[15px] text-[#C8CDD6]">
                Manual operation available · Realtime unavailable
              </p>

              <Link href={`/live/${activeSession.id}/operate`}>
                <Button
                  variant="primary"
                  size="lg"
                  icon="ri-arrow-right-line"
                  data-testid="continue-live-btn"
                >
                  Continue LIVE
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* First Run / Empty Guidance State */
          <div className="mt-8 rounded-[12px] bg-[#13161C] border border-[#2A303A] p-8">
            <span className="text-[14px] font-semibold tracking-[1.7px] text-[#DFFF00] uppercase">
              YOUR NEXT LIVE
            </span>
            <h2 className="text-[34px] leading-tight font-medium tracking-[-0.6px] text-[#F5F7FC] mt-3">
              Plan the show.
              <br />
              Stay in control.
            </h2>
            <p className="text-[17px] leading-relaxed text-[#CAD0DA] mt-3 max-w-[620px]">
              A Product Pack, a Run of Show, and an operating desk that works with or without integrations.
            </p>

            <div className="flex items-center gap-4 mt-6">
              <Link href="/live/new">
                <Button variant="primary" size="lg" icon="ri-add-line">
                  Create LIVE
                </Button>
              </Link>

              <Link href="/live/session_fall_rehearsal_sim/prepare">
                <Button variant="ghost" size="lg" icon="ri-flask-line">
                  Try Simulator
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Supporting Work Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          {/* Column 1: Prepared for next */}
          <div>
            <h2 className="text-[22px] font-medium tracking-[-0.5px] text-[#F5F7FC] mb-2">
              Prepared for next
            </h2>

            {preparedSessions.length > 0 ? (
              <div className="divide-y divide-[#232935]">
                {preparedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="flex gap-3.5 items-center min-w-0">
                      <div className="w-[50px] h-[50px] shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[20px] font-medium text-[#D2D9E4]">
                          {session.id.includes("fall") ? "ZH" : "CP"}
                        </span>
                        <span className="text-[11px] font-mono text-[#AFB8C7]">
                          {session.id.includes("fall") ? "M02" : "M03"}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-[18px] font-medium text-[#F5F7FC] truncate">
                          {session.title}
                        </h3>
                        <p className="text-[14px] text-[#B7C1CE] mt-0.5">
                          {session.scheduledAt
                            ? "Oct 5 · 19:00 · Asia/Ho_Chi_Minh"
                            : "No scheduled time"}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <EnvironmentBadge environment={session.environment} size="sm" />
                          <StatusLabel status="planned" />
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Link href={`/live/${session.id}/prepare`}>
                        <Button variant="ghost" size="sm" icon="ri-arrow-right-line">
                          Open Prepare
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[15px] text-[#8A95A5] py-4">No prepared sessions.</p>
            )}
          </div>

          {/* Column 2: Specific Unfinished Tasks */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-[22px] font-medium tracking-[-0.5px] text-[#F5F7FC]">
                Finish the review
              </h2>
              <Link
                href="/sessions"
                className="text-[15px] text-[#CAD0DA] hover:text-[#DFFF00] inline-flex items-center gap-1 transition-colors"
              >
                <span>All sessions</span>
                <i className="ri-arrow-right-line" aria-hidden="true" />
              </Link>
            </div>

            <div className="divide-y divide-[#232935]">
              {endedSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="flex gap-3.5 items-center min-w-0">
                    <div className="w-[50px] h-[50px] shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center gap-0.5">
                      <span className="text-[20px] font-medium text-[#D2D9E4]">ZH</span>
                      <span className="text-[11px] font-mono text-[#AFB8C7]">M02</span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-[18px] font-medium text-[#F5F7FC] truncate">
                        {session.title}
                      </h3>
                      <p className="text-[14px] text-[#B7C1CE] mt-0.5">
                        Oct 2 · 1 action outcome unknown
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <EnvironmentBadge environment={session.environment} size="sm" />
                        <span className="inline-flex items-center gap-1.5 text-[14px] text-[#C8CDD6]">
                          <i className="ri-time-line" aria-hidden="true" />
                          <span>Ended</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Link href={`/live/${session.id}/review`}>
                      <Button variant="ghost" size="sm" icon="ri-arrow-right-line">
                        Open Review
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}

              {/* Task item */}
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <h3 className="text-[18px] font-medium text-[#F5F7FC] truncate">
                    Basics LIVE
                  </h3>
                  <p className="text-[15px] text-[#B7C1CE] mt-1">
                    2 proposed next-live changes need a decision.
                  </p>
                </div>
                <div className="shrink-0">
                  <Link href="/live/session_collection_launch/review?view=learn">
                    <Button variant="ghost" size="sm" icon="ri-arrow-right-line">
                      Review changes
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Guidance section */}
        <div className="mt-12 rounded-[12px] bg-[#101319] border border-[#232935] p-6">
          <h3 className="text-[20px] font-medium text-[#F5F7FC]">
            Nothing to connect before you begin
          </h3>
          <p className="text-[15px] text-[#B7C1CE] mt-2 max-w-[700px]">
            Start blank, choose a saved pack, or rehearse a simulated session.
            Manual operation is always available alongside optional integrations.
          </p>
        </div>
      </div>
    </StandardShell>
  );
}
