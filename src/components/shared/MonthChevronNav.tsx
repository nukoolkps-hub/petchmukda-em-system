/* ─── MonthChevronNav — ตัวเลือกเดือนแบบลูกศร + popover เลือกเดือน/ปี ──
   - months เรียงใหม่→เก่า (YYYY-MM)
   - selected = เดือนที่กำลังเปิดอยู่
   - แตะ label เปิด popover เลือกเดือน/ปีตรงๆ (กระโดดได้ไม่ต้องกดลูกศรย้อน)
   - ปุ่ม disable ที่ปลายช่วง · popover ใช้ Buddhist year + ตัวย่อเดือน
   ใช้ใน: SalaryView (สลิป) · LeaveListPanel (ฟิลเตอร์ใบลา)                 */

import {
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  THAI_MONTH_NAMES,
  THAI_MONTH_SHORT_NAMES,
} from "../../constants";
import { useClickOutside } from "../../hooks/useClickOutside";

interface Props {
  months: string[]; // "YYYY-MM" · เรียงใหม่→เก่า
  selected: string;
  onSelect: (m: string) => void;
  /** ตำแหน่ง popover เลือกเดือน/ปี · "left" (default) หรือ "right" */
  popoverSide?: "left" | "right";
  /** บรรทัดเล็กใต้ชื่อเดือน (เช่น "4 รายการ") · optional */
  subtitle?: string;
}

export default function MonthChevronNav({
  months,
  selected,
  onSelect,
  popoverSide = "left",
  subtitle,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false), open);

  const idx = months.indexOf(selected);
  const hasOlder = idx < months.length - 1; // ‹ = เดือนเก่ากว่า
  const hasNewer = idx > 0; // › = เดือนใหม่กว่า
  const [y, mo] = selected ? selected.split("-") : ["0", "0"];

  // จัดกลุ่มเดือนตามปี (พ.ศ.) — คงลำดับใหม่→เก่า สำหรับ popover
  const byYear: { year: number; items: string[] }[] = [];
  for (const m of months) {
    const yr = parseInt(m.slice(0, 4), 10);
    let g = byYear.find((x) => x.year === yr);
    if (!g) {
      g = { year: yr, items: [] };
      byYear.push(g);
    }
    g.items.push(m);
  }

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        aria-label="เดือนก่อนหน้า"
        disabled={!hasOlder}
        onClick={() => hasOlder && onSelect(months[idx + 1])}
        className="w-8 h-8 rounded-[9px] border border-bdr bg-cream cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <IconChevronLeft size={14} strokeWidth={2.5} className="text-txt-mid" />
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`px-3 rounded-[9px] border border-bdr bg-cream text-sm font-semibold text-txt min-w-[112px] text-center cursor-pointer font-[inherit] ${subtitle ? "py-1.5 leading-tight" : "h-8"}`}
      >
        <div>
          {THAI_MONTH_NAMES[parseInt(mo, 10) - 1]} {parseInt(y, 10) + 543}
        </div>
        {subtitle && (
          <div className="text-[11px] text-txt-soft font-normal mt-0.5">
            {subtitle}
          </div>
        )}
      </button>
      <button
        type="button"
        aria-label="เดือนถัดไป"
        disabled={!hasNewer}
        onClick={() => hasNewer && onSelect(months[idx - 1])}
        className="w-8 h-8 rounded-[9px] border border-bdr bg-cream cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <IconChevronRight
          size={14}
          strokeWidth={2.5}
          className="text-txt-mid"
        />
      </button>

      {open && (
        <div
          className={`absolute z-20 top-full ${popoverSide === "right" ? "right-0" : "left-0"} mt-1.5 w-[196px] rounded-[12px] border-[1.5px] border-bdr bg-white p-2 shadow-[0_8px_24px_rgba(90,30,10,0.14)] max-h-[280px] overflow-y-auto`}
        >
          {byYear.map((g) => (
            <div key={g.year} className="mb-2 last:mb-0">
              <div className="text-[11px] font-bold text-txt-soft px-1 mb-1">
                ปี {g.year + 543}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {g.items.map((m) => {
                  const mm = parseInt(m.slice(5, 7), 10);
                  const isSel = m === selected;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        onSelect(m);
                        setOpen(false);
                      }}
                      className={`py-2 px-1 rounded-[8px] text-sm font-semibold cursor-pointer font-[inherit] transition-colors ${
                        isSel
                          ? "bg-maroon text-white"
                          : "bg-transparent text-txt-mid hover:bg-cream"
                      }`}
                    >
                      {THAI_MONTH_SHORT_NAMES[mm - 1]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
