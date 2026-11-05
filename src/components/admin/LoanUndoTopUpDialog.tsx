/* ─── ยืนยันลบการกู้เพิ่มครั้งล่าสุด (Admin) ──────────────────────────────
   กฎว่าลบได้ไหม (ครั้งล่าสุดเท่านั้น · ยังไม่เคยหักด้วยยอดใหม่) อยู่ที่
   utils/loanTopUp → `topUpUndoBlocker` · transaction เช็คซ้ำกับ doc ล่าสุด  */
import { formatThaiNumber } from "../../utils/format";
import { latestTopUp, undoLatestTopUp } from "../../utils/loanTopUp";
import BaseModal from "../shared/BaseModal";
import Spinner from "../shared/Spinner";
import { isoDateLabel } from "./loanFormat";

/** ยืนยันลบการกู้เพิ่มครั้งล่าสุด — บอกยอดก่อน → หลังให้เห็นก่อนกด */
export default function LoanUndoTopUpDialog({
  loan,
  employeeName,
  busy,
  onCancel,
  onConfirm,
}) {
  const latest = latestTopUp(loan);
  const after = undoLatestTopUp(loan);
  if (!latest || !after) return null;
  return (
    <BaseModal
      onClose={onCancel}
      maxWidthClass="max-w-[380px]"
      contentClassName="px-6 py-7"
    >
      <div className="text-center">
        <div className="font-bold text-lg text-txt mb-1.5">
          ลบรายการกู้เพิ่มครั้งล่าสุด?
        </div>
        <div className="text-sm text-txt-mid mb-4 leading-relaxed">
          {employeeName} · กู้เพิ่ม{" "}
          <b className="text-maroon">+{formatThaiNumber(latest.amount)} ฿</b> (
          {isoDateLabel(latest.createdAt)})
        </div>
        <div className="bg-cream rounded-[10px] px-3.5 py-2.5 mb-5 text-sm text-txt-mid text-left leading-relaxed">
          <div>
            ยอดกู้รวม {formatThaiNumber(loan.principal)} →{" "}
            <b className="text-txt">{formatThaiNumber(after.principal)} ฿</b>
          </div>
          <div>
            ผ่อนเดือนละ {formatThaiNumber(loan.monthlyDeduction)} →{" "}
            <b className="text-txt">
              {formatThaiNumber(after.monthlyDeduction)} ฿
            </b>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-3 rounded-xl border-none font-bold font-[inherit] inline-flex items-center justify-center gap-2 ${
              busy
                ? "bg-bdr text-txt-soft cursor-not-allowed"
                : "bg-red text-white cursor-pointer active:scale-[0.98] transition-transform"
            }`}
          >
            {busy && <Spinner size={16} />}
            {busy ? "กำลังลบ..." : "ลบ"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
