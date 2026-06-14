/* ─── DateDiffHelper — กล่องตัวช่วยคำนวณช่วงเวลาระหว่าง 2 วันที่ ──────
   ใช้ใน "ความรู้ต่างๆ" → ดอกเบี้ยจำนำ · user กรอกวันที่เริ่ม + สิ้นสุด →
   ระบบคำนวณ "เดือนเต็ม + วันเศษ" ตามกฎ calendar month (5 ม.ค. → 5 ก.พ.
   = 1 เดือนเต็ม) · user copy ตัวเลขลงเครื่องคิดเลขด้านล่างเอง           */

import { Calendar as IconCalendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";

interface Props {
  /** callback ส่ง result กลับให้ parent · ใช้กับ auto-fill calculator */
  onComputed?: (months: number, days: number) => void;
  /** override ข้อความใต้กล่อง (เช่น "ระบบจะเติมให้ในเครื่องคิดเลขด้านล่างอัตโนมัติ") */
  hint?: string;
}

/** คำนวณช่วงเวลาระหว่าง 2 วันที่เป็น "เดือนเต็ม + วันเศษ"
 *  กฎ: เดือนเต็มนับจาก วันที่เดิมในเดือนถัดไป (5 ม.ค. → 5 ก.พ. = 1 เดือน)
 *  ถ้าเดือนปลายทางไม่มีวันที่นั้น (เช่น Jan 31 → Feb) → ใช้วันสุดท้ายของเดือน */
function diffMonthsAndDays(
  start: Date,
  end: Date,
): { months: number; days: number } {
  if (end.getTime() < start.getTime()) return { months: -1, days: 0 };

  // เดือนคร่าวๆ จาก calendar diff
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  // ถ้าวันที่ปลาย < วันที่ต้น → ยังไม่ครบเดือนเต็ม ลบ 1
  if (end.getDate() < start.getDate()) months--;
  if (months < 0) months = 0;

  // หา "วันที่ที่ครบ months เดือน" — cap ที่วันสุดท้ายของเดือนถ้าวันที่ start
  // เกินเดือนปลายทาง (เช่น 31 ม.ค. + 1 เดือน = 28/29 ก.พ.)
  const intYear =
    start.getFullYear() + Math.floor((start.getMonth() + months) / 12);
  const intMonth = (start.getMonth() + months) % 12;
  const daysInIntMonth = new Date(intYear, intMonth + 1, 0).getDate();
  const cappedDay = Math.min(start.getDate(), daysInIntMonth);
  const intermediate = new Date(intYear, intMonth, cappedDay);

  const days = Math.round(
    (end.getTime() - intermediate.getTime()) / 86_400_000,
  );
  return { months, days };
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** format "2026-01-05" → "5 มกราคม 2569" (พ.ศ.) — ใช้แสดงใต้ date input */
function fmtThaiDate(ymd: string): string {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = THAI_MONTH_NAMES[d.getMonth()];
  const yearBE = d.getFullYear() + 543;
  return `${day} ${month} ${yearBE}`;
}

export default function DateDiffHelper({ onComputed, hint }: Props = {}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(todayYmd());

  const result = useMemo(() => {
    if (!start || !end) return null;
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    return diffMonthsAndDays(s, e);
  }, [start, end]);

  // ส่งผลกลับให้ parent (ใช้กับ auto-fill calculator)
  useEffect(() => {
    if (!onComputed || !result || result.months < 0) return;
    onComputed(result.months, result.days);
  }, [onComputed, result]);

  return (
    <div className="mb-3 rounded-[12px] border-[1.5px] border-gold/40 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gold-pale text-maroon text-xs font-extrabold inline-flex items-center gap-1.5 w-full border-b border-gold/30">
        <IconCalendar size={13} strokeWidth={2.5} />
        ตัวช่วย — คำนวณช่วงเวลาจากปฏิทิน
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <label
            htmlFor="pawn-date-start"
            className="text-xs font-semibold text-txt-mid flex-1 min-w-0 pt-1"
          >
            วันเริ่มจำนำ
          </label>
          <div className="flex flex-col items-end gap-0.5">
            <input
              id="pawn-date-start"
              type="date"
              lang="th"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
              className="w-[160px] px-2 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt font-[inherit] outline-none bg-white"
            />
            {start && (
              <div className="text-[10px] font-bold text-maroon">
                {fmtThaiDate(start)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <label
            htmlFor="pawn-date-end"
            className="text-xs font-semibold text-txt-mid flex-1 min-w-0 pt-1"
          >
            วันสิ้นสุดการจำนำ
          </label>
          <div className="flex flex-col items-end gap-0.5">
            <input
              id="pawn-date-end"
              type="date"
              lang="th"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className="w-[160px] px-2 py-1 rounded-[7px] border border-bdr text-sm font-bold text-txt font-[inherit] outline-none bg-white"
            />
            {end && (
              <div className="text-[10px] font-bold text-maroon">
                {fmtThaiDate(end)}
              </div>
            )}
          </div>
        </div>

        {result !== null && (
          <div className="mt-2 px-3 py-2 bg-cream/60 rounded-[8px] border border-bdr/40 text-center">
            {result.months < 0 ? (
              <span className="text-xs font-bold text-red">
                วันสิ้นสุดต้องอยู่หลังวันเริ่ม
              </span>
            ) : (
              <>
                <span className="text-xs text-txt-soft">ระยะเวลาที่จำนำ = </span>
                <span className="text-base font-extrabold text-maroon tabular-nums">
                  {result.months}
                </span>
                <span className="text-xs text-txt-soft"> เดือนเต็ม </span>
                <span className="text-base font-extrabold text-maroon tabular-nums">
                  + {result.days}
                </span>
                <span className="text-xs text-txt-soft"> วันเศษ</span>
              </>
            )}
          </div>
        )}

        <div className="text-[10px] text-txt-soft/80 italic text-center">
          {hint ??
            'นำตัวเลขด้านบนใส่ใน "ระยะเวลา (เดือนเต็ม)" + "วันเศษ" ของเครื่องคิดเลข'}
        </div>
      </div>
    </div>
  );
}
