"use client";

import React from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { useLabPreferences } from "@/components/platform/lab/useLabPreferences";
import { DeskFrame } from "./DeskFrame";
import { deskCopy } from "./copy";

export function LegacyScreen() {
  const { lang, setLang } = useLabPreferences();
  const c = deskCopy[lang];
  const links = [
    { href: "/sessions", title: c.sessions, detail: c.sessionsHelp },
    { href: "/products", title: c.library, detail: c.libraryHelp },
    { href: "/insights", title: c.insights, detail: c.insightsHelp },
    { href: "/simulator", title: c.simulator, detail: c.simulatorHelp },
    { href: "/integrations", title: c.integrations, detail: c.integrationsHelp },
    { href: "/live/new", title: c.create, detail: c.createHelp },
  ];
  return (
    <StandardShell>
      <DeskFrame title="legacy" lang={lang} setLang={setLang}>
        <p className="text-[var(--text-muted)] mb-4">{c.legacyIntro}</p>
        <ul className="divide-y divide-[var(--border-subtle)]" data-testid="legacy-links">
          {links.map(link => <li key={link.href} className="py-3">
            <Link href={link.href} className="inline-flex items-center min-h-[44px] text-[18px] font-medium text-[var(--accent-lime)]">{link.title}</Link>
            <p className="text-[var(--text-muted)]">{link.detail}</p>
          </li>)}
        </ul>
      </DeskFrame>
    </StandardShell>
  );
}
