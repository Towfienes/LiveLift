import React from "react";
import type { HostAppPromotion } from "./types";

export interface PromotionBannerProps {
  promotion: HostAppPromotion | null;
  className?: string;
}

export const PromotionBanner: React.FC<PromotionBannerProps> = ({
  promotion,
  className = "",
}) => {
  if (!promotion) return null;

  const { name, status, countdownLabel } = promotion;

  const isScheduled = status === "scheduled";
  const isActive = status === "active";

  return (
    <div
      role="region"
      aria-label="Flash sale promotion"
      data-testid="promotion-banner"
      className={`relative mx-3.5 my-1.5 p-2 rounded-xl border backdrop-blur-md shadow-md transition-all duration-300 animate-[host-app-banner-in_250ms_ease-out] select-none ${
        isActive
          ? "bg-[#281816]/95 border-[#E24A24]/70 text-[#FFA07A]"
          : isScheduled
            ? "bg-[#252218]/95 border-[#967526]/70 text-[#F6C875]"
            : "bg-[#181B22]/90 border-[#2F3746] text-[#8A95A5]"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isActive
                ? "bg-[#E24A24] text-[#FFFFFF] shadow-sm animate-[host-app-countdown-pulse_2s_ease-in-out_infinite] motion-reduce:animate-none"
                : isScheduled
                  ? "bg-[#967526]/40 text-[#F6C875]"
                  : "bg-[#252A34] text-[#8A95A5]"
            }`}
          >
            <i
              className={
                isActive
                  ? "ri-flashlight-fill text-[16px]"
                  : isScheduled
                    ? "ri-time-line text-[15px]"
                    : "ri-checkbox-circle-line text-[15px]"
              }
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] font-mono font-bold tracking-wider uppercase px-1 py-0.5 rounded ${
                  isActive
                    ? "bg-[#FF5C5C]/20 text-[#FF8585] border border-[#FF5C5C]/40"
                    : isScheduled
                      ? "bg-[#F6C875]/20 text-[#F6C875] border border-[#F6C875]/40"
                      : "bg-[#8A95A5]/20 text-[#8A95A5] border border-[#8A95A5]/40"
                }`}
              >
                {status}
              </span>
              <span className="text-[10px] font-mono uppercase text-[#CAD0DA]/60">
                PROMO
              </span>
            </div>
            <p className="text-[12px] font-medium leading-tight truncate text-[#F5F7FC] mt-0.5">
              {name}
            </p>
          </div>
        </div>

        {countdownLabel && (
          <div
            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[11px] font-semibold tracking-tight border ${
              isActive
                ? "bg-[#FF4500]/20 text-[#FFD700] border-[#FF4500]/50"
                : "bg-[#2A303A] text-[#CAD0DA] border-[#39414D]"
            }`}
          >
            <i className="ri-timer-line text-[12px]" aria-hidden="true" />
            <span className="tabular-nums">{countdownLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};
