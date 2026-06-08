/* ─── Admin: Duty Schedule (ตารางหน้าที่) ──────────────────────────
   admin สร้าง/แก้/ลบ duty + เลือก pool พนักงาน + เรียงลำดับ rotation     */

import {
  AlertTriangle as IconAlertTriangle,
  CalendarClock as IconCalendarClock,
  CalendarDays as IconCalendarDays,
  Plus as IconPlus,
  RotateCw as IconRotate,
  Trash2 as IconTrash,
  Users as IconUsers,
  X as IconX,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  DutyAssignmentsSnapshot,
  SnapshotAssignment,
  SnapshotPoolMember,
} from "../../firebase/dutyAssignments";
import type { Duty, Employee, Role } from "../../types";
import { toYMD } from "../../utils/dateUtils";
import { getPeriodIndex } from "../../utils/dutyUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";

interface Props {
  duties: Duty[];
  dutyAssignmentsToday: DutyAssignmentsSnapshot | null;
  roles: Role[];
  employeeDirectory: Employee[];
  onUpsertDuty: (
    id: string | null,
    data: Omit<Duty, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  onDeleteDuty: (id: string) => Promise<void>;
  showToast?: (msg: string) => void;
}

export default function DutySchedulePanel({
  duties,
  dutyAssignmentsToday,
  roles,
  employeeDirectory,
  onUpsertDuty,
  onDeleteDuty,
  showToast,
}: Props) {
  const [editing, setEditing] = useState<Duty | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Duty | null>(null);

  // assignments + pool มาจาก server snapshot — single source of truth
  // กับฝั่งพนักงาน (Firestore rules ปิดให้พนักงานอ่าน peer data ไม่ได้)
  const assignments = useMemo(
    () => dutyAssignmentsToday?.assignments || [],
    [dutyAssignmentsToday],
  );
  const empById = useMemo(() => {
    const m = new Map<string, SnapshotPoolMember>();
    for (const a of assignments) {
      for (const member of a.pool) m.set(member.id, member);
    }
    return m;
  }, [assignments]);

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
                roles={roles}
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
          roles={roles}
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
  roles,
  onEdit,
  onDelete,
}: {
  duty: Duty;
  assignment: SnapshotAssignment | undefined;
  empById: Map<string, SnapshotPoolMember>;
  roles: Role[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const role = roles.find((r) => r.id === duty.roleId);
  // Pool + excludedCount มาจาก snapshot (server-computed กับ rotation algorithm)
  const resolvedPool = assignment?.pool || [];
  const excludedCount = assignment?.excludedCount || 0;
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

      {/* pool rotation list — resolved จาก role members */}
      <div>
        <div className="text-xs text-txt-soft mb-1.5 inline-flex items-center gap-1">
          <IconUsers size={11} strokeWidth={2.4} />
          ตำแหน่ง {role?.name || "(ลบแล้ว)"} · {resolvedPool.length} คน
          {excludedCount > 0 && (
            <span className="text-txt-soft">(ตัดออก {excludedCount} คน)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {resolvedPool.map((emp, idx) => {
            const isCurrent = assignment?.primaryEmpId === emp.id;
            return (
              <div
                key={emp.id}
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
  roles,
  employeeDirectory,
  onSave,
  onClose,
}: {
  duty: Duty | null;
  roles: Role[];
  employeeDirectory: Employee[];
  onSave: (data: Omit<Duty, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(duty?.name || "");
  const [period, setPeriod] = useState<"weekly" | "monthly">(
    duty?.period || "weekly",
  );
  const [roleId, setRoleId] = useState<string>(duty?.roleId || "");
  // rotation anchor — เก็บเป็นเดือน (YYYY-MM) · save จริงเป็น YYYY-MM-01
  const [startMonth, setStartMonth] = useState(
    (duty?.rotationStartDate || toYMD(new Date())).slice(0, 7),
  );
  // คนในตำแหน่งที่ admin ตัดออก — ไม่ให้เข้า rotation pool
  const [excludedIds, setExcludedIds] = useState<Set<string>>(
    () => new Set(duty?.excludedEmpIds || []),
  );
  const [saving, setSaving] = useState(false);

  function toggleExclude(empId: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  // Preview pool — คนในตำแหน่งที่เลือก ทั้งหมด (รวมที่ตัดออก) เรียงตาม
  // displayOrder เพื่อให้ admin toggle ได้
  const previewPool = roleId
    ? employeeDirectory
        .filter((e) => e.roleId === roleId && !e.salaryDisabled)
        .sort((a, b) => {
          const ao = typeof a.displayOrder === "number" ? a.displayOrder : null;
          const bo = typeof b.displayOrder === "number" ? b.displayOrder : null;
          if (ao !== null && bo !== null) return ao - bo;
          if (ao !== null) return -1;
          if (bo !== null) return 1;
          return (a.name || "").localeCompare(b.name || "", "th");
        })
    : [];

  const includedCount = previewPool.filter(
    (e) => !excludedIds.has(e.id),
  ).length;

  const canSave = name.trim() && roleId && includedCount > 0;

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

        {/* rotation start month */}
        <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 block">
            เริ่ม rotation เดือน
          </label>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            style={{ WebkitAppearance: "none" }}
            className="w-full min-w-0 box-border appearance-none py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] border-bdr bg-white"
          />
          <div className="text-xs text-txt-soft mt-1">
            คนแรกใน pool ทำหน้าที่ตั้งแต่ต้นเดือนนี้
          </div>
        </div>

        {/* role selector — ตำแหน่งไหนทำหน้าที่นี้ */}
        <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-2 block">
            ตำแหน่งที่ทำหน้าที่นี้
          </label>
          <div className="flex flex-col gap-1">
            {roles.length === 0 && (
              <div className="text-xs text-txt-soft italic p-2">
                ยังไม่มีตำแหน่ง — เพิ่มที่ "ตั้งค่า → ตำแหน่ง" ก่อน
              </div>
            )}
            {roles.map((role) => {
              const selected = roleId === role.id;
              const memberCount = employeeDirectory.filter(
                (e) => e.roleId === role.id && !e.salaryDisabled,
              ).length;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setRoleId(role.id)}
                  className={`flex items-center gap-2 p-2 rounded-[8px] border-[1.5px] cursor-pointer font-[inherit] text-left active:scale-[0.99] transition-transform ${
                    selected
                      ? "bg-gold-pale border-gold"
                      : "bg-white border-bdr"
                  }`}
                >
                  <input
                    type="radio"
                    checked={selected}
                    readOnly
                    className="w-4 h-4 accent-maroon pointer-events-none"
                  />
                  <div className="flex-1 text-sm font-semibold text-txt truncate">
                    {role.name}
                  </div>
                  <span className="text-xs font-bold text-maroon shrink-0">
                    {memberCount} คน
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* preview pool — toggle ตัดคนออกได้ (excludedIds) */}
        {previewPool.length > 0 && (
          <div className="mb-3 p-3 rounded-[10px] bg-cream border border-bdr">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-txt-mid font-bold">
                ลำดับการสลับ · {includedCount}/{previewPool.length} คน
              </label>
              {includedCount === 0 && (
                <span className="text-[11px] text-red font-bold inline-flex items-center gap-1">
                  <IconAlertTriangle size={11} strokeWidth={2.4} />
                  ตัดออกหมดแล้ว
                </span>
              )}
            </div>
            <div className="text-xs text-txt-soft mb-2">
              คลิกชื่อเพื่อตัดคนออก/นำกลับ (ตัดออกจะข้ามใน rotation)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {previewPool.map((emp) => {
                const isExcluded = excludedIds.has(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleExclude(emp.id)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold cursor-pointer font-[inherit] border transition-all active:scale-[0.96] ${
                      isExcluded
                        ? "bg-cream-dk/40 text-txt-soft border-bdr line-through opacity-60"
                        : "bg-white text-txt-mid border-bdr hover:border-maroon"
                    }`}
                  >
                    <AvatarCircle
                      avatar={emp.avatar}
                      avatarType={emp.avatarType}
                      avatarImageUrl={emp.avatarImageUrl}
                      size={18}
                      fontSize={9}
                      border="none"
                    />
                    {emp.nickname || emp.name}
                    {isExcluded && (
                      <IconX size={11} strokeWidth={2.4} className="ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                  roleId,
                  excludedEmpIds: [...excludedIds],
                  rotationStartDate: `${startMonth}-01`,
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
