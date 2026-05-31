/* ─── BankPicker — custom dropdown that shows the bank SVG logo ──
   ใช้แทน <select> เพราะ native <option> รับเฉพาะ text — ไม่สามารถ
   แสดง <img> ของโลโก้ธนาคารได้

   API คล้าย controlled select:
   - value: ชื่อธนาคารปัจจุบัน (เช่น "ธนาคารกสิกรไทย") | ""
   - onChange(name)
   - error: ถ้ามี → กรอบแดง
   - placeholder: ข้อความตอนยังไม่เลือก                            */

import { ChevronDown as IconChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THAI_BANKS } from "../../constants";
import BankLogo from "./BankLogo";

interface BankPickerProps {
  value: string;
  onChange: (name: string) => void;
  error?: boolean;
  placeholder?: string;
}

export default function BankPicker({
  value,
  onChange,
  error = false,
  placeholder = "— เลือกธนาคาร —",
}: BankPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = THAI_BANKS.find((b) => b.name === value) || null;

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full py-3 pr-10 pl-3 rounded-xl text-base outline-none font-[inherit] box-border cursor-pointer border-[1.5px] flex items-center gap-2.5 text-left
          ${error ? "border-red" : "border-bdr"}
          ${selected ? "text-txt bg-gold-pale/30 font-semibold" : "text-txt-soft bg-white font-normal"}`}
      >
        {selected ? (
          <>
            <BankLogo bank={selected.name} size={28} />
            <span className="flex-1 min-w-0 truncate">
              {selected.name}
              {selected.short ? (
                <span className="text-xs text-txt-soft font-normal ml-1">
                  ({selected.short})
                </span>
              ) : null}
            </span>
          </>
        ) : (
          <span className="flex-1">{placeholder}</span>
        )}
        <IconChevronDown
          className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          size={14}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 max-h-[280px] overflow-y-auto bg-white border border-bdr rounded-xl shadow-[0_10px_30px_rgba(45,26,14,0.18)]"
        >
          {THAI_BANKS.map((b) => {
            const active = b.name === value;
            return (
              <button
                key={b.name}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(b.name);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left text-sm font-[inherit] border-none cursor-pointer ${active ? "bg-gold-pale" : "bg-white hover:bg-cream"}`}
              >
                <BankLogo bank={b.name} size={26} />
                <span className="flex-1 min-w-0 truncate text-txt font-semibold">
                  {b.name}
                </span>
                {b.short && (
                  <span className="text-xs text-txt-soft font-medium shrink-0">
                    {b.short}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
