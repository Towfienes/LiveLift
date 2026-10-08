"use client";

import React, { useContext } from "react";
import type { HostAppActions, HostAppViewModel } from "@/components/platform/host-app/types";
import { LabWordsContext } from "./useLabPreferences";

const COMMENT_SLOTS = 6;

/**
 * A stand-in for the host's SIMULATED Shopee app until the finished one replaces it (see HostAppSlot). It takes the
 * same contract and nothing else. Every region has a fixed place, so an update never moves the rest of the phone.
 */
export function HostAppPlaceholder({ model, actions }: { model: HostAppViewModel; actions: HostAppActions }): React.ReactElement {
  const w = useContext(LabWordsContext).phone;
  const pinned = model.bag.find((b) => b.pinned) ?? null;
  const comments = Array.from({ length: COMMENT_SLOTS }, (_, i) => model.comments[model.comments.length - COMMENT_SLOTS + i] ?? null);
  const live = model.mode === "live";
  const btn =
    "min-h-[32px] px-2 rounded-[6px] text-[13px] font-medium bg-[#2A2540] text-[#E4DAFF] hover:bg-[#363052] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  const bannerTone = { info: "bg-[#1A2230] text-[#B4C6DD]", warn: "bg-[#2A2316] text-[#F6C875]", danger: "bg-[#302025] text-[#F4A4A4]" };

  return (
    <section
      aria-label={w.region}
      data-testid="host-app"
      data-mode={model.mode}
      className="h-full w-full flex flex-col rounded-[24px] border border-[#44385C] bg-[linear-gradient(170deg,#1C1830_0%,#12141B_55%,#0F1218_100%)] overflow-hidden text-[#F5F7FC]"
    >
      <header className="shrink-0 px-3 pt-3 pb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#211F2B] border border-[#44385C] px-1.5 py-0.5 text-[12px] font-semibold text-[#C8B2FF]">
          <i className="ri-flask-line" aria-hidden="true" />
          {w.simulated}
        </span>
        <span className="flex-1 min-w-0 text-right text-[12px] text-[#CAD0DA] tabular-nums truncate" data-testid="host-app-viewers">
          {model.viewers !== null ? w.viewers(model.viewers) : live ? "" : model.mode === "ended" ? w.ended : w.idle}
        </span>
      </header>
      <div className="shrink-0 px-3">
        <p className="text-[14px] font-medium truncate" title={model.title}>{model.title}</p>
        <p className="text-[12px] text-[#9AA5B5] tabular-nums h-[18px]">
          {model.sessionId !== null ? w.session(model.sessionId) : ""}
          {model.elapsedLabel ? ` · ${model.elapsedLabel}` : ""}
        </p>
      </div>
      {/* The banner keeps its row even when empty, so a condition appearing never pushes the screen down. */}
      <div className="shrink-0 px-3 h-[30px] flex items-center" role="status">
        {model.banner && (
          <p className={`w-full rounded-[6px] px-2 py-1 text-[12px] truncate ${bannerTone[model.banner.tone]}`} data-testid="host-app-banner">
            <i className="ri-error-warning-line mr-1" aria-hidden="true" />
            {model.banner.text}
          </p>
        )}
      </div>

      {/* Fixed rows: the promotion and the pinned card keep their place when empty, so nothing jumps when they change. */}
      <div className="flex-1 min-h-0 mx-3 rounded-[14px] bg-[radial-gradient(circle_at_30%_20%,#2A2540_0%,#161320_60%)] overflow-hidden flex flex-col gap-1 p-2">
        <p className="shrink-0 text-center text-[11px] leading-4 text-[#7F8A9C] truncate" title={w.placeholder}>{w.placeholder}</p>
        <div className="shrink-0 h-[24px] flex justify-end">
          {model.promotion && (
            <p className="max-w-full rounded-[6px] bg-[#211F2B] border border-[#44385C] px-1.5 text-[12px] leading-[22px] text-[#E4DAFF] truncate" data-testid="host-app-promotion">
              {model.promotion.name}
              {model.promotion.countdownLabel ? ` · ${model.promotion.countdownLabel}` : ""}
            </p>
          )}
        </div>
        {/* Fixed slots, newest at the bottom: a new comment changes text, never moves a box. */}
        <ul className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end gap-0.5" aria-label={w.comments} aria-live="polite">
          {comments.map((c, i) => (
            <li key={i} className="shrink-0 h-4 text-[12px] leading-4 text-[#E4DAFF] truncate">
              {c && <><span className="text-[#9AA5B5]">{c.user}</span> {c.text}</>}
            </li>
          ))}
        </ul>
        <div className="shrink-0 h-[34px]">
          {pinned && (
            <p className="h-full rounded-[8px] bg-[#0F1218]/90 border border-[#44385C] px-2 text-[13px] leading-[32px] truncate" data-testid="host-app-pinned">
              <i className="ri-pushpin-fill text-[#C8B2FF] mr-1" aria-hidden="true" />
              {pinned.name} · {pinned.priceLabel ?? w.priceNotSet}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 h-[34%] min-h-[120px] flex flex-col px-3 pt-2 pb-3 gap-1.5">
        <p className="text-[12px] text-[#9AA5B5]">{w.bag}</p>
        <ul className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 rounded-[6px] focus-visible:outline-2 focus-visible:outline-[#DFFF00]" tabIndex={0} aria-label={w.bag} data-testid="host-app-bag">
          {model.bag.length === 0 && <li className="text-[12px] text-[#9AA5B5]">{w.emptyBag}</li>}
          {model.bag.map((b) => (
            <li key={b.itemId} className="flex items-center gap-1.5">
              <span className="w-7 h-7 shrink-0 rounded-[6px] bg-[#211F2B] text-[11px] text-[#C8B2FF] inline-flex items-center justify-center" aria-hidden="true">{b.initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] truncate">{b.name}</span>
                <span className="block text-[11px] text-[#9AA5B5] truncate">{b.priceLabel ?? w.priceNotSet}</span>
              </span>
              {live && (
                <>
                  <button type="button" className={`${btn} w-[44px]`} disabled={b.pinned} onClick={() => actions.onPin(b.itemId)} aria-label={`${w.pin} ${b.name}`} data-testid={`host-app-pin-${b.itemId}`}>
                    {b.pinned ? <i className="ri-pushpin-fill" aria-hidden="true" /> : w.pin}
                  </button>
                  <button type="button" className={btn} onClick={() => actions.onRemoveItem(b.itemId)} aria-label={`${w.remove} ${b.name}`}>
                    <i className="ri-close-line" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-1.5">
          {model.mode === "live" ? (
            <>
              <button type="button" className={`${btn} flex-1`} disabled={!pinned} onClick={actions.onUnpin} data-testid="host-app-unpin">{w.unpin}</button>
              <button type="button" className={`${btn} flex-1 !bg-[#381E24] !text-[#FF8585]`} onClick={actions.onEndLive} data-testid="host-app-end">{w.endLive}</button>
            </>
          ) : (
            <button type="button" className={`${btn} flex-1`} onClick={actions.onGoLive} data-testid="host-app-go-live">{w.goLive}</button>
          )}
        </div>
      </div>
    </section>
  );
}
