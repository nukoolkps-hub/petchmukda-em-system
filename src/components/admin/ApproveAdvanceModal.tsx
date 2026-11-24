import { CircleCheck as IconCircleCheck, X as IconX } from "lucide-react";
import { useState } from "react";
import { formatBankAccount } from "../../utils/bankFormat";
import { formatThaiNumber } from "../../utils/format";
import BaseModal from "../shared/BaseModal";
import SlipPicker from "./SlipPicker";

/**
 * อนุมัติเบิกปกติ — แนบสลิปโอน → ดูรูปตัวอย่าง → กด "ยืนยันอนุมัติ"
 * (เดิมเลือกไฟล์ปุ๊บอนุมัติทันที ไม่มีจังหวะตรวจว่าหยิบสลิปถูกใบ/ถูกคน)
 * โหมด `backfill` = คำขอที่อนุมัติไปแล้วแต่ยังไม่มีสลิป → แนบย้อนหลัง
 */
export default function ApproveAdvanceModal({
  request,
  employeeInfo,
  backfill = false,
  onConfirm,
  onClose,
}: {
  request: any;
  employeeInfo?: any;
  backfill?: boolean;
  onConfirm: (file: File) => Promise<boolean>;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const name =
    employeeInfo?.nickname || employeeInfo?.name || request.employeeName;

  async function confirm() {
    if (!file || saving) return;
    setSaving(true);
    const ok = await onConfirm(file);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <BaseModal
      onClose={saving ? () => {} : onClose}
      maxWidthClass="max-w-[380px]"
      contentClassName="px-5 py-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <IconCircleCheck size={20} strokeWidth={2.2} className="text-green" />
        <div className="font-bold text-base text-txt flex-1">
          {backfill ? "แนบสลิปย้อนหลัง" : "อนุมัติเบิกเงิน"}
        </div>
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

      <div className="mb-3 px-3 py-2.5 bg-cream rounded-[10px] border border-bdr text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-txt-soft">พนักงาน</span>
          <span className="font-semibold text-txt">{name}</span>
        </div>
        <div className="flex justify-between gap-3 mt-1">
          <span className="text-txt-soft">จำนวนเงิน</span>
          <span className="font-extrabold text-maroon">
            {formatThaiNumber(request.amount)} ฿
          </span>
        </div>
        {(employeeInfo?.bank || employeeInfo?.bankAccountNumber) && (
          <div className="text-xs text-txt-mid mt-1.5">
            โอนเข้า {employeeInfo.bank || "-"} ·{" "}
            <b>{formatBankAccount(employeeInfo.bankAccountNumber)}</b>
          </div>
        )}
      </div>

      <SlipPicker file={file} onChange={setFile} disabled={saving} />

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
          onClick={confirm}
          disabled={!file || saving}
          className="flex-[1.4] p-3 rounded-xl border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] disabled:opacity-50 disabled:cursor-default"
        >
          {saving ? "กำลังบันทึก..." : backfill ? "บันทึกสลิป" : "ยืนยันอนุมัติ"}
        </button>
      </div>
    </BaseModal>
  );
}
