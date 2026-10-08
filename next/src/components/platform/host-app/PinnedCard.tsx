import React from "react";
import type { HostAppBagItem } from "./types";

export interface PinnedCardProps {
  item: HostAppBagItem | null;
  onUnpin: () => void;
  className?: string;
}

export const PinnedCard: React.FC<PinnedCardProps> = ({
  item,
  onUnpin,
  className = "",
}) => {
  if (!item) return null;

  // Rule: unknown price shows "Price not set", never 0
  const priceDisplay = item.priceLabel !== null ? item.priceLabel : "Price not set";
  const isPriceUnknown = item.priceLabel === null;

  return (
    <div
      data-testid="pinned-card"
      aria-label={`Pinned product: ${item.name}`}
      className={`relative rounded-2xl bg-[#13161C]/95 border border-[#39414D] p-2.5 sm:p-3 shadow-2xl backdrop-blur-md transition-all duration-300 animate-[host-app-slide-up_250ms_ease-out] motion-reduce:animate-none motion-reduce:transition-none select-none ${className}`}
    >
      <div className="flex items-start gap-2 sm:gap-2.5">
        {/* Product initials avatar */}
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#1B1F27] border border-[#2A303A] flex flex-col items-center justify-center shrink-0 shadow-inner"
          aria-hidden="true"
        >
          <span className="text-[15px] sm:text-[17px] font-semibold text-[#DFFF00]">
            {item.initials}
          </span>
          <span className="text-[8px] sm:text-[9px] font-mono text-[#8A95A5] leading-none">
            #{item.itemId}
          </span>
        </div>

        {/* Product details */}
        <div data-testid="host-app-pinned" className="flex-1 min-w-0 pr-0.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-[#DFFF00]/15 text-[#DFFF00] border border-[#DFFF00]/30">
              <i className="ri-pushpin-2-fill text-[11px]" aria-hidden="true" />
              <span>PINNED</span>
            </span>
            <span className="text-[10px] font-mono text-[#8A95A5] hidden xs:inline">
              LIVE HIGHLIGHT
            </span>
          </div>

          <h4
            className="text-[12px] sm:text-[13px] font-medium leading-snug text-[#F5F7FC] line-clamp-2 break-words"
            title={item.name}
          >
            {item.name}
          </h4>

          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              data-testid="pinned-card-price"
              className={`text-[13px] sm:text-[14px] font-bold tabular-nums ${
                isPriceUnknown
                  ? "text-[#CAD0DA] italic text-[12px] font-normal"
                  : "text-[#DFFF00]"
              }`}
            >
              {priceDisplay}
            </span>
          </div>
        </div>

        {/* Host action: Unpin button (minimum 44x44px target) */}
        <button
          type="button"
          onClick={onUnpin}
          aria-label={`Unpin ${item.name} from screen`}
          title="Unpin this product from viewer screen"
          data-testid="host-app-unpin"
          className="shrink-0 min-w-[44px] min-h-[44px] w-[44px] h-[44px] rounded-xl bg-[#252A34] hover:bg-[#303643] text-[#CAD0DA] hover:text-[#F5F7FC] border border-[#39414D] transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
        >
          <i className="ri-unpin-line text-[17px]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
