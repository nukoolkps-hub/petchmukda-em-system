/* ─── Admin: Employee Loans Panel (เงินกู้ผ่อนคืน) ──────────────────
   admin สร้างเงินกู้ให้พนักงาน — กำหนดเงินต้น + ผ่อนเดือนละ X → ระบบจะหัก
   จากเงินเดือนอัตโนมัติทุกเดือนจนครบ (Stage B). หน้านี้: list + create/cancel  */
import {
  CircleCheck as IconCircleCheck,
  HandCoins as IconHandCoins,
  Plus as IconPlus,
  Receipt as IconReceipt,
  Trash2 as IconTrash,
  Upload as IconUpload,
  X as IconX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";
import { loanRemaining } from "../../firebase/employeeLoans";
import { uploadLoanSlip } from "../../firebase/storage";
import { currentYearMonth } from "../../utils/dateUtils";
import { formatThaiNumber } from "../../utils/format";
import { resizeSlip } from "../../utils/imageUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";
import MoneyInput from "../shared/MoneyInput";
import ThemedSelect from "../shared/ThemedSelect";

function monthLabel(ym: string) {
  const [y, mo] = String(ym || "").split("-");
  const name = THAI_MONTH_NAMES[parseInt(mo, 10) - 1];
  return name ? `${name} ${parseInt(y, 10) + 543}` : ym;
}

function monthOptions(): string[] {
  const now = new Date();
  const out: string[] = [];
  // เดือนปัจจุบัน + ล่วงหน้า 3 เดือน (ไม่ย้อนหลัง — กันสร้างเงินกู้ใส่เดือนเก่า
  // ที่อาจปิดรอบไปแล้ว)
  for (let i = 0; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function EmployeeLoansPanel({
  employeeLoans,
  employeeDirectory,
  onAddLoan,
  onUpdateLoan,
  onDeleteLoan,
  showToast,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  // url สลิปโอนเงินกู้ที่กำลังเปิดดู · null = ไม่เปิด
  const [viewingSlipUrl, setViewingSlipUrl] = useState<string | null>(null);

  const loans = useMemo(
    () =>
      [...(employeeLoans || [])].sort((a, b) => {
        // active ก่อน · แล้วเรียงใหม่→เก่า
        const rank = (s: string) => (s === "active" ? 0 : 1);
        if (rank(a.status) !== rank(b.status))
          return rank(a.status) - rank(b.status);
        return String(b.createdAt).localeCompare(String(a.createdAt));
      }),
    [employeeLoans],
  );

  const empOf = (id: string) => employeeDirectory.find((e) => e.id === id);
  /** live > snapshot fallback > "—" · กัน loan ของพนักงานที่ถูกลบหายชื่อหมด
   *  fallback = ชื่อ snapshot ตอนสร้าง loan (เช่น loan.employeeName)            */
  const empName = (id: string, fallback?: string) =>
    empOf(id)?.nickname || empOf(id)?.name || fallback || "—";

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

      {loans.length === 0 ? (
        <div className="text-center text-txt-soft py-12 px-6 bg-white rounded-[14px] border border-dashed border-bdr">
          <div className="flex justify-center mb-3 text-gold">
            <IconHandCoins size={44} strokeWidth={1.8} />
          </div>
          ยังไม่มีเงินกู้
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {loans.map((loan) => {
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
                      <div className="text-xs text-txt-soft truncate">
                        {loan.note}
                      </div>
                    )}
                  </div>
                  {loan.slipImageUrl && (
                    <button
                      type="button"
                      aria-label="ดูสลิปโอนเงิน"
                      title="สลิปโอนเงิน"
                      onClick={() =>
                        setViewingSlipUrl(loan.slipImageUrl ?? null)
                      }
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
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-lt text-green inline-flex items-center gap-1 shrink-0">
                      <IconCircleCheck size={12} strokeWidth={2.5} />
                      ผ่อนครบแล้ว
                    </span>
                  ) : cancelled ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-bdr text-txt-soft shrink-0">
                      ยกเลิก
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label="ลบ"
                      onClick={() => setConfirmDelete(loan)}
                      className="w-8 h-8 shrink-0 rounded-[9px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30]"
                    >
                      <IconTrash
                        size={14}
                        className="text-red"
                        strokeWidth={2.2}
                      />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-2">
                  <Stat label="เงินต้น" value={loan.principal} />
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
              </div>
            );
          })}
        </div>
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

function CreateLoanModal({
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

  // กฎ "1 ก้อน/คน" — ถ้าพนักงานคนนี้ยังมี active loan (ยังผ่อนไม่ครบ) →
  // ห้ามสร้างก้อนใหม่ · ต้องรอผ่อนครบหรือ admin ยกเลิกก้อนเดิมก่อน
  // (cancelled / paid_off ไม่นับ · สร้างใหม่ได้)
  const activeLoanByEmployeeId = useMemo(() => {
    const map = new Map<string, any>();
    for (const l of employeeLoans || []) {
      if (l.status === "active") map.set(l.employeeId, l);
    }
    return map;
  }, [employeeLoans]);
  const activeLoanForEmployee = activeLoanByEmployeeId.get(employeeId) || null;
  const hasActiveLoan = !!activeLoanForEmployee;
  // ตอนเปิด modal ครั้งแรก · ถ้า default employee (คนที่ 1) มี active loan
  // → auto-switch ไปคนแรกที่ยัง "ว่าง" (กดเลือกได้ทันที · ไม่ต้องไล่หา)
  useEffect(() => {
    if (!hasActiveLoan) return;
    const freeEmp = employeeDirectory.find(
      (e: any) => !activeLoanByEmployeeId.has(e.id),
    );
    if (freeEmp && freeEmp.id !== employeeId) setEmployeeId(freeEmp.id);
    // run เฉพาะตอน mount + dropdown list เปลี่ยน · กัน loop (ใส่ dep ตามจริง)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return setErr("พนักงานคนนี้มีเงินกู้ค้างผ่อนอยู่ · ต้องผ่อนครบก่อนค่อยกู้ใหม่");
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
              label: `${e.name}${blocked ? "  — มีเงินกู้ค้าง" : ""}`,
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
          พนักงานคนนี้มีเงินกู้ค้างผ่อนอยู่ — เงินต้น ฿
          {formatThaiNumber(activeLoanForEmployee.principal)} · คงเหลือ ฿
          {formatThaiNumber(loanRemaining(activeLoanForEmployee))}
          <div className="text-xs font-normal text-txt-mid mt-1">
            กฎ: กู้ได้ครั้งละ 1 ก้อน · ต้องผ่อนครบก่อนค่อยกู้ใหม่
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
          className={`flex-2 p-3.5 rounded-xl border-none text-base font-bold font-[inherit] ${
            saving || hasActiveLoan
              ? "bg-bdr text-txt-soft cursor-not-allowed"
              : "bg-maroon text-white shadow-[0_4px_14px_rgba(123,28,28,0.25)] cursor-pointer"
          }`}
        >
          {saving ? "กำลังบันทึก..." : hasActiveLoan ? "มีเงินกู้ค้างอยู่" : "สร้างเงินกู้"}
        </button>
      </div>
    </BaseModal>
  );
}
