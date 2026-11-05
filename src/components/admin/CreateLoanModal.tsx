/* ─── สร้างเงินกู้ใหม่ (Admin) ───────────────────────────────────────────
   คนที่ยังผ่อนอยู่สร้างใหม่ไม่ได้ → กู้เพิ่มที่ปุ่ม "เพิ่มเงินกู้" บนการ์ดเดิม
   (LoanTopUpModal) · ผ่อนครบแล้ว → สร้างใหม่ได้ (การ์ดเก่าไปกล่องผ่อนครบ)   */
import {
  HandCoins as IconHandCoins,
  Upload as IconUpload,
  X as IconX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loanRemaining } from "../../firebase/employeeLoans";
import { uploadLoanSlip } from "../../firebase/storage";
import { currentYearMonth } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import { resizeSlip } from "../../utils/imageUtils";
import { isLoanOpen } from "../../utils/loanTopUp";
import BaseModal from "../shared/BaseModal";
import MoneyInput from "../shared/MoneyInput";
import Spinner from "../shared/Spinner";
import ThemedSelect from "../shared/ThemedSelect";
import { monthLabel, monthOptions } from "./loanFormat";

export default function CreateLoanModal({
  employeeDirectory,
  employeeLoans,
  onClose,
  onAddLoan,
  onUpdateLoan,
  showToast,
}) {
  const [employeeId, setEmployeeId] = useState(employeeDirectory[0]?.id || "");
  const [principal, setPrincipal] = useState("");
  const [monthly, setMonthly] = useState("");
  const [startMonth, setStartMonth] = useState(currentYearMonth);
  const [note, setNote] = useState("");
  // slipDataUrl: resized image (preview + upload payload) · null = ยังไม่เลือก
  const [slipDataUrl, setSlipDataUrl] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const principalNum = parseFloat(principal) || 0;
  const monthlyNum = parseFloat(monthly) || 0;
  const estMonths = monthlyNum > 0 ? Math.ceil(principalNum / monthlyNum) : 0;

  // กฎ "ก้อนที่ยังผ่อนอยู่ 1 ก้อน/คน" — ยังผ่อนไม่ครบ → ห้ามสร้างก้อนใหม่ ·
  // กู้เพิ่มผ่านปุ่ม "เพิ่มเงินกู้" บนการ์ดเดิม · ผ่อนครบ/ยกเลิก → สร้างใหม่ได้
  const activeLoanByEmployeeId = useMemo(() => {
    const map = new Map<string, any>();
    for (const l of employeeLoans || []) {
      if (isLoanOpen(l)) map.set(l.employeeId, l);
    }
    return map;
  }, [employeeLoans]);
  const activeLoanForEmployee = activeLoanByEmployeeId.get(employeeId) || null;
  const hasActiveLoan = !!activeLoanForEmployee;
  // ตอนเปิด modal ครั้งแรก · ถ้า default employee (คนที่ 1) มี active loan
  // → auto-switch ไปคนแรกที่ยัง "ว่าง" (กดเลือกได้ทันที · ไม่ต้องไล่หา)
  //
  // ตั้งใจไม่ใส่ employeeId / hasActiveLoan เป็น dep — ถ้าใส่ effect จะ
  // re-run ทุกครั้งที่ admin เลือกคนใน dropdown แล้วเด้งออกจากคนที่มีก้อน
  // ค้างทันที = เปิดดูคนนั้นไม่ได้เลย · ต้องการให้ auto-switch เฉพาะตอน
  // mount + ตอน list เปลี่ยนเท่านั้น
  // biome-ignore lint/correctness/useExhaustiveDependencies: ใส่ employeeId/hasActiveLoan แล้ว dropdown จะเด้งออกจากคนที่มีก้อนค้าง เลือกดูไม่ได้
  useEffect(() => {
    if (!hasActiveLoan) return;
    const freeEmp = employeeDirectory.find(
      (e: any) => !activeLoanByEmployeeId.has(e.id),
    );
    if (freeEmp && freeEmp.id !== employeeId) setEmployeeId(freeEmp.id);
  }, [employeeDirectory, activeLoanByEmployeeId]);

  async function pickSlip(file: File) {
    setResizing(true);
    try {
      const dataUrl = await resizeSlip(file);
      setSlipDataUrl(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ");
    } finally {
      setResizing(false);
    }
  }

  async function submit() {
    if (!employeeId) return setErr("กรุณาเลือกพนักงาน");
    if (hasActiveLoan)
      return setErr('พนักงานคนนี้ยังผ่อนเงินกู้อยู่ · กด "เพิ่มเงินกู้" ที่การ์ดเดิม');
    if (principalNum <= 0) return setErr("กรุณาระบุเงินต้น");
    if (monthlyNum <= 0) return setErr("กรุณาระบุยอดผ่อนต่อเดือน");
    if (monthlyNum > principalNum) return setErr("ยอดผ่อนต่อเดือนมากกว่าเงินต้น");
    setErr("");
    setSaving(true);
    try {
      const emp = employeeDirectory.find((e) => e.id === employeeId);
      const loanId = await onAddLoan({
        employeeId,
        // snapshot ชื่อ ตอนสร้าง · ใช้ fallback ถ้าพนักงานถูกลบทีหลัง
        // นำ nickname ก่อน เพราะเป็นชื่อเล่นที่ใช้ใน UI · ตรงกับ pattern leave/advance
        employeeName: emp?.nickname || emp?.name || "",
        principal: principalNum,
        monthlyDeduction: monthlyNum,
        startMonth,
        note: note.trim(),
        status: "active",
      });
      // อัปโหลดสลิป (ถ้ามี) · ต้องมี loanId แล้วจึงรู้ path เก็บใน Storage
      // ถ้า upload fail → loan ยังถูกสร้าง · แจ้ง toast แต่ไม่ rollback
      let slipImageUrl: string | null = null;
      let slipUploadFailed = false;
      let notifyFlagFailed = false;
      if (slipDataUrl && loanId) {
        try {
          slipImageUrl = await uploadLoanSlip(loanId, slipDataUrl);
        } catch (e) {
          console.error("[CreateLoanModal] upload slip failed:", e);
          slipUploadFailed = true;
        }
      }
      // อัปเดต doc ครั้งเดียวพร้อม slipImageUrl (ถ้าอัปโหลดสำเร็จ) + ตั้งค่า
      // notification fields → worker `processLoanNotifications` จะหยิบไป
      // push LINE ให้พนักงานคนนั้น (พร้อมรูปสลิปถ้ามี · ดู functions/src/loan/)
      if (loanId) {
        const updateFields: Record<string, unknown> = {
          lineNotificationStatus: "pending",
          lineNotificationType: "created",
          lineNotificationRequestedAt: new Date().toISOString(),
          lineNotificationLastError: null,
          lineNotificationSkippedReason: null,
        };
        if (slipImageUrl) updateFields.slipImageUrl = slipImageUrl;
        try {
          await onUpdateLoan(loanId, updateFields);
        } catch (e) {
          console.error(
            "[CreateLoanModal] update notification flag failed:",
            e,
          );
          notifyFlagFailed = true;
        }
      }
      if (notifyFlagFailed) {
        // เงินกู้ถูกสร้างแล้ว แต่ตั้งสถานะแจ้ง LINE ไม่สำเร็จ → worker จะไม่ push
        // ให้พนักงาน · เตือน admin ให้รู้ (เดิมเงียบ ขึ้น "สร้างแล้ว" เฉยๆ)
        showToast?.("สร้างเงินกู้แล้ว แต่ตั้งค่าแจ้ง LINE ไม่สำเร็จ — กรุณาแจ้งพนักงานเอง");
      } else if (slipUploadFailed) {
        showToast?.("สร้างเงินกู้แล้ว แต่อัปโหลดสลิปไม่สำเร็จ — แก้ไขภายหลังได้");
      } else {
        showToast?.("สร้างเงินกู้แล้ว · กำลังแจ้ง LINE พนักงาน");
      }
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
        <div className="flex-1">
          <div className="font-extrabold text-lg text-txt">สร้างเงินกู้</div>
          <div className="text-sm text-txt-soft mt-0.5">
            หักจากเงินเดือนอัตโนมัติทุกเดือน
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center cursor-pointer border-none"
        >
          <IconX size={16} className="text-txt-soft" strokeWidth={2.4} />
        </button>
      </div>

      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        พนักงาน
      </label>
      <div className="mb-3">
        <ThemedSelect
          value={employeeId}
          onChange={setEmployeeId}
          options={employeeDirectory.map((e) => {
            const blocked = activeLoanByEmployeeId.has(e.id);
            return {
              value: e.id,
              label: `${e.name}${blocked ? "  — กำลังผ่อนอยู่" : ""}`,
              disabled: blocked,
            };
          })}
          className={`${inputCls} pr-10 cursor-pointer font-semibold flex items-center text-left`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div>
          <label className="block text-sm text-txt-mid font-semibold mb-1.5">
            เงินต้น (บาท)
          </label>
          <MoneyInput
            value={principal}
            onChange={setPrincipal}
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
        เริ่มหักเดือน
      </label>
      <div className="mb-3">
        <ThemedSelect
          value={startMonth}
          onChange={setStartMonth}
          options={monthOptions().map((m) => ({
            value: m,
            label: monthLabel(m),
          }))}
          className={`${inputCls} pr-10 cursor-pointer font-semibold flex items-center text-left`}
        />
      </div>

      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        หมายเหตุ
      </label>
      <input
        type="text"
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder="เช่น เงินกู้ฉุกเฉิน, ยืมค่ารักษา"
        className={`${inputCls} mb-3`}
      />

      {/* สลิปโอนเงิน — optional · พนักงานเปิดดูได้จาก card เงินกู้ */}
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

      {hasActiveLoan && (
        <div className="bg-red-lt rounded-[10px] px-3.5 py-2.5 mb-3 border border-[#C0392B40] text-sm text-red font-semibold leading-relaxed">
          พนักงานคนนี้ยังผ่อนเงินกู้อยู่ — ยอดกู้รวม ฿
          {formatThaiNumber(activeLoanForEmployee.principal)} · คงเหลือ ฿
          {formatThaiNumber(loanRemaining(activeLoanForEmployee))}
          <div className="text-xs font-normal text-txt-mid mt-1">
            กู้เพิ่มได้ที่ปุ่ม "เพิ่มเงินกู้" บนการ์ดเดิม · ประวัติจะรวมอยู่ใบเดียว
            (ผ่อนครบแล้วค่อยสร้างเงินกู้ใหม่ได้)
          </div>
        </div>
      )}

      {estMonths > 0 && !hasActiveLoan && (
        <div className="bg-gold-pale rounded-[10px] px-3.5 py-2.5 mb-3 border border-gold/25 text-sm text-txt-mid">
          ผ่อนประมาณ <b className="text-maroon">{estMonths} เดือน</b> จนครบ
          {monthlyNum > 0 &&
            principalNum % monthlyNum !== 0 &&
            ` (เดือนสุดท้าย ${formatThaiNumber(principalNum % monthlyNum)} ฿)`}
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
          disabled={saving || hasActiveLoan}
          className={`flex-2 p-3.5 rounded-xl border-none text-base font-bold font-[inherit] inline-flex items-center justify-center gap-2 ${
            saving || hasActiveLoan
              ? "bg-bdr text-txt-soft cursor-not-allowed"
              : "bg-maroon text-white shadow-[0_4px_14px_rgba(123,28,28,0.25)] cursor-pointer"
          }`}
        >
          {saving && <Spinner size={18} />}
          {saving ? "กำลังบันทึก..." : hasActiveLoan ? "ยังผ่อนอยู่" : "สร้างเงินกู้"}
        </button>
      </div>
    </BaseModal>
  );
}
