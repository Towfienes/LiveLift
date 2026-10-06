"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { clearCapability, getCapability, setCapability } from "@/lib/client/capability";
import { remoteRoomStore, type UnresolvedCommand } from "@/lib/store/remoteRoomStore";
import { useRemoteState } from "@/lib/store/hooks";

/**
 * What the operator needs to know about the shared room, and nothing more:
 * connecting · connected · stale · disconnected · waiting for confirmation · outcome unknown · read-only.
 * Everything here is silent for rehearsals (the room store is idle unless a REAL view is open).
 */

function useAgeSeconds(active: boolean): number | null {
  const [age, setAge] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = (): void => {
      const ms = remoteRoomStore.lastContactAgeMs();
      setAge(ms === null ? null : Math.round(ms / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return active ? age : null;
}

export function ConnectionChip({ size = "md" }: { size?: "md" | "desk" }): React.ReactElement | null {
  const remote = useRemoteState();
  const notCurrent = remote.connection === "stale" || remote.connection === "disconnected";
  const age = useAgeSeconds(notCurrent);
  if (!remote.active) return null;

  // The page header is tight below 1280px: there the chip is an icon (state, with the words kept for screen readers)
  // plus the role. The banner under the header says it all in full. The operating desk has the room and always spells it out.
  const text = size === "desk" ? "text-[16px]" : "text-[15px]";
  const words = size === "desk" ? "" : "sr-only xl:not-sr-only";
  const viewer = remote.access?.role === "viewer";
  let tone = "text-[#CAD0DA]";
  let icon = "ri-wifi-line";
  let label = "Connected";
  if (remote.connection === "connecting" || remote.connection === "idle") {
    icon = "ri-loader-4-line";
    label = "Connecting to room…";
  } else if (remote.connection === "stale") {
    tone = "text-[#F6C875]";
    icon = "ri-wifi-off-line";
    label = age !== null ? `Not current · last contact ${age}s ago` : "Not current";
  } else if (remote.connection === "disconnected") {
    tone = "text-[#F4A4A4]";
    icon = "ri-wifi-off-line";
    label = remote.auth === "missing" ? "Capability needed" : remote.auth === "rejected" ? "Capability not accepted" : "Disconnected";
  } else if (remote.inflight) {
    tone = "text-[#DFFF00]";
    icon = "ri-time-line";
    label = "Waiting for confirmation…";
  }
  const head = <span className={words}>{label}</span>;

  return (
    <span className={`inline-flex items-center gap-2 ${text} ${tone}`} data-testid="connection-chip" data-connection={remote.connection} title={remote.lastError ?? undefined}>
      <i className={icon} aria-hidden="true" />
      {head}
      {remote.connection === "connected" && remote.access && (
        <span
          className={`rounded-[6px] px-1.5 ${viewer ? "bg-[#2A2316] text-[#F6C875]" : "bg-[#242A22] text-[#DFFF00]"}`}
          data-testid="access-role"
          title={`Signed in to the room as ${remote.access.name}`}
        >
          {viewer ? "Viewer" : "Operator"}
          {viewer && <span className={words}> · read-only</span>}
        </span>
      )}
    </span>
  );
}

/**
 * The smallest way to give this browser a room capability: paste it. Not a login: no account, no role choice —
 * the room decides what the capability allows. The value is kept in this tab's session storage only.
 */
function CapabilityForm({ size }: { size: "md" | "desk" }): React.ReactElement {
  const [value, setValue] = useState("");
  const held = getCapability() !== null;
  return (
    <form
      className="flex items-center gap-2 shrink-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() === "") return;
        setCapability(value);
        setValue("");
      }}
      data-testid="capability-form"
    >
      <label className="sr-only" htmlFor="room-capability">
        Room capability
      </label>
      <input
        id="room-capability"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Room capability"
        className={`h-11 w-[240px] bg-[#13161C] border border-[#39414D] rounded-[8px] px-3 text-[#F5F7FC] ${size === "desk" ? "text-[16px]" : "text-[15px]"}`}
        data-testid="capability-input"
      />
      <Button type="submit" size="desk" variant="secondary" disabled={value.trim() === ""} data-testid="capability-connect-btn">
        Connect
      </Button>
      {held && (
        <Button type="button" size="desk" variant="ghost" onClick={() => clearCapability()} data-testid="capability-forget-btn">
          Forget
        </Button>
      )}
    </form>
  );
}

function UnresolvedBanner({ entry, size }: { entry: UnresolvedCommand; size: "md" | "desk" }): React.ReactElement {
  const text = size === "desk" ? "text-[16px]" : "text-[14px]";
  const busy = entry.lookup === "checking" || entry.retrying;
  return (
    <div
      role="alert"
      data-testid="outcome-unknown-banner"
      className={`rounded-[8px] px-3 py-2 ${text} flex items-center justify-between gap-3 flex-wrap bg-[#2A2316] text-[#F6C875]`}
    >
      <span className="min-w-0">
        <strong className="mr-1.5">OUTCOME UNKNOWN</strong>
        {entry.detail}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <Button size="desk" variant="secondary" disabled={busy} onClick={() => void remoteRoomStore.checkUnresolved()} data-testid="outcome-check-btn">
          Check status
        </Button>
        <Button size="desk" variant="secondary" disabled={busy} onClick={() => void remoteRoomStore.retryUnresolved(entry.commandId)} data-testid="outcome-retry-btn">
          Retry same action
        </Button>
        <Button size="desk" variant="ghost" disabled={busy} onClick={() => remoteRoomStore.dismissUnresolved(entry.commandId)} data-testid="outcome-dismiss-btn">
          Set aside
        </Button>
      </span>
    </div>
  );
}

/** Banners for lost contact, unresolved commands and their later resolutions. Renders nothing when all is well. */
export function RemoteBanners({ size = "md" }: { size?: "md" | "desk" }): React.ReactElement | null {
  const remote = useRemoteState();
  // Lost contact is only news while a REAL view is open; unresolved commands matter until they are settled.
  const notCurrent = remote.active && (remote.connection === "stale" || remote.connection === "disconnected");
  const text = size === "desk" ? "text-[16px]" : "text-[14px]";
  const needsCapability = notCurrent && (remote.auth === "missing" || remote.auth === "rejected");
  const show = notCurrent || remote.unresolved.length > 0 || remote.resolutions.length > 0;
  if (!show) return null;

  return (
    <div className="px-4 lg:px-6 pt-2 space-y-2 shrink-0" data-testid="remote-banners">
      {notCurrent && (
        <div
          role="alert"
          data-testid="stale-banner"
          className={`rounded-[8px] px-3 py-2 ${text} flex items-center justify-between gap-3 flex-wrap ${
            remote.connection === "disconnected" ? "bg-[#302025] text-[#F4A4A4]" : "bg-[#2A2316] text-[#F6C875]"
          }`}
        >
          <span className="min-w-0">
            <i className="ri-wifi-off-line mr-1.5" aria-hidden="true" />
            {remote.auth === "missing"
              ? "This browser has no room capability yet, so REAL shows cannot be shown or recorded. Enter the capability you were given. Rehearsals still work."
              : remote.auth === "rejected"
                ? "The room did not accept this browser's capability (it may be wrong or revoked), so REAL shows cannot be shown or recorded."
                : remote.snapshot
                  ? "Not connected to the room. What you see is the last confirmed state; it is not being updated and changes are paused."
                  : "The room cannot be reached, so REAL shows cannot be shown or recorded. Rehearsals still work."}
          </span>
          {needsCapability ? (
            <CapabilityForm size={size} />
          ) : (
            <Button size="desk" variant="secondary" onClick={() => void remoteRoomStore.refreshNow()} data-testid="reconnect-btn">
              Try now
            </Button>
          )}
        </div>
      )}
      {remote.unresolved.map((entry) => (
        <UnresolvedBanner key={entry.commandId} entry={entry} size={size} />
      ))}
      {remote.resolutions.map((r) => (
        <div
          key={r.id}
          role="status"
          data-testid="outcome-resolution"
          className={`rounded-[8px] px-3 py-2 ${text} flex items-center justify-between gap-3 ${
            r.tone === "ok" ? "bg-[#161B22] text-[#DFFF00] border border-[#2B3324]" : "bg-[#2A2316] text-[#F6C875]"
          }`}
        >
          <span className="min-w-0">{r.text}</span>
          <button
            type="button"
            onClick={() => remoteRoomStore.dismissResolution(r.id)}
            className="min-h-[44px] min-w-[44px] text-[#CAD0DA] hover:text-white cursor-pointer"
            aria-label="Dismiss"
          >
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
