/* ─── เพิ่มเงินกู้เข้าก้อนเดิม (Admin) ───────────────────────────────────
   พนักงาน 1 คน = การ์ดเงินกู้ใบเดียว · กู้เพิ่มต่อท้ายประวัติในก้อนเดิม
   ยอดเพิ่ม + ยอดผ่อนใหม่มีผลตั้งแต่ "เดือนที่เริ่มหัก" ที่เลือก — เดือนก่อนหน้า
   (รวมเดือนที่ยืนยันยอดไปแล้ว) หักเท่าเดิม · logic อยู่ที่ utils/loanTopUp      */
import {
  HandCoins as IconHandCoins,
  Upload as IconUpload,
  X as IconX,
} from "lucide-react";
import { useState } from "react";
import { uploadLoanSlip } from "../../firebase/storage";
import { formatThaiNumber } from "../../utils/format";
import { resizeSlip } from "../../utils/imageUtils";
import { loanPaidTotal, validateTopUp } from "../../utils/loanTopUp";
import BaseModal from "../shared/BaseModal";
import MoneyInput from "../shared/MoneyInput";
import Spinner from "../shared/Spinner";
import ThemedSelect from "../shared/ThemedSelect";
import { monthLabel, monthOptions } from "./loanFormat";

export default function LoanTopUpModal({
  loan,
  employeeName,
  onClose,
  onTopUpLoan,
  showToast,
}) {
  const currentRemaining = Math.max(
    0,
    (Number(loan.principal) || 0) - loanPaidTotal(loan),
  );
  // เดือนเริ่มหักต้องไม่ก่อนครั้งที่กู้เพิ่มล่าสุด (validateTopUp บล็อกอีกชั้น)
  const latestEffective = (loan.topUps || []).reduce(
    (m: string, t: any) => (t.effectiveMonth > m ? t.effectiveMonth : m),
    "",
  );
  const months = monthOptions(latestEffective);

  const [amount, setAmount] = useState("");
  const [monthly, setMonthly] = useState(
    String(Number(loan.monthlyDeduction) || ""),
  );
  const [effectiveMonth, setEffectiveMonth] = useState(months[0] || "");
  const [note, setNote] = useState("");
  const [slipDataUrl, setSlipDataUrl] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const amountNum = parseFloat(amount) || 0;
  const monthlyNum = parseFloat(monthly) || 0;
  const totalAfter = (Number(loan.principal) || 0) + amountNum;
  const remainingAfter = currentRemaining + amountNum;
  const estMonths =
    monthlyNum > 0 && amountNum > 0
      ? Math.ceil(remainingAfter / monthlyNum)
      : 0;

  async function pickSlip(file: File) {
    setResizing(true);
    try {
      setSlipDataUrl(await resizeSlip(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ");
    } finally {
      setResizing(false);
    }
  }

  async function submit() {
    const input = {
      amount: amountNum,
      monthlyDeduction: monthlyNum,
      effectiveMonth,
    };
    const problem = validateTopUp(loan, input);
    if (problem) return setErr(problem);
    setErr("");
    setSaving(true);
    try {
      // อัปโหลดสลิปก่อน (path ผูกกับ loanId ที่มีอยู่แล้ว) · fail → บันทึกต่อ
      // โดยไม่มีสลิป แล้วบอก admin (ยอดเงินสำคัญกว่ารูป)
      let slipImageUrl = "";
      let slipUploadFailed = false;
      if (slipDataUrl) {
        try {
          slipImageUrl = await uploadLoanSlip(loan.id, slipDataUrl);
        } catch (e) {
          console.error("[LoanTopUpModal] upload slip failed:", e);
          slipUploadFailed = true;
        }
      }
      await onTopUpLoan(loan.id, {
        ...input,
        id: `t${Date.now().toString(36)}`,
        note: note.trim().slice(0, 200),
        slipImageUrl,
      });
      showToast?.(
        slipUploadFailed
          ? "เพิ่มเงินกู้แล้ว แต่อัปโหลดสลิปไม่สำเร็จ"
          : "เพิ่มเงินกู้แล้ว · กำลังแจ้ง LINE พนักงาน",
      );
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-base font-[inherit] bg-white outline-none focus:border-maroon text-txt";

  return (
    <BaseModal onClose={onClose} contentClassName="px-5.5 pt-6 pb-7">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[46px] h-[46px] rounded-xl bg-linear-135 from-maroon to-maroon-lt flex items-center justify-center shrink-0">
          <IconHandCoins
            size={22}
            color="var(--color-gold-lt)"
            strokeWidth={2.2}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">เพิ่มเงินกู้</div>
          <div className="text-sm text-txt-soft mt-0.5 truncate">
            {employeeName} · รวมเข้าก้อนเดิม
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center cursor-pointer border-none"
        >
          <IconX size={16} className="text-txt-soft" strokeWidth={2.4} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <Current label="ยอดกู้รวม" value={loan.principal} />
        <Current label="คงเหลือ" value={currentRemaining} />
        <Current label="ผ่อนเดือนละ" value={loan.monthlyDeduction} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div>
          <label className="block text-sm text-txt-mid font-semibold mb-1.5">
            กู้เพิ่ม (บาท)
          </label>
          <MoneyInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm text-txt-mid font-semibold mb-1.5">
            ผ่อนเดือนละ (บาท)
          </label>
          <MoneyInput
            value={monthly}
            onChange={setMonthly}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        ยอดใหม่เริ่มหักเดือน
      </label>
      <div className="mb-1">
        <ThemedSelect
          value={effectiveMonth}
          onChange={setEffectiveMonth}
          options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
          className={`${inputCls} pr-10 cursor-pointer font-semibold flex items-center text-left`}
        />
      </div>
      <div className="text-xs text-txt-soft mb-3 leading-relaxed">
        เดือนก่อนหน้านี้ยังหักตามยอดเดิม
      </div>

      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        หมายเหตุ
      </label>
      <input
        type="text"
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder="เช่น ค่าเทอมลูก, ซ่อมรถ"
        className={`${inputCls} mb-3`}
      />

      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        สลิปโอนเงิน <span className="text-txt-soft font-normal">(ถ้ามี)</span>
      </label>
      {slipDataUrl ? (
        <div className="relative mb-3 rounded-[10px] border border-bdr overflow-hidden bg-cream">
          <img
            src={slipDataUrl}
            alt="สลิปโอนเงิน"
            className="block max-h-[220px] w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setSlipDataUrl(null)}
            aria-label="ลบสลิป"
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white border border-bdr flex items-center justify-center cursor-pointer shadow"
          >
            <IconX size={14} className="text-txt-mid" strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <label className="block px-3.5 py-2.5 mb-3 rounded-[10px] border-[1.5px] border-dashed border-gold/40 bg-gold-pale text-maroon text-sm font-semibold cursor-pointer font-[inherit] text-center">
          {resizing ? (
            "กำลังย่อรูป..."
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <IconUpload size={14} strokeWidth={2.4} />
              เลือกรูปสลิป
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={resizing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickSlip(f);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
      )}

      {amountNum > 0 && (
        <div className="bg-gold-pale rounded-[10px] px-3.5 py-2.5 mb-3 border border-gold/25 text-sm text-txt-mid leading-relaxed">
          หลังกู้เพิ่ม: ยอดกู้รวม{" "}
          <b className="text-maroon whitespace-nowrap">
            {formatThaiNumber(totalAfter)} ฿
          </b>{" "}
          · คงเหลือ{" "}
          <b className="text-maroon whitespace-nowrap">
            {formatThaiNumber(remainingAfter)} ฿
          </b>
          {estMonths > 0 && (
            <>
              {" "}
              · ผ่อนอีกประมาณ <b className="text-maroon">{estMonths} เดือน</b>
            </>
          )}
        </div>
      )}

      {err && <div className="text-red text-sm mb-3 font-semibold">{err}</div>}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform duration-100"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className={`flex-2 p-3.5 rounded-xl border-none text-base font-bold font-[inherit] inline-flex items-center justify-center gap-2 ${
            saving
              ? "bg-bdr text-txt-soft cursor-not-allowed"
              : "bg-maroon text-white shadow-[0_4px_14px_rgba(123,28,28,0.25)] cursor-pointer"
          }`}
        >
          {saving && <Spinner size={18} />}
          {saving ? "กำลังบันทึก..." : "เพิ่มเงินกู้"}
        </button>
      </div>
    </BaseModal>
  );
}

function Current({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-cream rounded-[9px] px-2 py-2">
      <div className="text-[10px] text-txt-soft">{label}</div>
      <div className="text-sm font-extrabold text-txt">
        {formatThaiNumber(Number(value) || 0)} ฿
      </div>
    </div>
  );
}
