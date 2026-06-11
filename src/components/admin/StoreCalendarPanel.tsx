/* ─── StoreCalendarPanel — ปฏิทินวันเปิด-ปิดร้าน ────────────────────
   2 การ์ดในหน้าเดียว:
   1. เสาร์เปิดพิเศษ  — admin เพิ่มเสาร์ที่ให้พนักงานมาทำงาน
   2. วันธรรมดาปิดพิเศษ — admin เพิ่ม จ-ศ ที่ปิดร้าน (อบรม/หยุดยาว ฯลฯ)
   เพิ่ม → save ทันที (real-time sync) · ลบ → save ทันที                  */

import {
  CalendarOff as IconCalendarOff,
  CalendarPlus as IconCalendarPlus,
  Plus as IconPlus,
  Store as IconStore,
  Trash2 as IconTrash,
  X as IconX,
} from "lucide-react";
import { useState } from "react";
import type { StoreCalendar } from "../../types";

interface Props {
  storeCalendar: StoreCalendar;
  onUpdate: (cal: StoreCalendar) => Promise<void>;
  showToast?: (msg: string) => void;
}

/** "2026-06-13" → "ส. 13 มิ.ย. 2569" */
function fmtYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][dt.getDay()];
  const monthShort = [
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
  ][m - 1];
  return `${dow} ${d} ${monthShort} ${y + 543}`;
}

/** สร้าง list ของเสาร์ใน 3 เดือนถัดไปจาก today */
function buildSaturdayOptions(): { ymd: string; label: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setMonth(end.getMonth() + 3);
  const out: { ymd: string; label: string }[] = [];
  const c = new Date(today);
  while (c <= end) {
    if (c.getDay() === 6) {
      const y = c.getFullYear();
      const m = String(c.getMonth() + 1).padStart(2, "0");
      const d = String(c.getDate()).padStart(2, "0");
      const ymd = `${y}-${m}-${d}`;
      out.push({ ymd, label: fmtYmd(ymd) });
    }
    c.setDate(c.getDate() + 1);
  }
  return out;
}

/** date input → YYYY-MM-DD (validate ว่าเป็น จ-ศ) */
function isWeekday(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow >= 1 && dow <= 5;
}

export default function StoreCalendarPanel({
  storeCalendar,
  onUpdate,
  showToast,
}: Props) {
  const [adding, setAdding] = useState<"sat" | "wd" | null>(null);
  const [satPick, setSatPick] = useState("");
  const [wdPick, setWdPick] = useState("");
  const [busy, setBusy] = useState(false);

  // เสาร์ตัวเลือก: future-only AND ยังไม่เคย mark ไว้
  const satOptions = buildSaturdayOptions().filter(
    (o) => !storeCalendar.extraOpenSaturdays.includes(o.ymd),
  );

  async function addSaturday() {
    if (!satPick || busy) return;
    setBusy(true);
    try {
      await onUpdate({
        ...storeCalendar,
        extraOpenSaturdays: [...storeCalendar.extraOpenSaturdays, satPick],
      });
      setSatPick("");
      setAdding(null);
      showToast?.("เพิ่มเสาร์เปิดพิเศษแล้ว");
    } catch (e) {
      console.error(e);
      showToast?.("เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function addWeekday() {
    if (!wdPick || busy) return;
    if (!isWeekday(wdPick)) {
      showToast?.("ต้องเป็นวันธรรมดา (จันทร์-ศุกร์)");
      return;
    }
    if (storeCalendar.extraClosedWeekdays.includes(wdPick)) {
      showToast?.("วันนี้อยู่ในรายการแล้ว");
      return;
    }
    setBusy(true);
    try {
      await onUpdate({
        ...storeCalendar,
        extraClosedWeekdays: [...storeCalendar.extraClosedWeekdays, wdPick],
      });
      setWdPick("");
      setAdding(null);
      showToast?.("เพิ่มวันธรรมดาปิดพิเศษแล้ว");
    } catch (e) {
      console.error(e);
      showToast?.("เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(field: keyof StoreCalendar, ymd: string) {
    if (busy) return;
    setBusy(true);
    try {
      await onUpdate({
        ...storeCalendar,
        [field]: storeCalendar[field].filter((d) => d !== ymd),
      });
      showToast?.("ลบแล้ว");
    } catch (e) {
      console.error(e);
      showToast?.("ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  // วันที่ในอดีต → เทาๆ (เก็บไว้แต่ลบเองได้)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d) < today;
  };

  // จัด sort + แยก past/future สำหรับ render
  function partition(list: string[]) {
    const sorted = [...list].sort();
    return {
      upcoming: sorted.filter((d) => !isPast(d)),
      past: sorted.filter(isPast),
    };
  }
  const sat = partition(storeCalendar.extraOpenSaturdays);
  const wd = partition(storeCalendar.extraClosedWeekdays);

  return (
    <div className="flex flex-col gap-3.5">
      {/* intro */}
      <div className="px-3.5 py-2.5 rounded-[10px] bg-cream border border-bdr text-sm text-txt-mid">
        <b className="text-maroon inline-flex items-center gap-1.5">
          <IconStore size={14} strokeWidth={2.4} />
          ปฏิทินเปิด-ปิดร้าน
        </b>
        <div className="mt-1 leading-relaxed">
          ค่าเริ่มต้น: <b>เสาร์ปิด</b> · <b>อาทิตย์เปิด</b> · <b>จันทร์-ศุกร์ เปิด</b>
          <br />
          ใส่ข้อยกเว้นในรายการด้านล่าง — ระบบจะใช้คำนวณหน้าที่ + การลาให้ทันที
        </div>
      </div>

      {/* เสาร์เปิดพิเศษ */}
      <div className="rounded-[12px] border border-bdr bg-white">
        <div className="px-3.5 py-3 border-b border-bdr flex items-center gap-2">
          <IconCalendarPlus
            size={16}
            strokeWidth={2.4}
            className="text-green"
          />
          <div className="flex-1">
            <div className="font-bold text-maroon text-sm">เสาร์เปิดพิเศษ</div>
            <div className="text-xs text-txt-soft mt-0.5">
              เสาร์ที่ admin ให้เปิดร้าน — คิดเหมือนวันธรรมดา
            </div>
          </div>
          {adding !== "sat" && (
            <button
              type="button"
              onClick={() => setAdding("sat")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] bg-green-lt text-green border border-green/25 text-xs font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
            >
              <IconPlus size={13} strokeWidth={2.6} />
              เพิ่ม
            </button>
          )}
        </div>

        {/* add row */}
        {adding === "sat" && (
          <div className="px-3.5 py-3 border-b border-bdr bg-cream/40 flex gap-2 items-center">
            <select
              value={satPick}
              onChange={(e) => setSatPick(e.target.value)}
              className="flex-1 px-2.5 py-2 rounded-[8px] border border-bdr text-sm font-semibold outline-none font-[inherit] bg-white"
            >
              <option value="">— เลือกเสาร์ —</option>
              {satOptions.map((o) => (
                <option key={o.ymd} value={o.ymd}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addSaturday}
              disabled={!satPick || busy}
              className={`px-3 py-2 rounded-[8px] border-none text-xs font-bold font-[inherit] ${
                satPick && !busy
                  ? "bg-maroon text-white cursor-pointer"
                  : "bg-bdr text-txt-soft cursor-not-allowed"
              }`}
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(null);
                setSatPick("");
              }}
              aria-label="ยกเลิก"
              className="w-8 h-8 rounded-[8px] border border-bdr bg-white text-txt-soft cursor-pointer flex items-center justify-center"
            >
              <IconX size={14} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {/* list */}
        <div className="px-3.5 py-2.5">
          {sat.upcoming.length === 0 && sat.past.length === 0 && (
            <div className="text-sm text-txt-soft text-center py-3">
              ยังไม่มี — กด "เพิ่ม" เพื่อกำหนดเสาร์เปิดพิเศษ
            </div>
          )}
          {sat.upcoming.map((d) => (
            <div
              key={d}
              className="flex items-center gap-2 py-1.5 border-b border-bdr/40 last:border-b-0"
            >
              <span className="flex-1 text-sm font-semibold text-txt">
                {fmtYmd(d)}
              </span>
              <button
                type="button"
                onClick={() => remove("extraOpenSaturdays", d)}
                disabled={busy}
                aria-label="ลบ"
                className="w-7 h-7 rounded-[7px] bg-red-lt text-red border border-red/20 cursor-pointer flex items-center justify-center"
              >
                <IconTrash size={12} strokeWidth={2.2} />
              </button>
            </div>
          ))}
          {sat.past.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-bdr">
              <div className="text-xs text-txt-soft mb-1.5">
                ผ่านไปแล้ว ({sat.past.length})
              </div>
              {sat.past.slice(-3).map((d) => (
                <div
                  key={d}
                  className="flex items-center gap-2 py-1 opacity-50"
                >
                  <span className="flex-1 text-xs text-txt-mid">
                    {fmtYmd(d)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove("extraOpenSaturdays", d)}
                    disabled={busy}
                    aria-label="ลบ"
                    className="w-6 h-6 rounded-[6px] bg-cream border border-bdr cursor-pointer flex items-center justify-center"
                  >
                    <IconX size={10} strokeWidth={2.2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* วันธรรมดาปิดพิเศษ */}
      <div className="rounded-[12px] border border-bdr bg-white">
        <div className="px-3.5 py-3 border-b border-bdr flex items-center gap-2">
          <IconCalendarOff size={16} strokeWidth={2.4} className="text-red" />
          <div className="flex-1">
            <div className="font-bold text-maroon text-sm">วันธรรมดาปิดพิเศษ</div>
            <div className="text-xs text-txt-soft mt-0.5">
              จันทร์-ศุกร์ ที่ปิดร้าน (อบรม, หยุดยาว ฯลฯ) — ลาวันนี้ไม่นับ
            </div>
          </div>
          {adding !== "wd" && (
            <button
              type="button"
              onClick={() => setAdding("wd")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[9px] bg-red-lt text-red border border-red/25 text-xs font-bold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
            >
              <IconPlus size={13} strokeWidth={2.6} />
              เพิ่ม
            </button>
          )}
        </div>

        {adding === "wd" && (
          <div className="px-3.5 py-3 border-b border-bdr bg-cream/40 flex gap-2 items-center">
            <input
              type="date"
              value={wdPick}
              onChange={(e) => setWdPick(e.target.value)}
              className="flex-1 px-2.5 py-2 rounded-[8px] border border-bdr text-sm font-semibold outline-none font-[inherit] bg-white"
            />
            <button
              type="button"
              onClick={addWeekday}
              disabled={!wdPick || busy}
              className={`px-3 py-2 rounded-[8px] border-none text-xs font-bold font-[inherit] ${
                wdPick && !busy
                  ? "bg-maroon text-white cursor-pointer"
                  : "bg-bdr text-txt-soft cursor-not-allowed"
              }`}
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(null);
                setWdPick("");
              }}
              aria-label="ยกเลิก"
              className="w-8 h-8 rounded-[8px] border border-bdr bg-white text-txt-soft cursor-pointer flex items-center justify-center"
            >
              <IconX size={14} strokeWidth={2.2} />
            </button>
          </div>
        )}

        <div className="px-3.5 py-2.5">
          {wd.upcoming.length === 0 && wd.past.length === 0 && (
            <div className="text-sm text-txt-soft text-center py-3">
              ยังไม่มี — ปกติเปิดทุก จ-ศ
            </div>
          )}
          {wd.upcoming.map((d) => (
            <div
              key={d}
              className="flex items-center gap-2 py-1.5 border-b border-bdr/40 last:border-b-0"
            >
              <span className="flex-1 text-sm font-semibold text-txt">
                {fmtYmd(d)}
              </span>
              <button
                type="button"
                onClick={() => remove("extraClosedWeekdays", d)}
                disabled={busy}
                aria-label="ลบ"
                className="w-7 h-7 rounded-[7px] bg-red-lt text-red border border-red/20 cursor-pointer flex items-center justify-center"
              >
                <IconTrash size={12} strokeWidth={2.2} />
              </button>
            </div>
          ))}
          {wd.past.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-bdr">
              <div className="text-xs text-txt-soft mb-1.5">
                ผ่านไปแล้ว ({wd.past.length})
              </div>
              {wd.past.slice(-3).map((d) => (
                <div
                  key={d}
                  className="flex items-center gap-2 py-1 opacity-50"
                >
                  <span className="flex-1 text-xs text-txt-mid">
                    {fmtYmd(d)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove("extraClosedWeekdays", d)}
                    disabled={busy}
                    aria-label="ลบ"
                    className="w-6 h-6 rounded-[6px] bg-cream border border-bdr cursor-pointer flex items-center justify-center"
                  >
                    <IconX size={10} strokeWidth={2.2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
