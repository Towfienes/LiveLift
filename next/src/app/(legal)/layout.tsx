import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[#1E232B] bg-[#101319] px-6 sm:px-8">
        <div className="mx-auto flex min-h-[64px] max-w-[760px] flex-wrap items-center justify-between gap-x-6">
          <a href="/" className="inline-flex min-h-[44px] items-center text-[24px] font-medium tracking-[-1px] text-[#DFFF00]">
            LiveLift
          </a>
          <nav aria-label="Legal" className="flex gap-6 text-[16px] text-[#CAD0DA]">
            <a href="/terms" className="inline-flex min-h-[44px] items-center underline underline-offset-4 hover:text-white">Terms</a>
            <a href="/privacy" className="inline-flex min-h-[44px] items-center underline underline-offset-4 hover:text-white">Privacy</a>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[760px] px-6 py-12 outline-none sm:px-8">
        <article className="space-y-6 text-[16px] leading-7 text-[#B7C1CE] [&_h1]:text-[34px] [&_h1]:font-medium [&_h1]:leading-tight [&_h1]:tracking-[-0.6px] [&_h1]:text-[#F5F7FC] [&_h2]:mb-2 [&_h2]:text-[20px] [&_h2]:font-medium [&_h2]:text-[#F5F7FC]">
          {children}
        </article>
      </main>
    </div>
  );
}
