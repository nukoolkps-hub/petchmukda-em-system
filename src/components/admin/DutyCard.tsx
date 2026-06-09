/* ─── DutyCard — การ์ด 1 หน้าที่ (admin) ───────────────────────────
   แสดง: ชื่อ + ประเภท (หมุนเวียน/แทนคนลา) + วันนี้ใครทำ + รายชื่อ pool
   ข้อมูล assignment มาจาก server snapshot (single source of truth)

   coverage 1 หน้าที่อาจมีหลาย assignment (เป้าหมายลาหลายคน) → รับเป็น
   array แล้วแสดง "วันนี้" ทุกบรรทัด                                       */

import {
  CalendarClock as IconCalendarClock,
  CalendarDays as IconCalendarDays,
  RotateCw as IconRotate,
  Trash2 as IconTrash,
  Users as IconUsers,
} from "lucide-react";
import type {
  SnapshotAssignment,
  SnapshotPoolMember,
} from "../../firebase/dutyAssignments";
import type { Duty, Role } from "../../types";
import AvatarCircle from "../shared/AvatarCircle";

interface DutyCardProps {
  duty: Duty;
  /** assignment ทั้งหมดของหน้าที่นี้ (rotation = 1 · coverage = 1 ต่อเป้าหมายที่ลา) */
  assignments: SnapshotAssignment[];
  empById: Map<string, SnapshotPoolMember>;
  roles: Role[];
  onEdit: () => void;
  onDelete: () => void;
}

/** 1 บรรทัด "วันนี้" — คนที่ทำจริง + เหตุผล (แทนใคร) */
function TodayRow({
  assignment,
  empById,
  isCoverage,
  coverageRoleName,
}: {
  assignment: SnapshotAssignment | undefined;
  empById: Map<string, SnapshotPoolMember>;
  isCoverage: boolean;
  coverageRoleName: string;
}) {
  const actual = assignment?.actualEmpId
    ? empById.get(assignment.actualEmpId)
    : null;
  const primary = assignment?.primaryEmpId
    ? empById.get(assignment.primaryEmpId)
    : null;
  const isSubstitute =
    assignment?.reason === "substitute_for_leave" ||
    assignment?.reason === "double_up";

  if (actual) {
    return (
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
          {isCoverage ? (
            <div className="text-[11px] text-txt-soft">
              แทน {assignment?.targetName || "—"} (ลา)
            </div>
          ) : (
            isSubstitute &&
            primary && (
              <div className="text-[11px] text-txt-soft">
                แทน {primary.nickname || primary.name} (ลา)
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`text-sm italic ${
        isCoverage && assignment?.reason === "empty_target_role"
          ? "text-red font-semibold not-italic"
          : "text-txt-soft"
      }`}
    >
      {isCoverage
        ? assignment?.reason === "coverage_no_candidate"
          ? `${assignment?.targetName || "เป้าหมาย"} ลา — ไม่มีคนแทนได้`
          : assignment?.reason === "empty_target_role"
            ? `⚠ ไม่มีคนในตำแหน่ง ${coverageRoleName} — กรุณาตรวจสอบการตั้งค่า`
            : `${coverageRoleName}ไม่ลาวันนี้ — ไม่ต้องมีคนแทน`
        : assignment?.reason === "all_on_leave"
          ? "ทุกคนใน pool ลาวันนี้"
          : "ยังไม่ได้ตั้ง pool"}
    </div>
  );
}

export default function DutyCard({
  duty,
  assignments,
  empById,
  roles,
  onEdit,
  onDelete,
}: DutyCardProps) {
  const isCoverage = duty.kind === "coverage";
  const role = roles.find((r) => r.id === duty.roleId);
  const coverageRole = roles.find((r) => r.id === duty.coverageRoleId);
  const coverageRoleName = coverageRole?.name || "เป้าหมาย";
  // pool + excludedCount + primary highlight อ้างจาก assignment แรกพอ
  const head = assignments[0];
  const resolvedPool = head?.pool || [];
  const excludedCount = head?.excludedCount || 0;

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
          <div className="text-xs text-txt-soft inline-flex items-center gap-1 mt-0.5 flex-wrap">
            <IconRotate size={11} strokeWidth={2.4} />
            {isCoverage
              ? `แทนคนลา · ${coverageRole?.name || "(ลบแล้ว)"}`
              : `สลับทุก${duty.period === "weekly" ? "สัปดาห์" : "เดือน"}`}
            {duty.period === "monthly" && duty.grantsPoolEligibility && (
              <span className="px-1.5 py-px rounded-[6px] bg-gold-pale text-maroon font-bold text-[10px]">
                ให้สิทธิ์กองกลาง
              </span>
            )}
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

      {/* วันนี้ใครทำ — coverage แสดงทุกเป้าหมายที่ลา */}
      <div className="rounded-[10px] bg-gold-pale/40 border border-gold/30 p-2.5 mb-2.5">
        <div className="text-xs text-txt-soft mb-1.5 inline-flex items-center gap-1">
          <IconCalendarDays size={11} strokeWidth={2.4} />
          วันนี้
        </div>
        <div className="flex flex-col gap-2">
          {(assignments.length > 0 ? assignments : [undefined]).map((a, i) => (
            <TodayRow
              key={a ? `${a.dutyId}-${a.targetEmpId || i}` : i}
              assignment={a}
              empById={empById}
              isCoverage={isCoverage}
              coverageRoleName={coverageRoleName}
            />
          ))}
        </div>
      </div>

      {/* pool list — rotation: สมาชิกตำแหน่ง · coverage: รายชื่อคนแทน */}
      <div>
        <div className="text-xs text-txt-soft mb-1.5 inline-flex items-center gap-1">
          <IconUsers size={11} strokeWidth={2.4} />
          {isCoverage
            ? `คนที่มาแทนได้ · ${resolvedPool.length} คน`
            : `ตำแหน่ง ${role?.name || "(ลบแล้ว)"} · ${resolvedPool.length} คน`}
          {!isCoverage && excludedCount > 0 && (
            <span className="text-txt-soft">(ตัดออก {excludedCount} คน)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {resolvedPool.map((emp, idx) => {
            const isCurrent = head?.primaryEmpId === emp.id;
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
