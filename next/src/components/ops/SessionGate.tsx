"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Session } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { remoteRoomStore } from "@/lib/store/remoteRoomStore";
import { useRemoteState, useSession, type SessionSource } from "@/lib/store/hooks";

export interface GateContext {
  /** Where this show's authority lives. REAL shows are "remote"; rehearsals and the local archive are "local". */
  source: SessionSource;
  /** A pre-Phase-2 REAL show kept in this browser: history only. */
  archive: boolean;
}

/**
 * Resolves a show by its exact id. Unknown ids get a real not-found state — they never fall
 * back to some other show — and nothing renders as "empty" before the data has loaded. A REAL id
 * is never reported "not found" while the room cannot be asked: that is "unavailable", not "missing".
 *
 * `?archive=1` selects a pre-Phase-2 REAL show from this browser. Those open read-only and only where
 * `allowArchive` is set (Review); everywhere else they explain what they are.
 */
export function SessionGate(props: {
  id: string;
  allowArchive?: boolean;
  children: (session: Session, ctx: GateContext) => React.ReactNode;
}): React.ReactElement {
  return (
    <Suspense fallback={<GateMessage busy>Loading show…</GateMessage>}>
      <Gate {...props} />
    </Suspense>
  );
}

function GateMessage({ children, busy = false }: { children: React.ReactNode; busy?: boolean }): React.ReactElement {
  return (
    <StandardShell>
      <div className="flex-1 flex items-center justify-center p-12" role={busy ? "status" : undefined}>
        <p className="text-[18px] text-[#9AA5B5]">{children}</p>
      </div>
    </StandardShell>
  );
}

function Gate({
  id,
  allowArchive = false,
  children,
}: {
  id: string;
  allowArchive?: boolean;
  children: (session: Session, ctx: GateContext) => React.ReactNode;
}): React.ReactElement {
  const params = useSearchParams();
  const archive = params.get("archive") === "1";
  const lookup = useSession(id, { archive });
  const auth = useRemoteState().auth;

  if (lookup.status === "loading") return <GateMessage busy>Loading show…</GateMessage>;

  if (lookup.status === "unavailable") {
    return (
      <StandardShell>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="session-unavailable">
          <span className="text-[44px] text-[#F6C875]">
            <i className="ri-wifi-off-line" aria-hidden="true" />
          </span>
          <h1 className="text-[28px] font-medium text-[#F5F7FC] mt-4">
            {auth === "missing" ? "A room capability is needed" : auth === "rejected" ? "The room did not accept this capability" : "The room cannot be reached"}
          </h1>
          <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[560px]">
            REAL shows live in the shared room, and LiveLift {auth === "ok" || auth === "unknown" ? "cannot reach it right now" : "has no accepted capability for it"}, so it cannot tell you whether{" "}
            <span className="font-mono text-[#F5F7FC]">{id}</span> exists. {lookup.reason}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button variant="primary" onClick={() => void remoteRoomStore.refreshNow()}>
              Try again
            </Button>
            <Link href="/">
              <Button variant="ghost">Return home</Button>
            </Link>
          </div>
        </div>
      </StandardShell>
    );
  }

  if (lookup.status === "missing") {
    return (
      <StandardShell>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="session-not-found">
          <span className="text-[44px] text-[#DFFF00]">
            <i className="ri-error-warning-line" aria-hidden="true" />
          </span>
          <h1 className="text-[28px] font-medium text-[#F5F7FC] mt-4">Show not found</h1>
          <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[520px]">
            {archive ? (
              <>
                No archived show with the id <span className="font-mono text-[#F5F7FC]">{id}</span> exists in this browser.
              </>
            ) : (
              <>
                No show with the id <span className="font-mono text-[#F5F7FC]">{id}</span> exists in the shared room or among this browser&apos;s
                rehearsals.
              </>
            )}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link href="/sessions">
              <Button variant="primary">View all sessions</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Return home</Button>
            </Link>
          </div>
        </div>
      </StandardShell>
    );
  }

  if (lookup.archive && !allowArchive) {
    return (
      <StandardShell>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-testid="archive-readonly">
          <h1 className="text-[28px] font-medium text-[#F5F7FC]">Local archive · read-only</h1>
          <p className="text-[16px] text-[#B7C1CE] mt-2 max-w-[560px]">
            <strong className="text-[#F5F7FC]">{lookup.session.title}</strong> was recorded in this browser before LiveLift moved REAL shows to the
            shared room. It is kept as history only: it cannot be prepared, run or changed here, and it is not part of the room.
          </p>
          <Link href={`/live/${lookup.session.id}/review?archive=1`} className="mt-6">
            <Button variant="primary" icon="ri-arrow-right-line">
              View archived review
            </Button>
          </Link>
        </div>
      </StandardShell>
    );
  }

  return <>{children(lookup.session, { source: lookup.source, archive: lookup.archive })}</>;
}
