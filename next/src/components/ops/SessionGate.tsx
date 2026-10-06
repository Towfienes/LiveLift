"use client";

import React from "react";
import Link from "next/link";
import type { Session } from "@/contracts";
import { StandardShell } from "@/components/shell";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/store/hooks";

/**
 * Resolves a show by its exact id. Unknown ids get a real not-found state — they never fall
 * back to some other show — and nothing renders as "empty" before the stored data has loaded.
 */
export function SessionGate({
  id,
  children,
}: {
  id: string;
  children: (session: Session) => React.ReactNode;
}): React.ReactElement {
  const lookup = useSession(id);

  if (lookup.status === "loading") {
    return (
      <StandardShell>
        <div className="flex-1 flex items-center justify-center p-12" role="status">
          <p className="text-[18px] text-[#9AA5B5]">Loading show…</p>
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
            No show with the id <span className="font-mono text-[#F5F7FC]">{id}</span> exists on this device. Shows are stored in
            this browser only; they are not shared with other browsers or devices.
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

  return <>{children(lookup.session)}</>;
}
