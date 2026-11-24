/* ─── เบิกฉุกเฉิน — ADMIN เบิกให้พนักงานเอง ─────────────────────────────
   สำหรับคนที่เบิกปกติครบ 3 ครั้ง/เดือนแล้ว · พนักงานไม่ได้ยื่น ADMIN เป็นคน
   สร้าง (อนุมัติทันที · แนบสลิปได้) · ข้ามทั้งโควต้าจำนวนครั้งและเพดาน %
   ตามอายุงาน — ตัวช่วยตัดสินคือ "เบิกได้อีกกี่บาท" (`emergencyAdvanceRoom`) =
   เงินเดือนพื้นฐานปัจจุบัน (100%) − ยอดเบิกทั้งเดือน · เกินได้แต่เตือน     */

import {
  TriangleAlert as IconAlert,
  Siren as IconSiren,
  Upload as IconUpload,
  X as IconX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getAdvancesByEmployeeAndMonth,
  newAdvanceId,
} from "../../firebase/advances";
import { uploadAdvanceSlip } from "../../firebase/storage";
import {
  advanceLimitPercent,
  advanceQuotaOfMonth,
  emergencyAdvanceRoom,
} from "../../utils/advanceUtils";
import { formatBankAccount } from "../../utils/bankFormat";
import { currentYearMonth } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import { resizeSlip } from "../../utils/imageUtils";
import { getEffectiveBaseSalary } from "../../utils/salaryUtils";
import BaseModal from "../shared/BaseModal";
import MoneyInput from "../shared/MoneyInput";
import ThemedSelect from "../shared/ThemedSelect";

/** guardrail เดียวกับ firestore.rules (กันพิมพ์ศูนย์เกิน) */
const MAX_AMOUNT = 200000;

export interface EmergencyAdvanceInput {
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
  month: string;
  slipImageUrl?: string | null;
}

interface Props {
  employeeDirectory: any[];
  onCreate: (id: string, input: EmergencyAdvanceInput) => Promise<void>;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

export default function EmergencyAdvanceModal({
  employeeDirectory,
  onCreate,
  onClose,
  showToast,
}: Props) {
  const ym = currentYearMonth();
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // คำขอของคนนี้เดือนนี้ — อ่านสดจาก server (ไม่ใช้ state ฝั่ง admin ที่เป็น
  // pending-only) · null = กำลังโหลด
  const [monthAdvances, setMonthAdvances] = useState<any[] | null>(null);
  useEffect(() => {
    if (!employeeId) {
      setMonthAdvances(null);
      return;
    }
    let cancelled = false;
    setMonthAdvances(null);
    getAdvancesByEmployeeAndMonth(employeeId, ym)
      .then((list) => {
        if (!cancelled) setMonthAdvances(list);
      })
      .catch((e) => {
        console.error("[EmergencyAdvance] load advances failed:", e);
        if (!cancelled) setMonthAdvances([]);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, ym]);

  const employees = useMemo(
    () => (employeeDirectory || []).filter((e) => !e.salaryDisabled),
    [employeeDirectory],
  );
  const employee = employees.find((e) => e.id === employeeId) || null;

  const list = monthAdvances || [];
  const quota = advanceQuotaOfMonth(list, ym);
  const baseSalary = employee ? getEffectiveBaseSalary(employee) : 0;
  const ceiling = employee
    ? Math.floor(baseSalary * advanceLimitPercent(employee.startWorkMonth))
    : 0;
  const room = emergencyAdvanceRoom({
    baseSalary,
    advances: list,
    yearMonth: ym,
  });
  const loadingInfo = !!employeeId && monthAdvances === null;

  const amountNum = Number(String(amount).replace(/,/g, "")) || 0;
  const overRoom = room.room !== null && amountNum > room.room;

  function pickSlip(file: File | undefined) {
    if (!file) return;
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  }

  async function submit() {
    if (saving) return;
    if (!employee) return setErr("เลือกพนักงานก่อน");
    if (amountNum <= 0) return setErr("กรอกจำนวนเงิน");
    if (amountNum > MAX_AMOUNT)
      return setErr(`เบิกได้ไม่เกิน ${formatThaiNumber(MAX_AMOUNT)} ฿ ต่อครั้ง`);
    setErr("");
    setSaving(true);
    try {
      const id = newAdvanceId();
      let slipImageUrl: string | null = null;
      if (slipFile) {
        slipImageUrl = await uploadAdvanceSlip(id, await resizeSlip(slipFile));
      }
      await onCreate(id, {
        employeeId: employee.id,
        employeeName: employee.name || employee.nickname || "-",
        amount: amountNum,
        reason: reason.trim(),
        month: ym,
        slipImageUrl,
      });
      showToast?.(
        `เบิกฉุกเฉินให้ ${employee.nickname || employee.name} ${formatThaiNumber(amountNum)} ฿ แล้ว`,
      );
      onClose();
    } catch (e) {
      console.error("[EmergencyAdvance] create failed:", e);
      setErr((e as Error).message || "บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BaseModal
      onClose={saving ? () => {} : onClose}
      maxWidthClass="max-w-[400px]"
      contentClassName="px-5 py-6"
    >
      <div className="flex items-center gap-2 mb-1">
        <IconSiren size={20} strokeWidth={2.2} className="text-red" />
        <div className="font-bold text-base text-txt flex-1">เบิกฉุกเฉิน</div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="p-1 text-txt-soft bg-transparent border-none cursor-pointer"
          aria-label="ปิด"
        >
          <IconX size={18} />
        </button>
      </div>
      <div className="text-xs text-txt-soft mb-4 leading-snug">
        ADMIN เบิกให้เอง · อนุมัติทันที · ไม่นับโควต้า 3 ครั้ง/เดือน · เกินเพดานปกติได้ ·
        หักจากเงินเดือนเดือนนี้
      </div>

      <label className="block text-sm font-semibold text-txt-mid mb-1.5">
        พนักงาน
      </label>
      <ThemedSelect
        value={employeeId}
        onChange={(v) => {
          setEmployeeId(v);
          setErr("");
        }}
        placeholder="— เลือกพนักงาน —"
        options={employees.map((e) => ({
          value: e.id,
          label: e.nickname ? `${e.nickname} (${e.name})` : e.name,
        }))}
        className="w-full flex items-center pl-3 pr-8 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] cursor-pointer text-left mb-3"
      />

      {employee && (
        <div className="mb-3 px-3 py-2.5 bg-cream rounded-[10px] border border-bdr text-sm">
          {loadingInfo ? (
            <div className="text-txt-soft text-xs">กำลังคำนวณ...</div>
          ) : (
            <div className="flex flex-col gap-1">
              <Row
                label="เบิกปกติเดือนนี้"
                value={`${quota.used}/${quota.limit} ครั้ง${quota.reachedLimit ? " (ครบแล้ว)" : ""}`}
              />
              {ceiling > 0 && (
                <Row
                  label="เพดานเบิกปกติ"
                  value={`${formatThaiNumber(ceiling)} ฿`}
                />
              )}
              <div className="border-t border-bdr my-0.5" />
              <Row
                label="ฐานเงินเดือนปัจจุบัน"
                value={
                  room.baseSalary === null
                    ? "ยังไม่ได้ตั้งเงินเดือน"
                    : `${formatThaiNumber(Math.floor(room.baseSalary))} ฿`
                }
              />
              <Row
                label="เบิกไปแล้วเดือนนี้"
                value={`−${formatThaiNumber(room.usedTotal)} ฿`}
              />
              <div className="flex justify-between items-baseline pt-1.5 mt-0.5 border-t border-bdr">
                <span className="font-bold text-txt">เบิกได้อีก</span>
                <span className="font-extrabold text-maroon text-base">
                  {room.room === null
                    ? "—"
                    : `${formatThaiNumber(room.room)} ฿`}
                </span>
              </div>
              <div className="text-xs text-txt-soft leading-snug">
                ฐานเงินเดือน − ยอดเบิกทั้งเดือน (รวมที่รออนุมัติ)
              </div>
              {(employee.bank || employee.bankAccountNumber) && (
                <div className="text-xs text-txt-mid mt-1">
                  โอนเข้า {employee.bank || "-"} ·{" "}
                  <b>{formatBankAccount(employee.bankAccountNumber)}</b>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <label className="block text-sm font-semibold text-txt-mid mb-1.5">
        จำนวนเงิน (บาท)
      </label>
      <MoneyInput
        value={amount}
        onChange={setAmount}
        placeholder="0"
        className="w-full px-3 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-base text-txt font-[inherit] outline-none bg-white focus:border-maroon mb-2"
      />
      {room.room !== null && room.room > 0 && (
        <button
          type="button"
          onClick={() => setAmount(String(room.room))}
          className="mb-2 text-xs font-semibold text-maroon bg-transparent border-none p-0 cursor-pointer font-[inherit] underline"
        >
          ใช้ยอดที่เบิกได้อีก ({formatThaiNumber(room.room)} ฿)
        </button>
      )}
      {overRoom && (
        <div className="flex items-start gap-1.5 mb-2 px-3 py-2 bg-amber-lt rounded-[10px] text-xs text-amber leading-snug">
          <IconAlert size={14} className="shrink-0 mt-px" />
          <span>
            เกินฐานเงินเดือน {formatThaiNumber(amountNum - (room.room ?? 0))} ฿ —
            ถ้าเงินสุทธิเดือนนี้ติดลบ ตอนยืนยันยอดระบบจะยกส่วนที่ติดลบไปหักเดือนถัดไป
          </span>
        </div>
      )}

      <label className="block text-sm font-semibold text-txt-mid mb-1.5 mt-1">
        เหตุผล <span className="font-normal text-txt-soft">(ไม่บังคับ)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="เช่น ค่ารักษาพยาบาล"
        className="w-full mb-3 px-3 py-2 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt font-[inherit] outline-none bg-white focus:border-maroon resize-none"
      />

      <label className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-[10px] border-[1.5px] border-dashed border-bdr text-sm text-txt-mid cursor-pointer">
        {slipPreview ? (
          <img
            src={slipPreview}
            alt="สลิป"
            className="w-10 h-10 object-cover rounded-md"
          />
        ) : (
          <IconUpload size={16} />
        )}
        <span className="flex-1">
          {slipFile ? "เปลี่ยนสลิป" : "แนบสลิปโอน (ไม่บังคับ)"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={saving}
          onChange={(e) => pickSlip(e.target.files?.[0])}
        />
      </label>

      {err && <div className="text-sm text-red mb-3">{err}</div>}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="flex-1 p-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !employee || amountNum <= 0 || loadingInfo}
          className="flex-[1.4] p-3 rounded-xl border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] disabled:opacity-50 disabled:cursor-default"
        >
          {saving ? "กำลังบันทึก..." : "ยืนยันเบิกฉุกเฉิน"}
        </button>
      </div>
    </BaseModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-txt-soft">{label}</span>
      <span className="text-txt font-semibold text-right">{value}</span>
    </div>
  );
}
