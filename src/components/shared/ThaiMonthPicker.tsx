/* ─── ThaiMonthPicker — เลือกเดือน/ปี (พ.ศ.) ภาษาไทย ──────────────
   ใช้แทน <input type="month"> ที่ native picker บังคับแสดงภาษาอังกฤษ
   (เช่น "June 2569 BE" บน iOS) — คุมข้อความ native ไม่ได้

   value/onChange เป็นรูปแบบ "YYYY-MM" (ค.ศ.) เหมือน input month เดิม     */

import {
  Calendar as IconCalendar,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
} from "lucide-react";
import { useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";

const SHORT_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

interface Props {
  value: string; // "YYYY-MM"
  onChange: (value: string) => void;
}

export default function ThaiMonthPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [selY, selM] = value
    ? value.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const [viewYear, setViewYear] = useState(selY || now.getFullYear());

  const label = `${THAI_MONTH_NAMES[(selM || 1) - 1]} ${(selY || now.getFullYear()) + 543}`;

  function pick(monthIdx: number) {
    onChange(`${viewYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* ปุ่มแสดงค่าปัจจุบัน */}
      <button
        type="button"
        onClick={() => {
          setViewYear(selY || now.getFullYear());
          setOpen((v) => !v);
        }}
        className="w-full flex items-center gap-2 py-[9px] px-3 rounded-[9px] text-sm font-bold font-[inherit] text-txt border-[1.5px] border-bdr bg-white text-left cursor-pointer"
      >
        <IconCalendar
          size={15}
          strokeWidth={2.4}
          className="text-maroon shrink-0"
        />
        <span className="flex-1">{label}</span>
      </button>

      {/* แผงเลือก เดือน/ปี */}
      {open && (
        <div className="mt-2 rounded-[10px] border-[1.5px] border-bdr bg-white p-2.5 shadow-[0_8px_24px_rgba(90,30,10,0.12)]">
          {/* ปีก่อนหน้า/ถัดไป */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              aria-label="ปีก่อนหน้า"
              onClick={() => setViewYear((y) => y - 1)}
              className="w-8 h-8 rounded-[8px] border border-bdr bg-cream flex items-center justify-center cursor-pointer active:scale-[0.92] transition-transform"
            >
              <IconChevronLeft
                size={16}
                strokeWidth={2.4}
                className="text-maroon"
              />
            </button>
            <div className="font-extrabold text-base text-maroon">
              พ.ศ. {viewYear + 543}
            </div>
            <button
              type="button"
              aria-label="ปีถัดไป"
              onClick={() => setViewYear((y) => y + 1)}
              className="w-8 h-8 rounded-[8px] border border-bdr bg-cream flex items-center justify-center cursor-pointer active:scale-[0.92] transition-transform"
            >
              <IconChevronRight
                size={16}
                strokeWidth={2.4}
                className="text-maroon"
              />
            </button>
          </div>

          {/* ตาราง 12 เดือน */}
          <div className="grid grid-cols-3 gap-1.5">
            {SHORT_MONTHS.map((label, idx) => {
              const isSel = viewYear === selY && idx + 1 === selM;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pick(idx)}
                  className={`py-2 rounded-[8px] text-sm font-semibold cursor-pointer font-[inherit] border-[1.5px] active:scale-[0.96] transition-transform ${
                    isSel
                      ? "bg-maroon text-white border-maroon"
                      : "bg-white text-txt-mid border-bdr hover:border-gold"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
