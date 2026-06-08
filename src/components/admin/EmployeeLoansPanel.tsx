/* ─── Admin: Employee Loans Panel (เงินกู้ผ่อนคืน) ──────────────────
   admin สร้างเงินกู้ให้พนักงาน — กำหนดเงินต้น + ผ่อนเดือนละ X → ระบบจะหัก
   จากเงินเดือนอัตโนมัติทุกเดือนจนครบ (Stage B). หน้านี้: list + create/cancel  */
import {
  ChevronDown as IconChevronDown,
  CircleCheck as IconCircleCheck,
  HandCoins as IconHandCoins,
  Plus as IconPlus,
  Trash2 as IconTrash,
  X as IconX,
} from "lucide-react";
import { useMemo, useState } from "react";
import { THAI_MONTH_NAMES } from "../../constants";
import { loanRemaining } from "../../firebase/employeeLoans";
import { formatThaiNumber } from "../../utils/format";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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
  const empName = (id: string) => empOf(id)?.name || "—";

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
                      {empName(loan.employeeId)}
                    </div>
                    {loan.note && (
                      <div className="text-xs text-txt-soft truncate">
                        {loan.note}
                      </div>
                    )}
                  </div>
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
                    ผ่อนแล้ว ฿{formatThaiNumber(paid)} ({pct}%)
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
          onClose={() => setShowCreate(false)}
          onAddLoan={onAddLoan}
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
              {empName(confirmDelete.employeeId)} · เงินต้น ฿
              {formatThaiNumber(confirmDelete.principal)}
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
    <div className="bg-cream rounded-[9px] py-1.5">
      <div className="text-[10px] text-txt-soft">{label}</div>
      <div
        className={`text-sm font-extrabold ${highlight ? "text-maroon" : "text-txt"}`}
      >
        ฿{formatThaiNumber(value)}
      </div>
    </div>
  );
}

function CreateLoanModal({ employeeDirectory, onClose, onAddLoan, showToast }) {
  const [employeeId, setEmployeeId] = useState(employeeDirectory[0]?.id || "");
  const [principal, setPrincipal] = useState("");
  const [monthly, setMonthly] = useState("");
  const [startMonth, setStartMonth] = useState(currentYearMonth);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const principalNum = parseFloat(principal) || 0;
  const monthlyNum = parseFloat(monthly) || 0;
  const estMonths = monthlyNum > 0 ? Math.ceil(principalNum / monthlyNum) : 0;

  async function submit() {
    if (!employeeId) return setErr("กรุณาเลือกพนักงาน");
    if (principalNum <= 0) return setErr("กรุณาระบุเงินต้น");
    if (monthlyNum <= 0) return setErr("กรุณาระบุยอดผ่อนต่อเดือน");
    if (monthlyNum > principalNum) return setErr("ยอดผ่อนต่อเดือนมากกว่าเงินต้น");
    setErr("");
    setSaving(true);
    try {
      await onAddLoan({
        employeeId,
        employeeName:
          employeeDirectory.find((e) => e.id === employeeId)?.name || "",
        principal: principalNum,
        monthlyDeduction: monthlyNum,
        startMonth,
        note: note.trim(),
        status: "active",
      });
      showToast?.("สร้างเงินกู้แล้ว");
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
      <div className="relative mb-3">
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className={`${inputCls} appearance-none pr-10 cursor-pointer font-semibold`}
        >
          {employeeDirectory.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={14}
          strokeWidth={2.4}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div>
          <label className="block text-sm text-txt-mid font-semibold mb-1.5">
            เงินต้น (บาท)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm text-txt-mid font-semibold mb-1.5">
            ผ่อนเดือนละ (บาท)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      <label className="block text-sm text-txt-mid font-semibold mb-1.5">
        เริ่มหักเดือน
      </label>
      <div className="relative mb-3">
        <select
          value={startMonth}
          onChange={(e) => setStartMonth(e.target.value)}
          className={`${inputCls} appearance-none pr-10 cursor-pointer font-semibold`}
        >
          {monthOptions().map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={14}
          strokeWidth={2.4}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
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

      {estMonths > 0 && (
        <div className="bg-gold-pale rounded-[10px] px-3.5 py-2.5 mb-3 border border-gold/25 text-sm text-txt-mid">
          ผ่อนประมาณ <b className="text-maroon">{estMonths} เดือน</b> จนครบ
          {monthlyNum > 0 &&
            principalNum % monthlyNum !== 0 &&
            ` (เดือนสุดท้าย ฿${formatThaiNumber(principalNum % monthlyNum)})`}
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
          className={`flex-2 p-3.5 rounded-xl border-none bg-maroon text-white text-base font-bold font-[inherit] shadow-[0_4px_14px_rgba(123,28,28,0.25)] ${saving ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
        >
          {saving ? "กำลังบันทึก..." : "สร้างเงินกู้"}
        </button>
      </div>
    </BaseModal>
  );
}
