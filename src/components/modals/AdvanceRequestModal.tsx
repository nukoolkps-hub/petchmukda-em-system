import { IconCirclePlus } from "@tabler/icons-react";
import { useState } from "react";
import { BUSINESS_RULES, C, TH_MONTHS } from "../../constants";
import { TH_NUMBER } from "../../utils/format";
import Diamond from "../shared/Diamond";

/* ─── Advance Request Modal ────────────────────────────────────── */
export default function AdvanceRequestModal({
  profile,
  employee,
  employeeId,
  salaryData,
  advanceRequests,
  onSubmit,
  onClose,
}) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const empSalary = employeeId ? salaryData[employeeId]?.[ym] : null;
  const baseSalary = employee?.baseSalary ?? empSalary?.base ?? 0;
  const maxAdvance = Math.floor(
    baseSalary * BUSINESS_RULES.ADVANCE_LIMIT_PERCENT,
  );

  // total already approved this month
  const myReqs = (advanceRequests || []).filter((r) => r.month === ym);
  const alreadyRequested = myReqs
    .filter((r) => r.status !== "rejected")
    .reduce((s, r) => s + r.amount, 0);
  const remaining = Math.max(0, maxAdvance - alreadyRequested);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setErr("กรุณาระบุจำนวนเงิน");
      return;
    }
    if (amt > remaining) {
      setErr(`เกินวงเงินคงเหลือ (สูงสุด ฿${TH_NUMBER(remaining)})`);
      return;
    }
    if (!reason.trim()) {
      setErr("กรุณาระบุเหตุผล");
      return;
    }
    setErr("");
    onSubmit({ amount: amt, reason: reason.trim(), month: ym });
    setAmount("");
    setReason("");
  }

  return (
    <div className="fixed inset-0 z-800 flex items-end justify-center bg-[rgba(45,26,14,0.65)] backdrop-blur-[6px]">
      <div className="bg-white rounded-t-3xl px-5.5 pt-6 pb-7 w-full max-w-[430px] shadow-[0_-12px_40px_rgba(45,26,14,0.25)] animate-[slideUp_0.3s_cubic-bezier(.22,.68,0,1.1)] max-h-[92vh] overflow-y-auto">
        {/* handle */}
        <div className="w-10 h-1 rounded-sm bg-bdr mx-auto mb-4" />

        {/* header */}
        <div className="flex items-center gap-3 mb-4.5">
          <div className="w-[46px] h-[46px] rounded-xl bg-linear-135 from-maroon to-maroon-lt flex items-center justify-center shadow-[0_4px_14px_rgba(123,28,28,0.25)]">
            <IconCirclePlus
              size={22}
              color="var(--color-gold-lt)"
              stroke={2.2}
            />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-lg text-txt">เบิกเงินล่วงหน้า</div>
            <div className="text-xs text-txt-soft mt-0.5">
              {TH_MONTHS[now.getMonth()]} {now.getFullYear() + 543}
            </div>
          </div>
        </div>

        {/* limit info */}
        <div className="bg-gold-pale rounded-xl px-3.5 py-3 mb-3.5 border border-gold/25">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-txt-mid">
              วงเงินสูงสุด (50% ของเงินเดือน)
            </span>
            <span className="text-[13px] font-bold text-maroon">
              ฿{TH_NUMBER(maxAdvance)}
            </span>
          </div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-txt-mid">เบิกไปแล้วเดือนนี้</span>
            <span className="text-[13px] font-bold text-txt-mid">
              ฿{TH_NUMBER(alreadyRequested)}
            </span>
          </div>
          <div className="h-px bg-gold/25 my-1.5" />
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-bold text-txt">คงเหลือเบิกได้</span>
            <span className="text-lg font-extrabold text-green">
              ฿{TH_NUMBER(remaining)}
            </span>
          </div>
        </div>

        {/* amount */}
        <label className="block text-[13px] text-txt-mid font-semibold mb-1.5">
          จำนวนเงินที่ต้องการเบิก
        </label>
        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-maroon font-bold">
            ฿
          </span>
          <input
            type="number"
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
          {[1000, 2000, 5000, Math.floor(remaining / 2), remaining]
            .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
            .slice(0, 4)
            .map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="flex-1 py-1.5 px-1 rounded-[9px] border border-bdr bg-white text-maroon text-xs font-semibold cursor-pointer font-[inherit]"
              >
                ฿{TH_NUMBER(v)}
              </button>
            ))}
        </div>

        {/* reason */}
        <label className="block text-[13px] text-txt-mid font-semibold mb-1.5">
          เหตุผล
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={150}
          placeholder="เช่น ค่ารักษาพยาบาล, เหตุฉุกเฉิน"
          className={`w-full px-3.5 py-3 rounded-xl text-sm resize-none outline-none font-[inherit] box-border text-txt bg-white leading-relaxed border-[1.5px] ${err.includes("เหตุผล") ? "border-red" : "border-bdr"} ${err ? "mb-1.5" : "mb-3.5"}`}
        />

        {err && <div className="text-red text-xs mb-3.5">⚠ {err}</div>}

        {/* LINE notice */}
        <div className="bg-[#06C75510] rounded-[10px] px-3.5 py-2.5 mb-4 border border-[#06C75530] flex gap-2.5 items-center">
          <div className="text-lg">💬</div>
          <div className="text-[11px] text-txt-mid leading-normal">
            คำขอจะถูกส่งไปยัง Admin ผ่าน <b className="text-[#06C755]">LINE</b> ทันที
            <br />
            Admin จะโอนเงินและส่งสลิปกลับมาในแอป
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-[15px] font-semibold cursor-pointer font-[inherit]"
          >
            ยกเลิก
          </button>
          <button
            onClick={submit}
            disabled={remaining <= 0}
            className={`flex-2 p-3.5 rounded-xl border-none text-[15px] font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5
              ${
                remaining <= 0
                  ? "bg-bdr text-txt-soft cursor-not-allowed shadow-none"
                  : "bg-linear-135 from-gold to-gold-lt text-maroon-dk shadow-[0_4px_14px_rgba(201,151,58,0.31)]"
              }`}
          >
            <Diamond
              size={14}
              color={remaining <= 0 ? C.textSoft : C.maroonDk}
            />
            {remaining <= 0 ? "เต็มวงเงินแล้ว" : "ส่งคำขอผ่าน LINE"}
          </button>
        </div>
      </div>
    </div>
  );
}
