/* ─── ThemedSelect — custom dropdown ที่ใช้ฟอนต์ Prompt ทั้งกล่อง ─────────
   ใช้แทน native <select> เมื่อต้องการให้ option list ใช้ฟอนต์เดียวกับ UI
   (native <select> popover ใช้ system font — เปลี่ยนไม่ได้ผ่าน CSS)

   API ใกล้เคียง native select:
   - value: ค่าที่เลือกอยู่ (string) | ""
   - onChange(value)
   - options: { value, label, disabled? }[]
   - placeholder: ข้อความตอนยังไม่เลือก
   - disabled: ปิดทั้งช่อง
   - className: เพิ่ม class นอก default style                                  */

import { ChevronDown as IconChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";

export interface ThemedSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ThemedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** ปุ่มหลัก (closed state) — override class หลัก */
  className?: string;
}

export default function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = "— เลือก —",
  disabled = false,
  className,
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false), open, true);

  const selected = options.find((o) => o.value === value) || null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          className ??
          `pl-2.5 pr-7 py-[7px] rounded-lg border border-bdr text-sm font-semibold outline-none font-[inherit] bg-cream text-txt cursor-pointer text-left w-full flex items-center
            ${disabled ? "opacity-60 cursor-not-allowed" : ""}`
        }
      >
        <span className="flex-1 min-w-0 truncate">
          {selected ? selected.label : placeholder}
        </span>
        <IconChevronDown
          size={12}
          strokeWidth={2.4}
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-[280px] overflow-y-auto bg-white border border-bdr rounded-lg shadow-[0_8px_24px_rgba(45,26,14,0.15)] font-[inherit]"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={active}
                disabled={o.disabled}
                onClick={() => {
                  if (o.disabled) return;
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm font-[inherit] border-none cursor-pointer truncate
                  ${active ? "bg-gold-pale text-maroon font-bold" : "bg-white text-txt font-semibold hover:bg-cream"}
                  ${o.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
