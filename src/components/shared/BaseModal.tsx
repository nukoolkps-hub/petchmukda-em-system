import { type ReactNode, useEffect } from "react";

interface BaseModalProps {
  children: ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  maxWidthClass?: string;
  contentClassName?: string;
  overlayClassName?: string;
  zIndexClass?: string;
}

export default function BaseModal({
  children,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
  maxWidthClass = "max-w-[430px]",
  contentClassName = "",
  overlayClassName = "",
  zIndexClass = "z-800",
}: BaseModalProps) {
  useEffect(() => {
    if (!closeOnEsc) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEsc, onClose]);

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center px-4 sm:px-6 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),12px)] bg-[rgba(45,26,14,0.65)] backdrop-blur-[6px] ${overlayClassName}`}
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} max-h-[88dvh] overflow-y-auto bg-white rounded-xl shadow-[0_24px_60px_rgba(45,26,14,0.3)] animate-[modalIn_0.18s_cubic-bezier(0.2,0.8,0.2,1)] ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
