"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountControl } from "@/components/auth/AccountControl";
import { ConnectionChip, RemoteBanners } from "@/components/ops/ConnectionStatus";
import { useRemoteState } from "@/lib/store/hooks";

export interface StandardShellProps {
  activeSessionId?: string | null;
  activeSessionTitle?: string | null;
  children: React.ReactNode;
}

export const StandardShell: React.FC<StandardShellProps> = ({
  activeSessionId = null,
  activeSessionTitle = null,
  children,
}) => {
  const pathname = usePathname();
  // Where a REAL room is in use its connection status takes the place of the "This device" note (same space, no wider header).
  const roomInUse = useRemoteState().active;

  const isNavActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname?.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090B0F] text-[#F5F7FC]">
      {/* Global Header */}
      {/*
        Below 1024px the header wraps instead of running off the screen: at 200% zoom (or on a tablet) the right-hand
        controls, Sign out among them, would otherwise be clipped and unreachable. From 1024px up nothing changes.
      */}
      <header className="min-h-[64px] py-2 lg:py-0 lg:h-[64px] px-6 lg:px-8 flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-4 gap-y-1 bg-[#101319] border-b border-[#1E232B] shrink-0 sticky top-0 z-40">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <Link href="/" className="flex items-center gap-2.5 text-[#F5F7FC] hover:opacity-90">
            <span className="text-[25px] text-[#DFFF00]" aria-hidden="true">
              <i className="ri-bar-chart-grouped-line" />
            </span>
            <span className="font-medium text-[24px] tracking-[-1px]">
              LiveLift
            </span>
          </Link>

          {/* Primary Navigation */}
          <nav className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 ml-2 lg:ml-8" aria-label="Main Navigation">
            <Link
              href="/"
              className={`min-h-[44px] px-3.5 rounded-[8px] flex items-center gap-2 text-[16px] font-medium transition-colors ${
                isNavActive("/")
                  ? "text-[#DFFF00] bg-[#242A22]"
                  : "text-[#C8CDD6] hover:text-white hover:bg-[#1B2028]"
              }`}
              aria-current={isNavActive("/") ? "page" : undefined}
            >
              <i className="ri-home-5-line text-[18px]" aria-hidden="true" />
              <span>Home</span>
            </Link>

            <Link
              href="/sessions"
              className={`min-h-[44px] px-3.5 rounded-[8px] flex items-center gap-2 text-[16px] font-medium transition-colors ${
                isNavActive("/sessions")
                  ? "text-[#DFFF00] bg-[#242A22]"
                  : "text-[#C8CDD6] hover:text-white hover:bg-[#1B2028]"
              }`}
              aria-current={isNavActive("/sessions") ? "page" : undefined}
            >
              <i className="ri-stack-line text-[18px]" aria-hidden="true" />
              <span>Sessions</span>
            </Link>

            <Link
              href="/products"
              className={`min-h-[44px] px-3.5 rounded-[8px] flex items-center gap-2 text-[16px] font-medium transition-colors ${
                isNavActive("/products")
                  ? "text-[#DFFF00] bg-[#242A22]"
                  : "text-[#C8CDD6] hover:text-white hover:bg-[#1B2028]"
              }`}
              aria-current={isNavActive("/products") ? "page" : undefined}
            >
              <i className="ri-shopping-bag-3-line text-[18px]" aria-hidden="true" />
              <span>Products</span>
            </Link>
          </nav>
        </div>

        {/* Right side: Active session return + user identity */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-1">
          {activeSessionId && (
            <Link
              href={`/live/${activeSessionId}/operate`}
              className="min-h-[44px] px-3.5 py-1.5 rounded-[8px] bg-[#1E2718] border border-[#3E5224] text-[#DFFF00] text-[15px] font-medium flex items-center gap-2 hover:bg-[#283620] transition-colors"
              title={`Return to active session: ${activeSessionTitle || activeSessionId}`}
            >
              <span className="w-2 h-2 rounded-full bg-[#DFFF00] animate-pulse" />
              <span>Active LIVE: {activeSessionTitle || "Open Desk"}</span>
            </Link>
          )}

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 text-[#CAD0DA]">
            <Link
              href="/simulator"
              className={`min-h-[44px] px-3 rounded-[8px] flex items-center gap-2 text-[15px] hover:text-white hover:bg-[#1B2028] transition-colors ${
                isNavActive("/simulator") ? "text-[#C8B2FF]" : ""
              }`}
              aria-current={isNavActive("/simulator") ? "page" : undefined}
            >
              <i className="ri-flask-line text-[18px] text-[#C8B2FF]" aria-hidden="true" />
              <span>Simulator</span>
            </Link>

            <Link
              href="/integrations"
              className={`min-h-[44px] px-3 rounded-[8px] flex items-center gap-2 text-[15px] hover:text-white hover:bg-[#1B2028] transition-colors ${
                isNavActive("/integrations") ? "text-[#DFFF00]" : ""
              }`}
            >
              <i className="ri-plug-line text-[18px]" aria-hidden="true" />
              <span>Integrations</span>
            </Link>

            <span className="text-[#39414D]">|</span>

            {roomInUse ? (
              <>
                <ConnectionChip />
                <AccountControl />
              </>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 text-[15px] text-[#CAD0DA] px-2 py-1"
                title="Rehearsals are stored in this browser only. REAL shows live in the shared room."
              >
                <i className="ri-computer-line" aria-hidden="true" />
                <span>This device</span>
              </span>
            )}
          </div>
        </div>
      </header>

      <RemoteBanners />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col outline-none">
        {children}
      </main>
    </div>
  );
};
