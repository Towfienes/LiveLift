import React, { useState } from "react";
import type { HostAppActions, HostAppViewModel } from "./types";
import { ViewerPill } from "./ViewerPill";
import { ConditionBanner } from "./ConditionBanner";
import { PromotionBanner } from "./PromotionBanner";
import { PinnedCard } from "./PinnedCard";
import { CommentStream } from "./CommentStream";
import { BagDrawer } from "./BagDrawer";
import { VideoPlaceholder } from "./VideoPlaceholder";

export interface HostAppProps {
  viewModel: HostAppViewModel;
  actions: HostAppActions;
  initialBagOpen?: boolean;
  className?: string;
}

export const HostApp: React.FC<HostAppProps> = ({
  viewModel,
  actions,
  initialBagOpen = false,
  className = "",
}) => {
  const [bagOpen, setBagOpen] = useState(initialBagOpen);

  const {
    mode,
    title,
    sessionId,
    viewers,
    elapsedLabel,
    bag,
    promotion,
    comments,
    banner,
  } = viewModel;

  const pinnedItem = bag.find((item) => item.pinned) ?? null;

  return (
    <div
      data-testid="host-app-phone"
      aria-label="Simulated Shopee Live Host Screen"
      className={`relative mx-auto w-full max-w-[390px] h-[844px] max-h-[100dvh] bg-[#090B0F] sm:border-[8px] sm:border-[#1C2028] sm:rounded-[44px] rounded-2xl border-2 border-[#1C2028] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden select-none font-sans ${className}`}
    >
      {/* Permanent, Legible SIMULATED Tag Status Ribbon (Always Visible on the Phone) */}
      <div className="relative z-40 bg-[#1A1726] border-b border-[#3E3456] px-3.5 py-1.5 flex items-center justify-between text-[11px] text-[#C8B2FF]">
        <div
          data-testid="host-app-simulated-badge"
          className="flex items-center gap-1.5 font-mono font-bold tracking-wider text-[10px] uppercase text-[#C8B2FF]"
        >
          <i className="ri-flask-line text-[12px] text-[#C8B2FF]" aria-hidden="true" />
          <span>SIMULATED SHOPEE LIVE</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#CAD0DA]/80">
          <span className="tabular-nums">12:00</span>
          <i className="ri-wifi-line text-[11px]" aria-hidden="true" />
          <i className="ri-battery-fill text-[11px]" aria-hidden="true" />
        </div>
      </div>

      {/* MAIN SCREEN BODY BY MODE */}
      {mode === "idle" && (
        <div
          data-testid="host-app-mode-idle"
          className="relative flex-1 flex flex-col justify-between p-5 pt-7 bg-gradient-to-b from-[#13161C] to-[#090B0F] text-[#F5F7FC]"
        >
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#211F2B] text-[#C8B2FF] border border-[#44385C]">
                PRE-LIVE SETUP
              </span>
              {sessionId && (
                <span className="text-[11px] font-mono text-[#8A95A5]">
                  Session #{sessionId}
                </span>
              )}
            </div>

            <h2 className="text-[20px] font-bold leading-tight tracking-tight text-[#F5F7FC] mb-2">
              {title}
            </h2>
            <p className="text-[12px] text-[#CAD0DA] leading-relaxed">
              Check product bag and settings before starting the live broadcast.
            </p>
          </div>

          {/* Condition banner if any */}
          <ConditionBanner banner={banner} />

          {/* Bag Preview */}
          <div className="my-auto rounded-2xl bg-[#13161C] border border-[#2A303A] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2A303A]">
              <div className="flex items-center gap-2">
                <i className="ri-shopping-bag-3-fill text-[#DFFF00] text-[18px]" />
                <h3 className="text-[13px] font-semibold text-[#F5F7FC]">
                  Shop Bag Preview
                </h3>
              </div>
              <span className="text-[11px] font-mono font-medium text-[#DFFF00] bg-[#DFFF00]/10 px-2 py-0.5 rounded">
                {bag.length} items
              </span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {bag.length === 0 ? (
                <p className="text-[12px] text-[#8A95A5] italic py-4 text-center">
                  Product bag is currently empty
                </p>
              ) : (
                bag.slice(0, 4).map((item) => {
                  const priceDisplay =
                    item.priceLabel !== null ? item.priceLabel : "Price not set";
                  return (
                    <div
                      key={item.itemId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#181B22] border border-[#2A303A] text-[12px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded bg-[#252A34] text-[#CAD0DA] flex items-center justify-center font-bold text-[11px] shrink-0">
                          {item.initials}
                        </span>
                        <span className="truncate font-medium text-[#F5F7FC]">
                          {item.name}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 font-mono ${
                          item.priceLabel === null
                            ? "text-[#CAD0DA]/70 italic text-[11px]"
                            : "text-[#DFFF00] font-semibold"
                        }`}
                      >
                        {priceDisplay}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {bag.length > 4 && (
              <p className="text-[11px] text-[#8A95A5] mt-2 text-right">
                + {bag.length - 4} more items in bag
              </p>
            )}
          </div>

          {/* Go Live CTA */}
          <div className="pt-2">
            <button
              type="button"
              onClick={actions.onGoLive}
              className="w-full py-3.5 px-4 rounded-xl bg-[#DFFF00] hover:bg-[#CBEA00] text-[#111407] font-bold text-[15px] tracking-wide shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
            >
              <i className="ri-broadcast-fill text-[18px]" aria-hidden="true" />
              <span>Go Live (SIMULATED)</span>
            </button>
            <p className="text-[10px] text-center text-[#8A95A5] mt-2 font-mono">
              Launches simulated host broadcast session
            </p>
          </div>
        </div>
      )}

      {mode === "live" && (
        <div
          data-testid="host-app-mode-live"
          className="relative flex-1 flex flex-col justify-between overflow-hidden"
        >
          {/* Animated Background Video Placeholder */}
          <VideoPlaceholder />

          {/* TOP OVERLAY BAR */}
          <div className="relative z-20 pt-2 px-3 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1.5">
              {/* Host Room Title & ID */}
              <div className="flex items-center gap-2 min-w-0 bg-[#13161C]/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#2A303A]">
                <div className="w-5 h-5 rounded-full bg-[#DFFF00] text-[#111407] flex items-center justify-center font-bold text-[10px] shrink-0">
                  <i className="ri-user-star-fill" aria-hidden="true" />
                </div>
                <div className="min-w-0 pr-1">
                  <span className="text-[11px] font-semibold text-[#F5F7FC] truncate block max-w-[100px]">
                    {title}
                  </span>
                </div>
              </div>

              {/* Viewers & Elapsed Time */}
              <div className="flex items-center gap-1.5 shrink-0">
                <ViewerPill viewers={viewers} />

                {elapsedLabel && (
                  <span
                    data-testid="elapsed-label"
                    className="px-2 py-1 rounded-full bg-[#13161C]/80 border border-[#2A303A] text-[11px] font-mono text-[#CAD0DA] tabular-nums"
                  >
                    {elapsedLabel}
                  </span>
                )}

                {/* End Live Action */}
                <button
                  type="button"
                  onClick={actions.onEndLive}
                  aria-label="End live broadcast"
                  className="px-2.5 py-1 rounded-full bg-[#302025]/90 hover:bg-[#FF5C5C] text-[#FF8585] hover:text-[#111407] border border-[#6B2A35] text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
                >
                  End
                </button>
              </div>
            </div>

            {/* Condition Banner */}
            <ConditionBanner banner={banner} />

            {/* Promotion Banner */}
            <PromotionBanner promotion={promotion} />
          </div>

          {/* BOTTOM INTERACTIVE ZONE */}
          <div className="relative z-20 p-3 pb-5 flex flex-col justify-end gap-2.5">
            {/* Pinned Card (if an item is pinned) */}
            <PinnedCard item={pinnedItem} onUnpin={actions.onUnpin} />

            {/* Synthetic Comments Stream */}
            <CommentStream comments={comments} />

            {/* Host Bottom Controls Toolbar */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Bag Trigger Button */}
              <button
                type="button"
                onClick={() => setBagOpen(true)}
                aria-label={`Open shop bag (${bag.length} items)`}
                data-testid="host-app-bag-button"
                className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#13161C]/90 hover:bg-[#1B1F27] border border-[#39414D] text-[#F5F7FC] shadow-lg backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
              >
                <i className="ri-shopping-bag-3-fill text-[#DFFF00] text-[17px]" />
                <span className="text-[12px] font-semibold">Bag</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#DFFF00] text-[#111407]">
                  {bag.length}
                </span>
              </button>

              {/* Host Quick Status Indicator */}
              <div className="flex items-center gap-1 bg-[#13161C]/80 border border-[#2A303A] px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-[#8A95A5]">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span>ON AIR</span>
              </div>
            </div>
          </div>

          {/* Slide-Up Bag Drawer */}
          <BagDrawer
            bag={bag}
            isOpen={bagOpen}
            onClose={() => setBagOpen(false)}
            onPin={actions.onPin}
            onUnpin={actions.onUnpin}
            onAddItem={actions.onAddItem}
            onRemoveItem={actions.onRemoveItem}
          />
        </div>
      )}

      {mode === "ended" && (
        <div
          data-testid="host-app-mode-ended"
          className="relative flex-1 flex flex-col justify-between p-6 pt-9 bg-gradient-to-b from-[#13161C] to-[#090B0F] text-[#F5F7FC]"
        >
          {/* Header */}
          <div className="text-center pt-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#211F2B] border border-[#44385C] text-[#C8B2FF] flex items-center justify-center mb-3 shadow-lg">
              <i className="ri-check-line text-[32px]" aria-hidden="true" />
            </div>
            <h2 className="text-[20px] font-bold text-[#F5F7FC]">
              Live Stream Ended
            </h2>
            <p className="text-[12px] text-[#CAD0DA] mt-1 line-clamp-2 max-w-[280px] mx-auto">
              {title}
            </p>
          </div>

          {/* Summary Stats Grid */}
          <div className="my-auto rounded-2xl bg-[#13161C] border border-[#2A303A] p-4 divide-y divide-[#2A303A]">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[12px] text-[#8A95A5]">Session ID</span>
              <span className="text-[12px] font-mono text-[#F5F7FC]">
                #{sessionId ?? "—"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-[12px] text-[#8A95A5]">Broadcast Duration</span>
              <span className="text-[12px] font-mono text-[#DFFF00] font-semibold tabular-nums">
                {elapsedLabel ?? "00:00:00"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-[12px] text-[#8A95A5]">Peak Viewers</span>
              <span className="text-[12px] font-mono text-[#C8B2FF] font-semibold tabular-nums">
                {viewers !== null ? viewers.toLocaleString() : "Not simulated"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-[12px] text-[#8A95A5]">Products in Bag</span>
              <span className="text-[12px] font-mono text-[#F5F7FC]">
                {bag.length} items
              </span>
            </div>
          </div>

          {/* Return CTA */}
          <div className="pt-2">
            <button
              type="button"
              onClick={actions.onGoLive}
              className="w-full py-3 px-4 rounded-xl bg-[#252A34] hover:bg-[#303643] text-[#F5F7FC] font-semibold text-[14px] border border-[#39414D] transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
            >
              <i className="ri-arrow-go-back-line text-[16px]" aria-hidden="true" />
              <span>Back to Pre-Live Setup</span>
            </button>
            <p className="text-[10px] text-center text-[#8A95A5] mt-2 font-mono">
              Stream recorded in SIMULATED environment
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
