"use client";

import React from "react";
import { Button, Surface } from "@/components/ui";
import { deskCopy } from "./copy";

export function DeskFrame({ title, children, lang, setLang }: { title: keyof typeof deskCopy.en; children: React.ReactNode; lang: "en" | "vi"; setLang: (lang: "en" | "vi") => void }) {
  return (
    <div lang={lang} className="w-full min-w-0 max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="livedesk-frame">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[13px] tracking-wider font-semibold text-[var(--simulated)]">SIMULATED</p>
          <h1 className="text-[30px] font-medium tracking-tight">{deskCopy[lang][title]}</h1>
        </div>
        <div role="group" aria-label="Language" className="flex gap-1">
          <Button size="sm" aria-pressed={lang === "en"} onClick={() => setLang("en")} data-testid="desk-lang-en">EN</Button>
          <Button size="sm" aria-pressed={lang === "vi"} onClick={() => setLang("vi")} data-testid="desk-lang-vi">VI</Button>
        </div>
      </div>
      {children}
    </div>
  );
}

export function DeskPanel({ title, children, className = "", testId }: { title: string; children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <Surface bordered className={`min-w-0 p-4 ${className}`} data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-[18px] font-medium">{title}</h2>
        <span className="text-[12px] font-semibold text-[var(--simulated)]">SIMULATED</span>
      </div>
      {children}
    </Surface>
  );
}
