"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "./Button";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm?: () => void;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmText = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  isLoading = false,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-desc" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[520px] rounded-[14px] bg-[#1B1F27] border border-[#2F3642] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <h3 id="dialog-title" className="text-[22px] font-medium text-[#F5F7FC]">
          {title}
        </h3>

        {description && (
          <p id="dialog-desc" className="text-[16px] leading-6 text-[#CAD0DA] mt-2">
            {description}
          </p>
        )}

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          {onConfirm && (
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
