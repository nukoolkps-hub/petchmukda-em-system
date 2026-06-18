import { type ReactNode, useCallback, useEffect, useState } from "react";

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

const CLOSE_DURATION_MS = 140;

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
  // exit animation · setClosing=true → run modalOut/dialogOut keyframes ·
  // จากนั้นเรียก onClose() จริง · กัน double-fire ด้วย closing flag
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => onClose(), CLOSE_DURATION_MS);
  }, [closing, onClose]);

  useEffect(() => {
    if (!closeOnEsc) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEsc, requestClose]);

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center px-4 sm:px-6 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),12px)] bg-[rgba(45,26,14,0.65)] backdrop-blur-[6px] ${
        closing
          ? "animate-[modalOut_0.14s_ease-in_forwards]"
          : "animate-[modalIn_0.18s_cubic-bezier(0.2,0.8,0.2,1)]"
      } ${overlayClassName}`}
      onClick={() => {
        if (closeOnBackdrop) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} max-h-[88dvh] overflow-y-auto bg-white rounded-xl shadow-[0_24px_60px_rgba(45,26,14,0.3)] ${
          closing
            ? "animate-[dialogOut_0.14s_ease-in_forwards]"
            : "animate-[modalIn_0.18s_cubic-bezier(0.2,0.8,0.2,1)]"
        } ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
