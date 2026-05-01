import { IconTrash } from "@tabler/icons-react";
import { LEAVE_TYPES } from "../../constants";
import { fmtDate } from "../../utils/dateUtils";

/* ─── Delete Confirm Modal ─────────────────────────────────────── */
export default function ConfirmModal({ leave, onConfirm, onCancel }) {
  if (!leave) return null;
  const lt = LEAVE_TYPES.find((t) => t.id === leave.type);
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(45,26,14,0.55)] backdrop-blur-[4px] px-6">
      <div className="bg-white rounded-[20px] px-6 py-7 w-full max-w-[360px] shadow-[0_24px_60px_rgba(45,26,14,0.3)] animate-[modalIn_0.2s_cubic-bezier(.22,.68,0,1.2)]">
        <div className="w-14 h-14 rounded-full bg-red-lt flex items-center justify-center mx-auto mb-4">
          <IconTrash size={26} color="var(--color-red)" stroke={2.5} />
        </div>
        <div className="font-bold text-lg text-txt text-center mb-2">
          ลบรายการลานี้?
        </div>
        <div className="text-sm text-txt-mid text-center mb-5 leading-[1.8]">
          <b>{leave.empName}</b>
          <br />
          {lt?.icon} {lt?.label} · {fmtDate(leave.start)}
          {leave.start !== leave.end ? ` – ${fmtDate(leave.end)}` : ""}
          <br />
          <span className="text-[13px] text-txt-soft">
            ({leave.days} วันทำการ)
          </span>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-[15px] font-semibold cursor-pointer font-[inherit]"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 p-3.5 rounded-xl border-none bg-red text-white text-[15px] font-bold cursor-pointer font-[inherit] shadow-[0_4px_12px_rgba(192,57,43,0.31)]"
          >
            ลบรายการ
          </button>
        </div>
      </div>
    </div>
  );
}
