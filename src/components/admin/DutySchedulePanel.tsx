/* ─── Admin: Duty Schedule (ตารางหน้าที่) ──────────────────────────
   admin สร้าง/แก้/ลบ duty + เลือก pool พนักงาน + เรียงลำดับ rotation     */

import {
  CalendarClock as IconCalendarClock,
  CalendarDays as IconCalendarDays,
  Plus as IconPlus,
  RotateCw as IconRotate,
  Trash2 as IconTrash,
  Users as IconUsers,
  X as IconX,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Duty, Employee, LeaveEntry } from "../../types";
import { toYMD } from "../../utils/dateUtils";
import { computeAllDutiesForDay, getPeriodIndex } from "../../utils/dutyUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";

interface Props {
  duties: Duty[];
  employeeDirectory: Employee[];
  allLeaves: LeaveEntry[];
  onUpsertDuty: (
    id: string | null,
    data: Omit<Duty, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  onDeleteDuty: (id: string) => Promise<void>;
  showToast?: (msg: string) => void;
}

export default function DutySchedulePanel({
  duties,
  employeeDirectory,
  allLeaves,
  onUpsertDuty,
  onDeleteDuty,
  showToast,
}: Props) {
  const [editing, setEditing] = useState<Duty | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Duty | null>(null);

  const todayYmd = toYMD(new Date());
  const assignments = useMemo(
    () =>
      computeAllDutiesForDay(duties, todayYmd, employeeDirectory, allLeaves),
    [duties, todayYmd, employeeDirectory, allLeaves],
  );
  const empById = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employeeDirectory) m.set(e.id, e);
    return m;
  }, [employeeDirectory]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="text-sm text-txt-soft">
          ตารางหน้าที่รับผิดชอบ — ระบบหมุนคนอัตโนมัติ + หาคนแทนถ้าลา
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border-none bg-maroon text-white text-sm font-bold cursor-pointer font-[inherit] shrink-0 shadow-[0_3px_10px_rgba(123,28,28,0.25)] active:scale-[0.98] transition-transform duration-100"
        >
          <IconPlus size={15} strokeWidth={2.4} />
          เพิ่มหน้าที่
        </button>
      </div>

      {duties.length === 0 ? (
        <div className="text-center text-txt-soft py-12 px-6 bg-white rounded-[14px] border border-dashed border-bdr">
          <div className="flex justify-center mb-3 text-gold">
            <IconCalendarClock size={44} strokeWidth={1.8} />
          </div>
          ยังไม่มีหน้าที่ — เริ่มกดเพิ่ม
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {duties.map((duty) => {
            const assignment = assignments.find((a) => a.dutyId === duty.id);
            return (
              <DutyCard
                key={duty.id}
                duty={duty}
                assignment={assignment}
                empById={empById}
                onEdit={() => setEditing(duty)}
                onDelete={() => setConfirmDelete(duty)}
              />
            );
          })}
        </div>
      )}

      {editing && (
        <DutyEditModal
          duty={editing === "new" ? null : editing}
          employeeDirectory={employeeDirectory}
          onSave={async (data) => {
            await onUpsertDuty(editing === "new" ? null : editing.id, data);
            showToast?.(editing === "new" ? "เพิ่มหน้าที่แล้ว" : "บันทึกแล้ว");
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <BaseModal
          onClose={() => setConfirmDelete(null)}
          maxWidthClass="max-w-[360px]"
          contentClassName="px-6 py-7"
        >
          <div className="text-center">
            <div className="font-bold text-lg text-txt mb-1.5">ลบหน้าที่นี้?</div>
            <div className="text-sm text-txt-mid mb-5">
              "{confirmDelete.name}"
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
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  onDeleteDuty(target.id)
                    .then(() => showToast?.("ลบหน้าที่แล้ว"))
                    .catch((err: unknown) => {
                      showToast?.(
                        err instanceof Error
                          ? `ลบไม่สำเร็จ: ${err.message}`
                          : "ลบไม่สำเร็จ",
                      );
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

/* ─── card 1 หน้าที่ — แสดง period + วันนี้ใครทำ + pool list ────── */
function DutyCard({
  duty,
  assignment,
  empById,
  onEdit,
  onDelete,
}: {
  duty: Duty;
  assignment: ReturnType<typeof computeAllDutiesForDay>[number] | undefined;
  empById: Map<string, Employee>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const primary = assignment?.primaryEmpId
    ? empById.get(assignment.primaryEmpId)
    : null;
  const actual = assignment?.actualEmpId
    ? empById.get(assignment.actualEmpId)
    : null;
  const isSubstitute =
    assignment?.reason === "substitute_for_leave" ||
    assignment?.reason === "double_up";

  return (
    <div className="bg-white rounded-[14px] p-3.5 border border-bdr shadow-[0_2px_10px_rgba(90,30,10,0.05)]">
      <div className="flex items-center gap-2 mb-2.5">
        <IconCalendarClock
          size={18}
          strokeWidth={2.4}
          className="text-maroon shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-txt text-sm truncate">{duty.name}</div>
          <div className="text-xs text-txt-soft inline-flex items-center gap-1 mt-0.5">
            <IconRotate size={11} strokeWidth={2.4} />
            สลับทุก{duty.period === "weekly" ? "สัปดาห์" : "เดือน"}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 px-2.5 py-1.5 rounded-[8px] border border-bdr bg-cream text-txt-mid text-xs font-semibold cursor-pointer font-[inherit] active:scale-[0.96] transition-transform"
        >
          แก้ไข
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="ลบหน้าที่"
          className="shrink-0 w-8 h-8 rounded-[8px] bg-red-lt flex items-center justify-center cursor-pointer border-[1.5px] border-[#C0392B30] active:scale-[0.92] transition-transform"
        >
          <IconTrash size={13} className="text-red" strokeWidth={2.2} />
        </button>
      </div>

      {/* วันนี้ใครทำ */}
      <div className="rounded-[10px] bg-gold-pale/40 border border-gold/30 p-2.5 mb-2.5">
        <div className="text-xs text-txt-soft mb-1.5 inline-flex items-center gap-1">
          <IconCalendarDays size={11} strokeWidth={2.4} />
          วันนี้
        </div>
        {actual ? (
          <div className="flex items-center gap-2">
            <AvatarCircle
              avatar={actual.avatar}
              avatarType={actual.avatarType}
              avatarImageUrl={actual.avatarImageUrl}
              size={32}
              fontSize={12}
              border="none"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-maroon truncate">
                {actual.nickname || actual.name}
              </div>
              {isSubstitute && primary && (
                <div className="text-[11px] text-txt-soft">
                  แทน {primary.nickname || primary.name} (ลา)
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-txt-soft italic">
            {assignment?.reason === "all_on_leave"
              ? "ทุกคนใน pool ลาวันนี้"
              : "ยังไม่ได้ตั้ง pool"}
          </div>
        )}
      </div>

      {/* pool rotation list */}
      <div>
        <div className="text-xs text-txt-soft mb-1.5 inline-flex items-center gap-1">
          <IconUsers size={11} strokeWidth={2.4} />
          ลำดับการสลับ ({duty.poolEmployeeIds.length} คน)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {duty.poolEmployeeIds.map((id, idx) => {
            const emp = empById.get(id);
            if (!emp) return null;
            const isCurrent = assignment?.primaryEmpId === id;
            return (
              <div
                key={id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                  isCurrent
                    ? "bg-maroon text-gold-lt"
                    : "bg-cream text-txt-mid border border-bdr"
                }`}
              >
                <span className="opacity-70">{idx + 1}.</span>
                {emp.nickname || emp.name}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal สำหรับเพิ่ม/แก้หน้าที่ ──────────────────────────────── */
function DutyEditModal({
  duty,
  employeeDirectory,
  onSave,
  onClose,
}: {
  duty: Duty | null;
  employeeDirectory: Employee[];
  onSave: (data: Omit<Duty, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(duty?.name || "");
  const [period, setPeriod] = useState<"weekly" | "monthly">(
    duty?.period || "weekly",
  );
  const [poolIds, setPoolIds] = useState<string[]>(duty?.poolEmployeeIds || []);
  const [startDate, setStartDate] = useState(
    duty?.rotationStartDate || toYMD(new Date()),
  );
  const [saving, setSaving] = useState(false);

  const toggleEmp = (id: string) => {
    setPoolIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setPoolIds((prev) => {
      const copy = [...prev];
      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
      return copy;
    });
  };
  const moveDown = (idx: number) => {
    setPoolIds((prev) => {
      if (idx >= prev.length - 1) return prev;
      const copy = [...prev];
      [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
      return copy;
    });
  };

  const canSave = name.trim() && poolIds.length > 0;
  const empById = new Map(employeeDirectory.map((e) => [e.id, e]));

  return (
    <BaseModal onClose={onClose} maxWidthClass="max-w-[480px]">
      <div className="sticky top-0 z-10 bg-cream px-5 py-4 border-b border-bdr flex items-center gap-3">
        <div className="w-10 h-10 rounded-[11px] bg-gold-pale flex items-center justify-center shrink-0">
          <IconCalendarClock
            size={20}
            strokeWidth={2.4}
            className="text-maroon"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-lg text-txt">
            {duty ? "แก้ไขหน้าที่" : "เพิ่มหน้าที่ใหม่"}
          </div>
        </div>
        <button
          type="button"
          aria-label="ปิด"
          onClick={onClose}
          className="w-9 h-9 rounded-[10px] border border-bdr bg-white text-txt-mid cursor-pointer flex items-center justify-center"
        >
          <IconX size={18} strokeWidth={2.3} />
        </button>
      </div>

      <div className="px-4 py-3.5">
        {/* name */}
        <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 block">
            ชื่อหน้าที่
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ทำความสะอาด, จัดของแถม"
            className="w-full py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] border-bdr bg-white"
          />
        </div>

        {/* period */}
        <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 block">
            สลับทุก
          </label>
          <div className="flex gap-2">
            {(["weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`flex-1 py-2 rounded-[9px] text-sm font-semibold cursor-pointer font-[inherit] border-[1.5px] active:scale-[0.98] transition-transform duration-100 ${
                  period === p
                    ? "bg-maroon text-white border-maroon"
                    : "bg-white text-txt-mid border-bdr"
                }`}
              >
                {p === "weekly" ? "สัปดาห์ (7 วัน)" : "เดือน"}
              </button>
            ))}
          </div>
        </div>

        {/* rotation start date */}
        <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 block">
            เริ่ม rotation วันที่
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] border-bdr bg-white"
          />
          <div className="text-xs text-txt-soft mt-1">
            คนแรกใน pool ทำหน้าที่ในช่วงที่เริ่ม
          </div>
        </div>

        {/* pool — selected list with reorder */}
        {poolIds.length > 0 && (
          <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
            <label className="text-xs text-maroon font-bold mb-2 block">
              ลำดับการสลับ ({poolIds.length} คน)
            </label>
            <div className="flex flex-col gap-1.5">
              {poolIds.map((id, idx) => {
                const emp = empById.get(id);
                if (!emp) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 p-2 rounded-[8px] bg-white border border-bdr"
                  >
                    <span className="w-6 text-center text-xs font-bold text-maroon">
                      {idx + 1}
                    </span>
                    <AvatarCircle
                      avatar={emp.avatar}
                      avatarType={emp.avatarType}
                      avatarImageUrl={emp.avatarImageUrl}
                      size={26}
                      fontSize={11}
                      border="none"
                    />
                    <div className="flex-1 text-sm font-semibold text-txt truncate">
                      {emp.nickname || emp.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-[6px] border border-bdr bg-cream text-txt-mid text-xs cursor-pointer disabled:opacity-30 active:scale-[0.92] transition-transform"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(idx)}
                      disabled={idx === poolIds.length - 1}
                      className="w-7 h-7 rounded-[6px] border border-bdr bg-cream text-txt-mid text-xs cursor-pointer disabled:opacity-30 active:scale-[0.92] transition-transform"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEmp(id)}
                      aria-label="ลบจาก pool"
                      className="w-7 h-7 rounded-[6px] bg-red-lt flex items-center justify-center cursor-pointer border border-[#C0392B30] active:scale-[0.92] transition-transform"
                    >
                      <IconX size={12} className="text-red" strokeWidth={2.4} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* pool — all employees to pick */}
        <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-2 block">
            เลือกคนเข้า pool
          </label>
          <div className="flex flex-col gap-1">
            {employeeDirectory.map((emp) => {
              const selected = poolIds.includes(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleEmp(emp.id)}
                  className={`flex items-center gap-2 p-2 rounded-[8px] border-[1.5px] cursor-pointer font-[inherit] text-left active:scale-[0.99] transition-transform ${
                    selected
                      ? "bg-gold-pale border-gold"
                      : "bg-white border-bdr"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    readOnly
                    className="w-4 h-4 accent-maroon pointer-events-none"
                  />
                  <AvatarCircle
                    avatar={emp.avatar}
                    avatarType={emp.avatarType}
                    avatarImageUrl={emp.avatarImageUrl}
                    size={26}
                    fontSize={11}
                    border="none"
                  />
                  <div className="flex-1 text-sm font-semibold text-txt truncate">
                    {emp.nickname || emp.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="sticky bottom-0 z-10 bg-white px-4 py-3 border-t border-bdr">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-[11px] rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  name: name.trim(),
                  period,
                  poolEmployeeIds: poolIds,
                  rotationStartDate: startDate,
                });
              } finally {
                setSaving(false);
              }
            }}
            className={`flex-1 py-[11px] rounded-[10px] border-none text-white text-sm font-bold cursor-pointer font-[inherit] active:scale-[0.98] transition-transform ${
              canSave && !saving ? "bg-maroon" : "bg-bdr cursor-not-allowed"
            }`}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

/* ─── helper: getPeriodIndex re-export (unused but kept for future) ── */
export { getPeriodIndex };
