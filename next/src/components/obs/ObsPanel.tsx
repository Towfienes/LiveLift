"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { authStore } from "@/lib/client/authStore";
import { buildHeaders, sendBounded } from "@/lib/client/productionTransport";
import { useAuth } from "@/lib/store/hooks";
import type { ObsSnapshot, ObsStatus } from "@/lib/integrations/obs/types";

const labels: Record<ObsStatus, string> = {
  not_configured: "Not configured", connecting: "Connecting", connected: "Connected", disconnected: "Disconnected", unavailable: "Unavailable",
};

/** Dedicated read-only panel. Credentials and websocket transport stay on the server. */
export function ObsPanel(): React.ReactElement {
  const auth = useAuth();
  const context = auth.status === "authenticated" ? auth.session : null;
  const [result, setResult] = useState<{ context: typeof context; snapshot: ObsSnapshot | null } | null>(null);

  useEffect(() => { authStore.ensureChecked(); }, []);
  useEffect(() => {
    if (!context) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const response = await sendBounded(undefined, "/api/obs/status", { headers: buildHeaders({ unsafe: false, context }) }, 5000);
      if (disposed) return;
      if (response.ok && response.status === 401) { authStore.markSessionEnded(); return; }
      if (response.ok && response.status === 409) { void authStore.refresh(); }
      const body = response.ok && response.status === 200 ? response.body as ObsSnapshot | null : null;
      const valid = body?.provider === "obs" && body?.provenance === "provider_observed" && Object.hasOwn(labels, body.status);
      setResult({ context, snapshot: valid ? body : null });
      timer = setTimeout(() => void poll(), 5000);
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [context]);

  // Clear display immediately when the session ends, even if a prior read succeeded.
  const current = context && result?.context === context ? result : null;
  const observed = current?.snapshot;
  const scene = observed?.currentProgramScene;
  const stream = observed?.streamActive;

  return (
    <section aria-labelledby="obs-title" className="rounded-xl bg-[#13161C] p-6 space-y-4">
      <h1 id="obs-title" className="text-2xl font-medium">OBS</h1>
      <p role="status">
        {!context ? auth.status === "checking" ? "Checking sign-in…" : "Sign in to view OBS status." : current && !observed ? "Unavailable" : observed ? labels[observed.status] : "Loading OBS status…"}
      </p>
      {!context && <Link href="/login?next=%2Fobs" className="underline">Sign in</Link>}
      <dl className="space-y-3">
        <div><dt className="text-[#B7C1CE]">Current program scene</dt><dd>{scene?.value ?? "Unknown"}</dd></div>
        <div><dt className="text-[#B7C1CE]">OBS streaming output</dt><dd>{stream ? stream.value ? "Active" : "Inactive" : observed?.streamSupported === false ? "Unsupported" : "Unknown"}</dd></div>
        <div><dt className="text-[#B7C1CE]">Scenes</dt><dd>{observed?.scenes?.value.join(", ") || "Unknown"}</dd></div>
      </dl>
      {scene && <p className="text-sm text-[#B7C1CE]">Scene observed by OBS; received <time dateTime={scene.receivedAt}>{scene.receivedAt}</time>.</p>}
      {stream && <p className="text-sm text-[#B7C1CE]">Stream output observed by OBS; received <time dateTime={stream.receivedAt}>{stream.receivedAt}</time>.</p>}
      {observed?.error && <p className="text-[#F6C875]">OBS bridge: {observed.error.replaceAll("_", " ")}. Ask the local administrator to check OBS configuration.</p>}
      {observed?.nextRetryAt && <p className="text-sm">Reconnect {observed.reconnectAttempts}/5 scheduled for <time dateTime={observed.nextRetryAt}>{observed.nextRetryAt}</time>.</p>}
      <p className="text-[#B7C1CE]">Provider observed broadcast state. OBS does not confirm TikTok LIVE status or product pins.</p>
    </section>
  );
}
