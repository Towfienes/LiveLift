"use client";

import React from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { TruthPanel } from "@/components/onboarding/HomeOnboarding";
import { useStartFlow } from "@/lib/livedesk/hooks";
import { useLabPreferences } from "@/components/platform/lab/useLabPreferences";
import { DeskFrame, DeskPanel } from "./DeskFrame";
import { deskCopy } from "./copy";

export function HomeScreen() {
  const { view } = useStartFlow();
  const { lang, setLang } = useLabPreferences();
  const c = deskCopy[lang];
  const next = !view.connected ? c.nextConnect : view.products.some(product => product.sync.state === "synced") ? c.nextStart : c.nextImport;
  return (
    <StandardShell>
      <DeskFrame title="home" lang={lang} setLang={setLang}>
        <p className="text-[18px] text-[var(--text-muted)] mb-6">{c.intro}</p>
        <div className="grid gap-4 md:grid-cols-3" data-testid="home-flow">
          <DeskPanel title={c.connect}>
            <p className="text-[var(--simulated)]">{view.platformLabel}</p>
            <p className="mt-2">{view.connected ? c.connected : c.disconnected}</p>
          </DeskPanel>
          <DeskPanel title={c.products}>
            <p className="text-[32px] tabular-nums">{view.products.length}</p>
          </DeskPanel>
          <DeskPanel title={c.next}>
            <p>{next}</p>
            <Link href="/start" className="mt-3 inline-flex min-h-[44px] items-center px-4 rounded-[8px] font-medium bg-[var(--accent-lime)] text-[var(--accent-lime-text)]">{c.start}</Link>
          </DeskPanel>
        </div>
        <ol className="flex flex-wrap gap-3 my-6 text-[var(--text-muted)]" data-testid="loop-guide" aria-label={c.intro}>
          <li>1 · {c.connect}</li><li>2 · {c.import}</li><li>3 · {c.startLive}</li><li>4 · {c.desk}</li>
        </ol>
        <TruthPanel />
      </DeskFrame>
    </StandardShell>
  );
}
