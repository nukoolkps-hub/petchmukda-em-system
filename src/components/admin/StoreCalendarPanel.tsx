/* ─── StoreCalendarPanel — ปฏิทินวันเปิด-ปิดร้าน ────────────────────
   2 การ์ดในหน้าเดียว:
   1. เสาร์เปิดพิเศษ  — admin เพิ่มเสาร์ที่ให้พนักงานมาทำงาน
   2. วันธรรมดาปิดพิเศษ — admin เพิ่ม จ-ศ ที่ปิดร้าน (อบรม/หยุดยาว ฯลฯ)
   เพิ่ม → save ทันที (real-time sync) · ลบ → save ทันที                  */

import {
  CalendarOff as IconCalendarOff,
  CalendarPlus as IconCalendarPlus,
  ChevronDown as IconChevronDown,
  Coins as IconCoins,
  Plus as IconPlus,
  Store as IconStore,
  Trash2 as IconTrash,
  X as IconX,
} from "lucide-react";
import { useState } from "react";
import type { Employee, LeaveEntry, StoreCalendar } from "../../types";
import { fmtShortWithWeekday } from "../../utils/dateUtils";
import BaseModal from "../shared/BaseModal";
import ThaiDateInput from "../shared/ThaiDateInput";

interface Props {
  storeCalendar: StoreCalendar;
  onUpdate: (cal: StoreCalendar) => Promise<void>;
  allLeaves: LeaveEntry[];
  employeeDirectory: Employee[];
  showToast?: (msg: string) => void;
}

/** alias สำหรับใช้ชื่อเดิมใน panel นี้ */
const fmtYmd = fmtShortWithWeekday;

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

/** หาใบลาที่ active วันที่ ymd · return list ของชื่อ (live nickname > snapshot) */
function leavesOnDate(
  ymd: string,
  allLeaves: LeaveEntry[],
  directory: Employee[],
): string[] {
  return allLeaves
    .filter((lv) => lv.start <= ymd && ymd <= lv.end)
    .map((lv) => {
      const live = directory.find((e) => e.id === lv.employeeId);
      return (
        live?.nickname ||
        lv.employeeNickname ||
        live?.name ||
        lv.employeeName
      );
    });
}

export default function StoreCalendarPanel({
  storeCalendar,
  onUpdate,
  allLeaves,
  employeeDirectory,
  showToast,
}: Props) {
  const [adding, setAdding] = useState<"sat" | "wd" | null>(null);
  const [satPick, setSatPick] = useState("");
  const [wdPick, setWdPick] = useState("");
  const [busy, setBusy] = useState(false);
  // confirm-before-remove · เปิด modal ตอน admin ลบเฉพาะวันที่มีใบลา ·
  // วันไหนไม่มีใบลาลบเลย ไม่ต้อง confirm
  const [confirmRemove, setConfirmRemove] = useState<{
    field: keyof StoreCalendar;
    ymd: string;
    names: string[];
  } | null>(null);

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
      // ลบเสาร์ → ลบ paid flag ด้วย (subset constraint)
      const isSat = field === "extraOpenSaturdays";
      await onUpdate({
        ...storeCalendar,
        [field]: (storeCalendar[field] as string[]).filter((d) => d !== ymd),
        ...(isSat
          ? {
              paidExtraSaturdays: (storeCalendar.paidExtraSaturdays ?? []).filter(
                (d) => d !== ymd,
              ),
            }
          : {}),
      });
      showToast?.("ลบแล้ว");
    } catch (e) {
      console.error(e);
      showToast?.("ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  /** ตรวจใบลาก่อนลบ · ถ้ามี → confirm modal · ไม่มี → ลบเลย */
  function requestRemove(field: keyof StoreCalendar, ymd: string) {
    if (busy) return;
    const names = leavesOnDate(ymd, allLeaves, employeeDirectory);
    if (names.length === 0) {
      remove(field, ymd);
      return;
    }
    setConfirmRemove({ field, ymd, names });
  }

  async function togglePaid(ymd: string) {
    if (busy) return;
    setBusy(true);
    try {
      const paid = new Set(storeCalendar.paidExtraSaturdays ?? []);
      if (paid.has(ymd)) paid.delete(ymd);
      else paid.add(ymd);
      await onUpdate({
        ...storeCalendar,
        paidExtraSaturdays: [...paid],
      });
    } catch (e) {
      console.error(e);
      showToast?.("บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const paidSet = new Set(storeCalendar.paidExtraSaturdays ?? []);

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
              เสาร์ที่ ADMIN ให้เปิดร้าน — คิดเหมือนวันธรรมดา
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
          <div className="border-b border-bdr bg-cream/40">
            <div className="px-3.5 py-3 flex gap-2 items-center">
              <div className="relative flex-1">
                <select
                  value={satPick}
                  onChange={(e) => setSatPick(e.target.value)}
                  className="appearance-none cursor-pointer w-full pl-2.5 pr-7 py-2 rounded-[8px] border border-bdr text-sm font-semibold outline-none font-[inherit] bg-white text-txt"
                >
                  <option value="">— เลือกเสาร์ —</option>
                  {satOptions.map((o) => (
                    <option key={o.ymd} value={o.ymd}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <IconChevronDown
                  size={12}
                  strokeWidth={2.4}
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
                />
              </div>
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
            {/* warning: ถ้ามีใบลาในเสาร์ที่เลือก → จะกลายเป็นวันทำงาน · ใบลานับโควต้า */}
            {satPick &&
              (() => {
                const names = leavesOnDate(
                  satPick,
                  allLeaves,
                  employeeDirectory,
                );
                if (names.length === 0) return null;
                return (
                  <div className="mx-3.5 mb-3 px-3 py-2 rounded-[8px] bg-amber-50 border border-amber-300 text-xs leading-relaxed text-amber-900 flex gap-2">
                    <span className="shrink-0">⚠</span>
                    <div>
                      <b>มีใบลา {names.length} คนวันนี้</b> ({names.join(", ")})
                      <br />
                      หลังเปิดเสาร์นี้ ใบลาจะ <b>นับโควต้า + อาจหักเงิน</b>{" "}
                      (เหมือนวันธรรมดา)
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {/* list */}
        <div className="px-3.5 py-2.5">
          {sat.upcoming.length === 0 && sat.past.length === 0 && (
            <div className="text-sm text-txt-soft text-center py-3">
              ยังไม่มี — กด "เพิ่ม" เพื่อกำหนดเสาร์เปิดพิเศษ
            </div>
          )}
          {sat.upcoming.map((d) => {
            const isPaid = paidSet.has(d);
            return (
              <div
                key={d}
                className="flex items-center gap-2 py-1.5 border-b border-bdr/40 last:border-b-0"
              >
                <span className="flex-1 text-sm font-semibold text-txt">
                  {fmtYmd(d)}
                </span>
                <button
                  type="button"
                  onClick={() => togglePaid(d)}
                  disabled={busy}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-[7px] border text-xs font-bold font-[inherit] cursor-pointer ${
                    isPaid
                      ? "bg-green-lt text-green border-green/30"
                      : "bg-cream text-txt-soft border-bdr"
                  }`}
                  title="ติ๊กให้พนักงานที่มาทำงานได้เงินเพิ่ม 1 วัน"
                >
                  <IconCoins size={12} strokeWidth={2.4} />
                  เงินเพิ่ม
                </button>
                <button
                  type="button"
                  onClick={() => requestRemove("extraOpenSaturdays", d)}
                  disabled={busy}
                  aria-label="ลบ"
                  className="w-7 h-7 rounded-[7px] bg-red-lt text-red border border-red/20 cursor-pointer flex items-center justify-center"
                >
                  <IconTrash size={12} strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
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
                    onClick={() => requestRemove("extraOpenSaturdays", d)}
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
          <div className="border-b border-bdr bg-cream/40">
            <div className="px-3.5 py-3 flex gap-2 items-center">
              <ThaiDateInput
                value={wdPick}
                onChange={setWdPick}
                className="flex-1 px-2.5 py-2 rounded-[8px] border border-bdr text-sm outline-none font-[inherit] bg-white"
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
            {/* warning: ถ้ามีใบลาในวันที่ปิด → ใบลายังอยู่แต่ไม่นับโควต้า */}
            {wdPick &&
              (() => {
                const names = leavesOnDate(
                  wdPick,
                  allLeaves,
                  employeeDirectory,
                );
                if (names.length === 0) return null;
                return (
                  <div className="mx-3.5 mb-3 px-3 py-2 rounded-[8px] bg-emerald-50 border border-emerald-300 text-xs leading-relaxed text-emerald-900 flex gap-2">
                    <span className="shrink-0">ℹ</span>
                    <div>
                      <b>มีใบลา {names.length} คนวันนี้</b> ({names.join(", ")})
                      <br />
                      หลังปิดวันนี้ ใบลายังอยู่ในระบบ แต่{" "}
                      <b>ไม่นับโควต้า · ไม่หักเงิน</b>{" "}
                      (ระบบคืนสิทธิ์ลาให้อัตโนมัติ)
                    </div>
                  </div>
                );
              })()}
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
                onClick={() => requestRemove("extraClosedWeekdays", d)}
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
                    onClick={() => requestRemove("extraClosedWeekdays", d)}
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

      {/* Confirm-remove modal — เปิดเมื่อ admin ลบวันที่มีใบลา ·
          อธิบายผลกระทบกับใบลาก่อนยืนยัน */}
      {confirmRemove && (
        <BaseModal onClose={() => !busy && setConfirmRemove(null)}>
          <div className="bg-white rounded-2xl p-5 w-full">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-2xl">⚠️</span>
              <div className="text-lg font-bold text-maroon">
                ยืนยันลบ?
              </div>
            </div>
            <div className="text-sm text-txt-mid mb-3 leading-relaxed">
              <div className="mb-1">
                วันที่:{" "}
                <b className="text-txt">{fmtYmd(confirmRemove.ymd)}</b>
              </div>
              <div>
                มีใบลา <b className="text-amber-800">{confirmRemove.names.length} คน</b>{" "}
                ในวันนี้:
                <div className="mt-1 px-2.5 py-1.5 rounded-[8px] bg-cream border border-bdr text-xs leading-relaxed">
                  {confirmRemove.names.join(" · ")}
                </div>
              </div>
            </div>

            {confirmRemove.field === "extraOpenSaturdays" ? (
              <div className="px-3 py-2.5 rounded-[10px] bg-emerald-50 border border-emerald-300 text-xs leading-relaxed text-emerald-900 mb-3.5 flex gap-2">
                <span className="shrink-0">ℹ</span>
                <div>
                  หลังลบ · เสาร์นี้กลับเป็น "ปิด" → ใบลา{" "}
                  <b>ไม่นับโควต้า · ไม่หักเงิน</b>{" "}
                  (พนักงานได้สิทธิ์ลาคืนอัตโนมัติ)
                </div>
              </div>
            ) : (
              <div className="px-3 py-2.5 rounded-[10px] bg-amber-50 border border-amber-300 text-xs leading-relaxed text-amber-900 mb-3.5 flex gap-2">
                <span className="shrink-0">⚠</span>
                <div>
                  หลังลบ · วันนี้กลับเป็น "เปิด" → ใบลาจะ{" "}
                  <b>นับโควต้า + อาจหักเงิน</b>{" "}
                  (พนักงานอาจเกินโควต้าโดยไม่รู้ตัว)
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg bg-white text-txt-mid text-sm font-bold border border-bdr cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmRemove;
                  setConfirmRemove(null);
                  await remove(target.field, target.ymd);
                }}
                disabled={busy}
                className={`flex-1 py-2.5 rounded-lg bg-red text-white text-sm font-bold border-none font-[inherit] shadow-[0_3px_10px_rgba(192,57,43,0.25)] ${busy ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
