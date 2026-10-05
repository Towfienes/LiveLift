"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { simulator } from "@/lib/simulator/simulatorEngine";

type StartingPoint = "blank" | "saved_pack" | "clone";

export default function CreateLivePage() {
  const router = useRouter();
  const [title, setTitle] = useState("October collection · Evening LIVE");
  const [startingPoint, setStartingPoint] = useState<StartingPoint>("blank");
  const [schedule, setSchedule] = useState("Oct 3, 2026 · 20:00");
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [objective, setObjective] = useState("");
  const [showObjective, setShowObjective] = useState(false);
  const [account, setAccount] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const session = simulator.createSession({
      title: title.trim(),
      scheduledAt: schedule || null,
      timezone: timezone.trim(),
      objective: objective.trim() || null,
      accountAssociation: account.trim() || null,
      environment: isSimulated ? "SIMULATED" : "REAL",
      startingPoint,
      sourceSessionId: startingPoint === "clone" ? "session_collection_launch" : undefined,
    });

    router.push(`/live/${session.id}/prepare`);
  };

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1040px] mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[34px] leading-[1.2] font-medium tracking-[-0.6px] text-[#F5F7FC]">
              Create LIVE
            </h1>
            <p className="text-[16px] leading-6 text-[#B7C1CE] mt-1.5">
              Start small. You can refine everything in Prepare.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className={`grid ${startingPoint === "clone" ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"} gap-8`}>
            {/* Form Fields */}
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="session-title" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">
                  Session title <span className="text-[#FF5C5C]">*</span>
                </label>
                <input
                  id="session-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. October collection · Evening LIVE"
                  className="w-full h-[48px] bg-[#1B1F27] border border-[#39414D] rounded-[8px] px-4 text-[17px] text-[#F5F7FC] placeholder-[#8A95A5] focus:border-[#DFFF00] focus:ring-1 focus:ring-[#DFFF00]"
                />
              </div>

              {/* Starting Point Selection */}
              <div>
                <p className="text-[13px] font-semibold tracking-[1.5px] uppercase text-[#AEB7C5] mb-3">
                  STARTING POINT
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Blank */}
                  <div
                    onClick={() => setStartingPoint("blank")}
                    className={`rounded-[12px] p-4 space-y-2.5 cursor-pointer transition-all border ${
                      startingPoint === "blank"
                        ? "bg-[#1B1F27] border-[#DFFF00]"
                        : "bg-[#13161C] border-[#2A303A] hover:bg-[#1A1E26]"
                    }`}
                  >
                    <div className="w-[44px] h-[44px] bg-[#2B313C] rounded-[8px] flex items-center justify-center text-[#DFFF00]">
                      <i className="ri-file-add-line text-[22px]" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-medium text-[#F5F7FC]">Blank</h3>
                      <p className="text-[14px] text-[#B7C1CE]">A clean rundown</p>
                    </div>
                  </div>

                  {/* Saved Pack */}
                  <div
                    onClick={() => setStartingPoint("saved_pack")}
                    className={`rounded-[12px] p-4 space-y-2.5 cursor-pointer transition-all border ${
                      startingPoint === "saved_pack"
                        ? "bg-[#1B1F27] border-[#DFFF00]"
                        : "bg-[#13161C] border-[#2A303A] hover:bg-[#1A1E26]"
                    }`}
                  >
                    <div className="w-[44px] h-[44px] bg-[#2A303B] rounded-[8px] border border-[#373F4D] flex flex-col items-center justify-center">
                      <span className="text-[17px] font-medium text-[#D2D9E4]">CP</span>
                      <span className="text-[10px] font-mono text-[#AFB8C7]">M03</span>
                    </div>
                    <div>
                      <h3 className="text-[18px] font-medium text-[#F5F7FC]">Saved Pack</h3>
                      <p className="text-[14px] text-[#B7C1CE]">Reuse a product lineup</p>
                    </div>
                  </div>

                  {/* Previous Session */}
                  <div
                    onClick={() => setStartingPoint("clone")}
                    className={`rounded-[12px] p-4 space-y-2.5 cursor-pointer transition-all border ${
                      startingPoint === "clone"
                        ? "bg-[#1B1F27] border-[#DFFF00]"
                        : "bg-[#13161C] border-[#2A303A] hover:bg-[#1A1E26]"
                    }`}
                  >
                    <div className="w-[44px] h-[44px] bg-[#2A303B] rounded-[8px] border border-[#373F4D] flex flex-col items-center justify-center">
                      <span className="text-[17px] font-medium text-[#D2D9E4]">ZH</span>
                      <span className="text-[10px] font-mono text-[#AFB8C7]">M02</span>
                    </div>
                    <div>
                      <h3 className="text-[18px] font-medium text-[#F5F7FC]">Previous Session</h3>
                      <p className="text-[14px] text-[#B7C1CE]">Carry the plan forward</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule and Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="session-schedule" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">
                    Schedule (optional)
                  </label>
                  <input
                    id="session-schedule"
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="e.g. Oct 3, 2026 · 20:00"
                    className="w-full h-[48px] bg-[#1B1F27] border border-[#39414D] rounded-[8px] px-4 text-[16px] text-[#F5F7FC] focus:border-[#DFFF00]"
                  />
                </div>

                <div>
                  <label htmlFor="session-timezone" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">
                    Timezone
                  </label>
                  <input
                    id="session-timezone"
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full h-[48px] bg-[#1B1F27] border border-[#39414D] rounded-[8px] px-4 text-[16px] text-[#F5F7FC] focus:border-[#DFFF00]"
                  />
                </div>
              </div>

              {/* Optional Disclosure Buttons */}
              <div className="flex flex-wrap gap-4 pt-1">
                {!showObjective && (
                  <button
                    type="button"
                    onClick={() => setShowObjective(true)}
                    className="text-[15px] text-[#CAD0DA] hover:text-[#DFFF00] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="ri-add-line" aria-hidden="true" />
                    <span>Add an objective</span>
                  </button>
                )}

                {!showAccount && (
                  <button
                    type="button"
                    onClick={() => setShowAccount(true)}
                    className="text-[15px] text-[#CAD0DA] hover:text-[#DFFF00] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="ri-add-line" aria-hidden="true" />
                    <span>Associate an account (optional)</span>
                  </button>
                )}
              </div>

              {/* Objective disclosure */}
              {showObjective && (
                <div>
                  <label htmlFor="session-obj" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">
                    Session objective
                  </label>
                  <input
                    id="session-obj"
                    type="text"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="e.g. Launch fall line and highlight size guide"
                    className="w-full h-[48px] bg-[#1B1F27] border border-[#39414D] rounded-[8px] px-4 text-[16px] text-[#F5F7FC]"
                  />
                </div>
              )}

              {/* Account association disclosure */}
              {showAccount && (
                <div>
                  <label htmlFor="session-acc" className="block text-[15px] font-medium text-[#CAD0DA] mb-2">
                    Provider account / room binding
                  </label>
                  <input
                    id="session-acc"
                    type="text"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    placeholder="e.g. @livelift.shop · Room 8412"
                    className="w-full h-[48px] bg-[#1B1F27] border border-[#39414D] rounded-[8px] px-4 text-[16px] text-[#F5F7FC]"
                  />
                </div>
              )}

              {/* Environment choice: REAL default vs SIMULATED */}
              <div className="pt-2 border-t border-[#232935]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSimulated}
                    onChange={(e) => setIsSimulated(e.target.checked)}
                    className="w-5 h-5 rounded border-[#39414D] bg-[#1B1F27] text-[#DFFF00] accent-[#DFFF00]"
                  />
                  <span className="text-[16px] font-medium text-[#F5F7FC]">
                    Create as SIMULATED rehearsal
                  </span>
                </label>
                <p className="text-[14px] text-[#B7C1CE] mt-1.5 ml-8">
                  REAL is the default. Manual operation can coexist with any available provider capabilities.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  icon="ri-arrow-right-line"
                  disabled={isSubmitting || !title.trim()}
                  data-testid="submit-create-live-btn"
                >
                  Create LIVE
                </Button>

                <Link href="/">
                  <Button variant="ghost" size="lg">
                    Cancel
                  </Button>
                </Link>
              </div>
            </div>

            {/* Optional Clone Preview Panel */}
            {startingPoint === "clone" && (
              <div className="rounded-[12px] bg-[#13161C] border border-[#2B3240] p-5 space-y-4">
                <h3 className="text-[18px] font-medium text-[#F5F7FC] border-b border-[#232935] pb-2">
                  Clone preview
                </h3>
                <div>
                  <p className="text-[13px] font-mono uppercase text-[#AEB7C5]">Source Session</p>
                  <p className="text-[15px] font-medium text-[#F5F7FC]">Collection launch</p>
                  <p className="text-[13px] text-[#8A95A5]">7 products · 7 segments</p>
                </div>

                <div>
                  <p className="text-[13px] font-mono uppercase text-[#AEB7C5]">Carry forward</p>
                  <ul className="text-[14px] text-[#CAD0DA] list-disc list-inside space-y-1 mt-1">
                    <li>Product pack snapshot</li>
                    <li>Rundown structure</li>
                    <li>2 accepted lessons from Review</li>
                  </ul>
                </div>

                <div className="pt-2 text-[13px] text-[#8A95A5] border-t border-[#232935]">
                  Historical runtime timestamps and platform evidence are not copied.
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </StandardShell>
  );
}
