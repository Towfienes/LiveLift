"use client";

import React, { useEffect, useId, useRef } from "react";
import { Button, type ButtonSize } from "./Button";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger";
  /** Operating-desk dialogs pass "lg" so the primary action label is 18px. Other screens keep the default. */
  confirmSize?: ButtonSize;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WIDTH = { sm: "max-w-[440px]", md: "max-w-[540px]", lg: "max-w-[760px]" } as const;

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  confirmSize = "md",
  onConfirm,
  confirmDisabled = false,
  isLoading = false,
  size = "md",
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Always call the latest handlers without re-running the focus effect on every render.
  const latest = useRef({ onClose, isLoading });
  latest.current = { onClose, isLoading };

  // Capture focus on open; give it back on close.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const target =
      root?.querySelector<HTMLElement>("[data-autofocus]") ??
      root?.querySelector<HTMLElement>(FOCUSABLE) ??
      root;
    target?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [isOpen]);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !latest.current.isLoading) {
        e.stopPropagation();
        latest.current.onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`w-full ${WIDTH[size]} max-h-[calc(100dvh-2rem)] flex flex-col rounded-[14px] bg-[#1B1F27] border border-[#2F3642] shadow-2xl outline-none`}
      >
        <div className="p-6 pb-0 shrink-0">
          <h3 id={titleId} className="text-[22px] font-medium text-[#F5F7FC]">
            {title}
          </h3>
          {description && (
            <p id={descId} className="text-[16px] leading-6 text-[#CAD0DA] mt-2">
              {description}
            </p>
          )}
        </div>

        {children && <div className="px-6 pt-4 min-h-0 overflow-y-auto">{children}</div>}

        <div className="p-6 pt-5 flex justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          {onConfirm && (
            <Button variant={confirmVariant} size={confirmSize} onClick={onConfirm} disabled={isLoading || confirmDisabled}>
              {isLoading ? "Processing..." : confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
