import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "nav";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "min-h-[44px] rounded-[8px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

    const sizeStyles = {
      sm: "px-3 py-1.5 text-[15px]",
      md: "px-4 py-2 text-[16px]",
      lg: "px-5 py-2.5 text-[18px]",
    }[size];

    const variantStyles = {
      primary:
        "bg-[#DFFF00] text-[#111407] hover:bg-[#CBEA00] font-semibold active:bg-[#B7D400]",
      secondary:
        "bg-[#292D35] text-[#F5F7FC] hover:bg-[#343944] active:bg-[#20242B]",
      ghost:
        "bg-transparent text-[#CAD0DA] hover:text-white hover:bg-[#1E232B] active:bg-[#181C23]",
      danger:
        "bg-[#381E24] text-[#FF8585] hover:bg-[#4E232B] active:bg-[#2B1519] border border-[#6B2A35]",
      nav:
        "bg-transparent text-[#C8CDD6] hover:text-white hover:bg-[#1E232B]",
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {icon && <i className={icon} aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
