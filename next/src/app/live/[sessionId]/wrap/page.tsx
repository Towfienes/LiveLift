"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { StandardShell, SessionContextBar } from "@/components/shell";
import { Button } from "@/components/ui";
import { RuntimeSnapshot, UnsyncedDraft } from "@/contracts";
import { simulator } from "@/lib/simulator/simulatorEngine";
import { draftStore } from "@/lib/storage/draftStore";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function WrapPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [drafts, setDrafts] = useState<UnsyncedDraft[]>([]);
  const [wrapNote, setWrapNote] = useState("");

  useEffect(() => {
    let snap = simulator.getSnapshot(sessionId);
    if (!snap) {
      snap = simulator.getSnapshot("session_collection_launch");
    }
    setSnapshot(snap);
    setDrafts(draftStore.getDrafts(sessionId));
  }, [sessionId]);

  if (!snapshot) {
    return (
      <StandardShell>
        <div className="flex-1 flex items-center justify-center p-12 text-[#8A95A5]">
          Loading wrap summary...
        </div>
      </StandardShell>
    );
  }

  const { session, segments, currentSegment } = snapshot;

  const handleConfirmDraftSubmission = (draftId: string) => {
    draftStore.confirmDraft(draftId);
    setDrafts([...draftStore.getDrafts(sessionId)]);
  };

  return (
    <StandardShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#090B0F]">
        <SessionContextBar
          eyebrow="Wrap"
          title={session.title}
          environment={session.environment}
          metaText="Tracking ended · 44:18 tracked duration"
          rightAction={
            <Link href={`/live/${session.id}/review`}>
              <Button variant="primary" size="md" icon="ri-arrow-right-line" data-testid="wrap-open-review-btn">
                Open Review
              </Button>
            </Link>
          }
        />

        <div className="flex-1 overflow-y-auto max-w-[960px] w-full mx-auto px-6 py-8 space-y-6">
          {/* Summary Card */}
          <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-6 space-y-4">
            <h2 className="text-[22px] font-medium text-[#F5F7FC]">
              Runtime summary
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 border-y border-[#202632]">
              <div>
                <p className="text-[13px] font-mono uppercase text-[#AEB7C5]">Tracked duration</p>
                <p className="text-[26px] font-medium text-[#F5F7FC] tabular-nums mt-0.5">
                  44:18
                </p>
                <p className="text-[13px] text-[#8A95A5]">20:00:00 – 20:44:18</p>
              </div>

              <div>
                <p className="text-[13px] font-mono uppercase text-[#AEB7C5]">Last active segment</p>
                <p className="text-[18px] font-medium text-[#F5F7FC] mt-1 truncate">
                  {currentSegment?.title || segments[segments.length - 1]?.title || "Closing"}
                </p>
                <p className="text-[13px] text-[#8A95A5]">Closed when tracking ended</p>
              </div>

              <div>
                <p className="text-[13px] font-mono uppercase text-[#AEB7C5]">Lead operator</p>
                <p className="text-[18px] font-medium text-[#F5F7FC] mt-1">
                  {session.leadOperator.name}
                </p>
                <p className="text-[13px] text-[#8A95A5]">Authority preserved</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-[#CAD0DA]">Optional provider evidence</span>
                <span className="text-[#FFB800] font-medium">Pending platform post-LIVE processing</span>
              </div>
              <p className="text-[13px] text-[#8A95A5]">
                Review remains accessible while optional platform evidence is pending.
              </p>
            </div>
          </div>

          {/* Unsynced Drafts Reconcile Section */}
          {drafts.length > 0 && (
            <div className="rounded-[12px] bg-[#1B1926] border border-[#413158] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <i className="ri-draft-line text-[#FFB800] text-[20px]" />
                <h3 className="text-[20px] font-medium text-[#FFD580]">
                  Device-local unsynced drafts ({drafts.length})
                </h3>
              </div>
              <p className="text-[14px] text-[#CAD0DA]">
                These reports were captured locally during disconnection. They will NOT enter server replay history until explicitly confirmed:
              </p>

              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="p-3.5 rounded-[8px] bg-[#14121C] border border-[#342749] flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-[15px] font-medium text-[#F5F7FC]">{draft.assertion}</p>
                      <p className="text-[12px] text-[#AEB7C5]">Captured at {new Date(draft.capturedAt).toLocaleTimeString()}</p>
                    </div>

                    <Button
                      variant={draft.confirmedForSubmission ? "ghost" : "primary"}
                      size="sm"
                      disabled={draft.confirmedForSubmission}
                      onClick={() => handleConfirmDraftSubmission(draft.id)}
                    >
                      {draft.confirmedForSubmission ? "Confirmed" : "Confirm to Submit"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Wrap Note */}
          <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-6 space-y-3">
            <h3 className="text-[18px] font-medium text-[#F5F7FC]">
              Session wrap note (optional)
            </h3>
            <textarea
              rows={3}
              value={wrapNote}
              onChange={(e) => setWrapNote(e.target.value)}
              placeholder="e.g. Host requested earlier sizing cues for future apparel drops."
              className="w-full bg-[#1B1F27] border border-[#39414D] rounded-[8px] p-3 text-[15px] text-[#F5F7FC] placeholder-[#8A95A5]"
            />
          </div>

          {/* Next Steps Buttons */}
          <div className="flex items-center justify-between pt-4">
            <Link href="/">
              <Button variant="ghost" size="md">
                Finish later
              </Button>
            </Link>

            <Link href={`/live/${session.id}/review`}>
              <Button variant="primary" size="lg" icon="ri-arrow-right-line" data-testid="wrap-proceed-review-btn">
                Open Review
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </StandardShell>
  );
}
