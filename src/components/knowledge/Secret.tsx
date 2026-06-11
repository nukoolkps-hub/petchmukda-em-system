/* ─── Secret — กล่องซ่อนข้อมูล (รหัส/PIN) แตะดูเอง ───────────────────
   ปกติ blur ทับ + ไอคอนตา · แตะ → reveal ค่า + ปุ่ม copy             */

import {
  Check as IconCheck,
  Copy as IconCopy,
  Eye as IconEye,
  EyeOff as IconEyeOff,
} from "lucide-react";
import { useState } from "react";

interface Props {
  label: string;
  value: string;
}

export default function Secret({ label, value }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="mb-2.5 px-3 py-2 rounded-[10px] border border-bdr bg-white flex items-center gap-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-txt-soft font-semibold uppercase tracking-wide">
          {label}
        </div>
        <div className="font-mono text-sm font-bold text-txt mt-0.5 flex items-center gap-1.5">
          {revealed ? (
            <span className="break-all">{value}</span>
          ) : (
            <span
              className="select-none text-txt-soft tracking-widest"
              aria-hidden="true"
            >
              {"•".repeat(Math.min(value.length, 14))}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "ซ่อน" : "แสดง"}
        className="shrink-0 w-8 h-8 rounded-[8px] border border-bdr bg-cream text-txt-mid cursor-pointer flex items-center justify-center active:scale-[0.92] transition-transform"
      >
        {revealed ? (
          <IconEyeOff size={14} strokeWidth={2.4} />
        ) : (
          <IconEye size={14} strokeWidth={2.4} />
        )}
      </button>
      {revealed && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="คัดลอก"
          className={`shrink-0 w-8 h-8 rounded-[8px] border cursor-pointer flex items-center justify-center active:scale-[0.92] transition-transform ${
            copied
              ? "bg-green-lt border-green/40 text-green"
              : "bg-cream border-bdr text-txt-mid"
          }`}
        >
          {copied ? (
            <IconCheck size={14} strokeWidth={2.4} />
          ) : (
            <IconCopy size={14} strokeWidth={2.4} />
          )}
        </button>
      )}
    </div>
  );
}
