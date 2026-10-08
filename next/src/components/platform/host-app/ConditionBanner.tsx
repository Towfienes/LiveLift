import React from "react";

export interface ConditionBannerProps {
  banner: {
    tone: "info" | "warn" | "danger";
    text: string;
  } | null;
  className?: string;
}

export const ConditionBanner: React.FC<ConditionBannerProps> = ({
  banner,
  className = "",
}) => {
  if (!banner) return null;

  const toneConfig = {
    info: {
      bgClass: "bg-[#12222A]/95 border-[#25505F] text-[#7DD8EA]",
      icon: "ri-information-line text-[#7DD8EA]",
      badge: "INFO",
      badgeClass: "bg-[#7DD8EA]/15 text-[#7DD8EA] border-[#25505F]",
    },
    warn: {
      bgClass: "bg-[#2A2316]/95 border-[#5E4822] text-[#F6C875]",
      icon: "ri-alert-line text-[#F6C875]",
      badge: "WARNING",
      badgeClass: "bg-[#F6C875]/15 text-[#F6C875] border-[#5E4822]",
    },
    danger: {
      bgClass: "bg-[#302025]/95 border-[#6B2A35] text-[#F4A4A4]",
      icon: "ri-error-warning-line text-[#FF5C5C]",
      badge: "DANGER",
      badgeClass: "bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#6B2A35]",
    },
  }[banner.tone];

  return (
    <div
      role="alert"
      data-testid="condition-banner"
      className={`relative mx-3.5 my-1.5 p-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-300 animate-[host-app-banner-in_250ms_ease-out] ${toneConfig.bgClass} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <i
          className={`${toneConfig.icon} text-[16px] shrink-0 mt-0.5`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-[9px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border ${toneConfig.badgeClass}`}
            >
              {toneConfig.badge}
            </span>
            <span className="text-[10px] text-[#CAD0DA]/70 font-mono">
              CONDITION
            </span>
          </div>
          <p className="text-[12px] font-medium leading-snug break-words text-[#F5F7FC]">
            {banner.text}
          </p>
        </div>
      </div>
    </div>
  );
};
