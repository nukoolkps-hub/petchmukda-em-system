/* ─── Admin: Employee Loans Panel (เงินกู้ผ่อนคืน) ──────────────────
   admin สร้างเงินกู้ให้พนักงาน — กำหนดเงินต้น + ผ่อนเดือนละ X → ระบบจะหัก
   จากเงินเดือนอัตโนมัติทุกเดือนจนครบ (Stage B). หน้านี้: list + create/cancel
   พนักงาน 1 คน = การ์ดเดียว · กู้เพิ่มใช้ปุ่ม "เพิ่มเงินกู้" บนการ์ด (ต่อท้าย
   ประวัติในก้อนเดิม · LoanTopUpModal) ไม่สร้างก้อนใหม่                         */
import {
  ChevronDown as IconChevronDown,
  CircleCheck as IconCircleCheck,
  HandCoins as IconHandCoins,
  Plus as IconPlus,
  Receipt as IconReceipt,
  Trash2 as IconTrash,
} from "lucide-react";
import { useMemo, useState } from "react";
import { loanRemaining } from "../../firebase/employeeLoans";
import { formatThaiNumber } from "../../utils/format";
import { isLoanOpen, latestTopUp } from "../../utils/loanTopUp";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";
import { SkeletonRow } from "../shared/Skeleton";
import CreateLoanModal from "./CreateLoanModal";
import LoanHistoryList from "./LoanHistoryList";
import LoanTopUpModal from "./LoanTopUpModal";
import LoanUndoTopUpDialog from "./LoanUndoTopUpDialog";
import { monthLabel } from "./loanFormat";

export default function EmployeeLoansPanel({
  employeeLoans,
  loansLoading,
  employeeDirectory,
  onAddLoan,
  onUpdateLoan,
  onTopUpLoan,
  onUndoTopUp,
  onDeleteLoan,
  showToast,
}) {
  const [showCreate, setShowCreate] = useState(false);
  // เงินกู้ที่กำลังกู้เพิ่ม · null = ไม่เปิด
  const [topUpLoan, setTopUpLoan] = useState<any>(null);
  // เงินกู้ที่กำลังยืนยันลบการกู้เพิ่มครั้งล่าสุด · null = ไม่เปิด
  const [confirmUndo, setConfirmUndo] = useState<any>(null);
  const [undoing, setUndoing] = useState(false);
  // การ์ดที่กางประวัติอยู่ (หลายใบพร้อมกันได้)
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());
  const toggleHistory = (id: string) =>
    setOpenHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  // url สลิปโอนเงินกู้ที่กำลังเปิดดู · null = ไม่เปิด
  const [viewingSlipUrl, setViewingSlipUrl] = useState<string | null>(null);

  // กำลังผ่อน = หน้าหลัก · ผ่อนครบ/ยกเลิก = กล่องพับไว้ล่างสุด (ประวัติยังอยู่ ·
  // ไม่ลบ doc เพราะเป็นหลักฐานยอดที่หักเงินเดือน) · กู้ใหม่ = สร้างเงินกู้ใหม่
  const { loans, openLoans, closedLoans } = useMemo(() => {
    const all = [...(employeeLoans || [])].sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    );
    return {
      loans: all,
      openLoans: all.filter(isLoanOpen),
      closedLoans: all.filter((l) => !isLoanOpen(l)),
    };
  }, [employeeLoans]);
  const [showClosed, setShowClosed] = useState(false);

  const empOf = (id: string) => employeeDirectory.find((e) => e.id === id);
  /** live > snapshot fallback > "—" · กัน loan ของพนักงานที่ถูกลบหายชื่อหมด
   *  fallback = ชื่อ snapshot ตอนสร้าง loan (เช่น loan.employeeName)            */
  const empName = (id: string, fallback?: string) =>
    empOf(id)?.nickname || empOf(id)?.name || fallback || "—";

  const renderCard = (loan: any) => {
    const remaining = loanRemaining(loan);
    const paid = (loan.principal || 0) - remaining;
    const pct =
      loan.principal > 0
        ? Math.min(100, Math.round((paid / loan.principal) * 100))
        : 0;
    const done = loan.status === "paid_off" || remaining <= 0;
    const cancelled = loan.status === "cancelled";
    return (
      <div
        key={loan.id}
        className={`bg-white rounded-[14px] p-3.5 border ${cancelled ? "border-bdr opacity-60" : "border-bdr"} shadow-[0_2px_10px_rgba(90,30,10,0.05)]`}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <AvatarCircle
            avatar={empOf(loan.employeeId)?.avatar}
            avatarType={empOf(loan.employeeId)?.avatarType}
            avatarImageUrl={empOf(loan.employeeId)?.avatarImageUrl}
            size={38}
            fontSize={13}
            border="none"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-txt text-sm truncate">
              {empName(loan.employeeId, loan.employeeName)}
            </div>
            {loan.note && (
              <div className="text-xs text-txt-soft truncate">{loan.note}</div>
            )}
          </div>
          {loan.slipImageUrl && (
            <button
              type="button"
              aria-label="ดูสลิปโอนเงิน"
              title="สลิปโอนเงิน"
              onClick={() => setViewingSlipUrl(loan.slipImageUrl ?? null)}
              className="w-8 h-8 shrink-0 rounded-[9px] bg-maroon/10 flex items-center justify-center cursor-pointer border-[1.5px] border-maroon/20"
            >
              <IconReceipt
                size={14}
                className="text-maroon"
                strokeWidth={2.2}
              />
            </button>
          )}
          {done ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-lt text-green inline-flex items-center gap-1 shrink-0">
              <IconCircleCheck size={12} strokeWidth={2.5} />
              ผ่อนครบแล้ว
            </span>
          ) : cancelled ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-bdr text-txt-soft shrink-0">
              ยกเลิก
            </span>
          ) : (
            <button
              type="button"
              aria-label="ลบ"
              onClick={() => setConfirmDelete(loan)}
              className="w-8 h-8 shrink-0 rounded-[9px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30]"
            >
              <IconTrash size={14} className="text-red" strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <Stat
            label={loan.topUps?.length ? "ยอดกู้รวม" : "เงินต้น"}
            value={loan.principal}
          />
          <Stat label="ผ่อนเดือนละ" value={loan.monthlyDeduction} />
          <Stat label="คงเหลือ" value={remaining} highlight />
        </div>

        {/* progress bar */}
        <div className="h-1.5 rounded-full bg-cream-dk overflow-hidden mb-1">
          <div
            className="h-full bg-maroon rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] text-txt-soft flex justify-between">
          <span>เริ่มหัก {monthLabel(loan.startMonth)}</span>
          <span>
            ผ่อนแล้ว {formatThaiNumber(paid)} ฿ ({pct}%)
          </span>
        </div>

        <div className="mt-2 pt-2 border-t border-bdr/60">
          <LoanHistoryList
            loan={loan}
            open={openHistory.has(loan.id)}
            onToggle={() => toggleHistory(loan.id)}
            onViewSlip={setViewingSlipUrl}
            onUndoTopUp={onUndoTopUp ? () => setConfirmUndo(loan) : undefined}
            action={
              isLoanOpen(loan) && (
                <button
                  type="button"
                  onClick={() => setTopUpLoan(loan)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[9px] border-[1.5px] border-maroon/25 bg-maroon/5 text-maroon text-xs font-bold cursor-pointer font-[inherit] shrink-0"
                >
                  <IconPlus size={13} strokeWidth={2.6} />
                  เพิ่มเงินกู้
                </button>
              )
            }
          />
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="text-sm text-txt-soft">
          เงินกู้ผ่อนคืน — หักจากเงินเดือนอัตโนมัติทุกเดือน
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] shrink-0 shadow-[0_3px_10px_rgba(123,28,28,0.25)]"
        >
          <IconPlus size={15} strokeWidth={2.4} />
          สร้างเงินกู้
        </button>
      </div>

      {loansLoading && loans.length === 0 ? (
        <div className="flex flex-col gap-2.5 animate-[fadeIn_0.18s_ease-out]">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : loans.length === 0 ? (
        <div className="text-center text-txt-soft py-12 px-6 bg-white rounded-[14px] border border-dashed border-bdr">
          <div className="flex justify-center mb-3 text-gold">
            <IconHandCoins size={44} strokeWidth={1.8} />
          </div>
          ยังไม่มีเงินกู้
        </div>
      ) : (
        <>
          {openLoans.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {openLoans.map(renderCard)}
            </div>
          ) : (
            <div className="text-center text-txt-soft text-sm py-6 px-6 bg-white rounded-[14px] border border-dashed border-bdr">
              ไม่มีเงินกู้ที่กำลังผ่อน
            </div>
          )}

          {closedLoans.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                aria-expanded={showClosed}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-[12px] border border-bdr bg-cream text-sm font-bold text-txt-mid cursor-pointer font-[inherit]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <IconCircleCheck
                    size={15}
                    strokeWidth={2.4}
                    className="text-green"
                  />
                  ผ่อนครบแล้ว ({closedLoans.length})
                </span>
                <IconChevronDown
                  size={16}
                  strokeWidth={2.4}
                  className={`transition-transform ${showClosed ? "rotate-180" : ""}`}
                />
              </button>
              {showClosed && (
                <div className="flex flex-col gap-2.5 mt-2.5">
                  {closedLoans.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateLoanModal
          employeeDirectory={employeeDirectory}
          employeeLoans={employeeLoans}
          onClose={() => setShowCreate(false)}
          onAddLoan={onAddLoan}
          onUpdateLoan={onUpdateLoan}
          showToast={showToast}
        />
      )}

      {topUpLoan && (
        <LoanTopUpModal
          loan={topUpLoan}
          employeeName={empName(topUpLoan.employeeId, topUpLoan.employeeName)}
          onClose={() => setTopUpLoan(null)}
          onTopUpLoan={onTopUpLoan}
          showToast={showToast}
        />
      )}

      {confirmUndo && (
        <LoanUndoTopUpDialog
          loan={confirmUndo}
          employeeName={empName(
            confirmUndo.employeeId,
            confirmUndo.employeeName,
          )}
          busy={undoing}
          onCancel={() => setConfirmUndo(null)}
          onConfirm={async () => {
            const target = confirmUndo;
            const latest = latestTopUp(target);
            if (!latest) return setConfirmUndo(null);
            setUndoing(true);
            try {
              const result = await onUndoTopUp(target.id, latest.id);
              showToast?.(
                result?.notified
                  ? "ลบรายการกู้เพิ่มแล้ว · พนักงานได้แจ้ง LINE ไปแล้ว กรุณาแจ้งเขาเอง"
                  : "ลบรายการกู้เพิ่มแล้ว",
              );
              setConfirmUndo(null);
            } catch (err) {
              showToast?.(
                err instanceof Error
                  ? `ลบไม่สำเร็จ: ${err.message}`
                  : "ลบไม่สำเร็จ — ลองอีกครั้ง",
              );
            } finally {
              setUndoing(false);
            }
          }}
        />
      )}

      {confirmDelete && (
        <BaseModal
          onClose={() => setConfirmDelete(null)}
          maxWidthClass="max-w-[360px]"
          contentClassName="px-6 py-7"
        >
          <div className="text-center">
            <div className="font-bold text-lg text-txt mb-1.5">ลบเงินกู้นี้?</div>
            <div className="text-sm text-txt-mid mb-5 leading-relaxed">
              {empName(confirmDelete.employeeId, confirmDelete.employeeName)} ·
              เงินต้น ฿{formatThaiNumber(confirmDelete.principal)}
              <br />
              การหักที่บันทึกไปแล้วในเดือนที่ปิดรอบจะไม่เปลี่ยน
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  // ปิด modal ทันที + ลบ async ใน background
                  // ถ้า fail จะเปิด modal ใหม่พร้อม toast บอก
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  onDeleteLoan(target.id)
                    .then(() => showToast?.("ลบเงินกู้แล้ว"))
                    .catch((err: unknown) => {
                      showToast?.(
                        err instanceof Error
                          ? `ลบไม่สำเร็จ: ${err.message}`
                          : "ลบไม่สำเร็จ — ลองอีกครั้ง",
                      );
                      // Rollback: re-open modal เพื่อ retry
                      setConfirmDelete(target);
                    });
                }}
                className="flex-1 py-3 rounded-xl border-none bg-red text-white font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform"
              >
                ลบ
              </button>
            </div>
          </div>
        </BaseModal>
      )}

      {viewingSlipUrl && (
        <BaseModal
          onClose={() => setViewingSlipUrl(null)}
          maxWidthClass="max-w-[500px]"
          contentClassName="px-4 pt-4 pb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <IconReceipt size={18} strokeWidth={2.2} className="text-maroon" />
            <div className="font-bold text-base text-txt">สลิปโอนเงิน</div>
          </div>
          <img
            src={viewingSlipUrl}
            alt="สลิปโอนเงิน"
            className="block w-full rounded-[10px] border border-bdr"
          />
        </BaseModal>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-cream rounded-[9px] px-2 py-2">
      <div className="text-[10px] text-txt-soft">{label}</div>
      <div
        className={`text-sm font-extrabold ${highlight ? "text-maroon" : "text-txt"}`}
      >
        {formatThaiNumber(value)} ฿
      </div>
    </div>
  );
}
