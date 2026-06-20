import {
  AlertTriangle as IconAlertTriangle,
  CirclePlus as IconCirclePlus,
  MessageCircle as IconMessageCircle,
} from "lucide-react";
import { useState } from "react";
import { BUSINESS_RULES, COLORS, THAI_MONTH_NAMES } from "../../constants";
import { formatThaiNumber } from "../../utils/format";
import BaseModal from "../shared/BaseModal";

/* ─── Advance Request Modal ────────────────────────────────────── */
export default function AdvanceRequestModal({
  profile,
  employee,
  employeeId,
  salaryData,
  advanceRequests,
  onSubmit,
  onClose,
}: {
  profile: any;
  employee: any;
  employeeId: string;
  salaryData: any;
  advanceRequests: any[];
  onSubmit: (data: { amount: number; reason: string; month: string }) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const employeeSalary = employeeId
    ? salaryData[employeeId]?.[yearMonth]
    : null;
  // วงเงินคิดจากเงินเดือนพื้นฐาน: เอาจากข้อมูลพนักงานปัจจุบันก่อน → ถ้าไม่มี
  // ใช้ snapshot เดือนนี้ → ถ้าเดือนนี้ยังไม่ตั้งค่า (เช่นต้น/สิ้นเดือน) ใช้
  // baseSalary จากเดือนล่าสุดที่มีข้อมูล. ใช้ || (ไม่ใช่ ??) — ค่า 0 ถือว่า
  // "ยังไม่ได้ตั้ง" ให้ข้ามไป fallback กันวงเงินเป็น 0 จนปุ่มเทากดไม่ได้
  const latestSalary = employeeId
    ? salaryData[employeeId]?.[
        Object.keys(salaryData[employeeId] || {})
          .sort()
          .reverse()[0]
      ]
    : null;
  const baseSalary =
    employee?.baseSalary ||
    employeeSalary?.baseSalary ||
    latestSalary?.baseSalary ||
    0;
  const maxAdvance = Math.floor(
    baseSalary * BUSINESS_RULES.ADVANCE_LIMIT_PERCENT,
  );

  // total already approved this month
  const myReqs = (advanceRequests || []).filter((r) => r.month === yearMonth);
  const alreadyRequested = myReqs
    .filter((r) => r.status !== "rejected")
    .reduce((s, r) => s + r.amount, 0);
  const remaining = Math.max(0, maxAdvance - alreadyRequested);

  // บล็อกเบิกเฉพาะวันสุดท้ายของเดือน (เป็นวันทำเงินเดือน) — กันสับสนในรอบจ่าย
  // เช่น เดือน 30 วัน → บล็อกวันที่ 30 · เดือน 31 วัน → บล็อกวันที่ 31
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const payrollLocked = now.getDate() === daysInMonth;

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    if (payrollLocked) {
      setErr("วันสุดท้ายของเดือนเป็นวันทำเงินเดือน — เบิกล่วงหน้าไม่ได้");
      return;
    }
    const amountValue = parseFloat(amount) || 0;
    if (amountValue <= 0) {
      setErr("กรุณาระบุจำนวนเงินที่ต้องการเบิก");
      return;
    }
    if (amountValue > remaining) {
      setErr(`เกินวงเงินคงเหลือ — เบิกได้สูงสุด ${formatThaiNumber(remaining)} ฿`);
      return;
    }
    setErr("");
    onSubmit({ amount: amountValue, reason: reason.trim(), month: yearMonth });
    setAmount("");
    setReason("");
  }

  return (
    <BaseModal onClose={onClose} contentClassName="px-5.5 pt-6 pb-7">
      {/* header */}
      <div className="flex items-center gap-3 mb-4.5">
        <div className="w-[46px] h-[46px] rounded-xl bg-linear-135 from-maroon to-maroon-lt flex items-center justify-center shadow-[0_4px_14px_rgba(123,28,28,0.25)]">
          <IconCirclePlus
            size={22}
            color="var(--color-gold-lt)"
            strokeWidth={2.2}
          />
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-lg text-txt">เบิกเงินล่วงหน้า</div>
          <div className="text-sm text-txt-soft mt-0.5">
            {THAI_MONTH_NAMES[now.getMonth()]} {now.getFullYear() + 543}
          </div>
        </div>
      </div>

      {payrollLocked && (
        <div className="bg-amber-lt rounded-xl px-3.5 py-3 mb-3.5 border border-amber/30 flex items-start gap-2">
          <IconAlertTriangle
            size={16}
            className="text-amber mt-0.5 shrink-0"
            strokeWidth={2.4}
          />
          <div className="text-sm text-txt-mid leading-normal">
            <b className="text-amber">วันสุดท้ายของเดือน</b> เป็นวันทำเงินเดือน —
            เบิกล่วงหน้าไม่ได้ในวันนี้ เพื่อกันความสับสนในรอบจ่ายเงิน
          </div>
        </div>
      )}

      {/* limit info */}
      <div className="bg-gold-pale rounded-xl px-3.5 py-3 mb-3.5 border border-gold/25">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm text-txt-mid">
            วงเงินสูงสุด{" "}
            <span className="text-[11px] text-txt-soft">
              (50% ของเงินเดือนพื้นฐาน)
            </span>
          </span>
          <span className="text-sm font-bold text-maroon">
            {formatThaiNumber(maxAdvance)} ฿
          </span>
        </div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm text-txt-mid">เบิกไปแล้วเดือนนี้</span>
          <span className="text-sm font-bold text-txt-mid">
            {formatThaiNumber(alreadyRequested)} ฿
          </span>
        </div>
        <div className="h-px bg-gold/25 my-1.5" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-txt">คงเหลือเบิกได้</span>
          <span className="text-lg font-extrabold text-green">
            {formatThaiNumber(remaining)} ฿
          </span>
        </div>
      </div>

      {/* amount */}
      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        จำนวนเงินที่ต้องการเบิก
      </label>
      <div className="relative mb-3">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-maroon font-bold">
          ฿
        </span>
        <input
          type="text"
          inputMode="decimal"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className={`w-full py-3.5 pr-4 pl-9 rounded-xl text-lg font-bold font-[inherit] text-txt bg-cream box-border outline-none border-[1.5px] ${err.includes("เงิน") || err.includes("วงเงิน") ? "border-red" : "border-bdr"}`}
        />
      </div>

      {/* quick buttons */}
      <div className="flex gap-1.5 mb-3.5">
        {[500, 1000, 2000, 3000]
          .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
          .slice(0, 4)
          .map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="flex-1 py-1.5 px-1 rounded-[9px] border border-bdr bg-white text-maroon text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
            >
              {formatThaiNumber(v)} ฿
            </button>
          ))}
      </div>

      {/* reason — ไม่บังคับ */}
      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        เหตุผล <span className="font-normal text-txt-soft">(ถ้ามี)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={150}
        placeholder="เช่น ค่ารักษาพยาบาล, เหตุฉุกเฉิน"
        className={`w-full px-3.5 py-3 rounded-xl text-sm resize-none outline-none font-[inherit] box-border text-txt bg-white leading-relaxed border-[1.5px] ${err.includes("เหตุผล") ? "border-red" : "border-bdr"} ${err ? "mb-1.5" : "mb-3.5"}`}
      />

      {err && (
        <div className="text-red text-sm mb-3.5 inline-flex items-center gap-1">
          <IconAlertTriangle size={14} strokeWidth={2.4} />
          {err}
        </div>
      )}

      {/* LINE notice */}
      <div className="bg-[#06C75510] rounded-[10px] px-3.5 py-2.5 mb-4 border border-[#06C75530] flex gap-2.5 items-center">
        <IconMessageCircle size={18} strokeWidth={2.2} color={COLORS.maroon} />
        <div className="text-xs text-txt-mid leading-normal">
          คำขอจะถูกส่งไปยัง ADMIN ผ่าน <b className="text-[#06C755]">LINE</b> ทันที
          <br />
          ADMIN จะโอนเงินและส่งสลิปกลับมาในแอป
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={onClose}
          className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={() => {
            if (payrollLocked) {
              setErr("วันสุดท้ายของเดือนเป็นวันทำเงินเดือน — เบิกล่วงหน้าไม่ได้");
              return;
            }
            if (remaining <= 0) {
              setErr("เบิกครบวงเงินของเดือนนี้แล้ว — ต้องรอเดือนถัดไป");
              return;
            }
            submit();
          }}
          className={`flex-2 p-3.5 rounded-xl border-none text-base font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5
            ${
              payrollLocked || remaining <= 0
                ? "bg-bdr text-txt-soft shadow-none"
                : "bg-maroon text-white shadow-[0_4px_14px_rgba(123,28,28,0.25)]"
            }`}
        >
          {payrollLocked
            ? "วันทำเงินเดือน — เบิกไม่ได้"
            : remaining <= 0
              ? "เต็มวงเงินแล้ว"
              : "ส่งคำขอผ่าน LINE"}
        </button>
      </div>
    </BaseModal>
  );
}
