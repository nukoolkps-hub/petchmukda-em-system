/* ─── DutyEditModal — ฟอร์มเพิ่ม/แก้หน้าที่ (admin) ─────────────────
   2 ประเภท (kind):
   • rotation — หมุนเวียนคนในตำแหน่งตามรอบ (สัปดาห์/เดือน) + ตัดคนออกได้
   • coverage — แทนคนลาของตำแหน่งเป้าหมาย (เลือกรายชื่อคนแทน)             */

import {
  AlertTriangle as IconAlertTriangle,
  CalendarClock as IconCalendarClock,
  X as IconX,
} from "lucide-react";
import { useState } from "react";
import type { Duty, Employee, Role } from "../../types";
import { toYMD } from "../../utils/dateUtils";
import AvatarCircle from "../shared/AvatarCircle";
import BaseModal from "../shared/BaseModal";
import ThaiMonthPicker from "../shared/ThaiMonthPicker";
import ToggleSwitch from "../shared/ToggleSwitch";

/** เรียงพนักงานตาม displayOrder (asc) → ชื่อ (fallback) — ตรงกับ
 *  resolveDutyPool ฝั่ง server เพื่อให้ preview ตรงกับ rotation จริง */
function sortByDisplayOrder(employees: Employee[]): Employee[] {
  return [...employees].sort((a, b) => {
    const ao = typeof a.displayOrder === "number" ? a.displayOrder : null;
    const bo = typeof b.displayOrder === "number" ? b.displayOrder : null;
    if (ao !== null && bo !== null) return ao - bo;
    if (ao !== null) return -1;
    if (bo !== null) return 1;
    return (a.name || "").localeCompare(b.name || "", "th");
  });
}

interface DutyEditModalProps {
  duty: Duty | null;
  roles: Role[];
  employeeDirectory: Employee[];
  onSave: (data: Omit<Duty, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onClose: () => void;
}

export default function DutyEditModal({
  duty,
  roles,
  employeeDirectory,
  onSave,
  onClose,
}: DutyEditModalProps) {
  const [name, setName] = useState(duty?.name || "");
  const [kind, setKind] = useState<"rotation" | "coverage">(
    duty?.kind || "rotation",
  );
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
  // (monthly) ให้สิทธิ์กองกลางแม้ขาย/ซื้อไม่ถึง 80%
  const [grantsPoolEligibility, setGrantsPoolEligibility] = useState<boolean>(
    duty?.grantsPoolEligibility ?? false,
  );
  // coverage — ตำแหน่งเป้าหมาย + รายชื่อคนแทน
  const [coverageRoleId, setCoverageRoleId] = useState<string>(
    duty?.coverageRoleId || "",
  );
  const [candidateIds, setCandidateIds] = useState<Set<string>>(
    () => new Set(duty?.candidateEmpIds || []),
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
  function toggleCandidate(empId: string) {
    setCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  // coverage: ผู้สมัครเป็นคนแทน = พนักงาน active ทั้งหมด
  const coverageCandidates = sortByDisplayOrder(
    employeeDirectory.filter((e) => !e.salaryDisabled),
  );
  // rotation: คนในตำแหน่งที่เลือก (รวมที่ตัดออก เพื่อให้ toggle ได้)
  const rotationPool = roleId
    ? sortByDisplayOrder(
        employeeDirectory.filter(
          (e) => e.roleId === roleId && !e.salaryDisabled,
        ),
      )
    : [];

  const includedCount = rotationPool.filter(
    (e) => !excludedIds.has(e.id),
  ).length;

  const canSave =
    kind === "coverage"
      ? !!name.trim() && !!coverageRoleId && candidateIds.size > 0
      : !!name.trim() && !!roleId && includedCount > 0;

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
            placeholder="เช่น ทำความสะอาด, แทนบัญชี"
            className="w-full py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] border-bdr bg-white"
          />
        </div>

        {/* kind — หมุนเวียน / แทนคนลา */}
        <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
          <label className="text-xs text-maroon font-bold mb-1.5 block">
            ประเภทหน้าที่
          </label>
          <div className="flex gap-2">
            {(
              [
                ["rotation", "หมุนเวียน"],
                ["coverage", "แทนคนลา"],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 py-2 rounded-[9px] text-sm font-semibold cursor-pointer font-[inherit] border-[1.5px] active:scale-[0.98] transition-transform duration-100 ${
                  kind === k
                    ? "bg-maroon text-white border-maroon"
                    : "bg-white text-txt-mid border-bdr"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="text-xs text-txt-soft mt-1.5">
            {kind === "rotation"
              ? "หมุนเวียนคนในตำแหน่งตามรอบ (สัปดาห์/เดือน)"
              : "เมื่อคนในตำแหน่งเป้าหมายลา → ระบบเลือกคนแทนให้ยุติธรรม"}
          </div>
        </div>

        {kind === "coverage" ? (
          <CoverageFields
            roles={roles}
            employeeDirectory={employeeDirectory}
            coverageRoleId={coverageRoleId}
            setCoverageRoleId={setCoverageRoleId}
            candidateIds={candidateIds}
            toggleCandidate={toggleCandidate}
            coverageCandidates={coverageCandidates}
          />
        ) : (
          <RotationFields
            roles={roles}
            employeeDirectory={employeeDirectory}
            period={period}
            setPeriod={setPeriod}
            startMonth={startMonth}
            setStartMonth={setStartMonth}
            roleId={roleId}
            setRoleId={setRoleId}
            rotationPool={rotationPool}
            excludedIds={excludedIds}
            toggleExclude={toggleExclude}
            includedCount={includedCount}
            grantsPoolEligibility={grantsPoolEligibility}
            setGrantsPoolEligibility={setGrantsPoolEligibility}
          />
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
                await onSave(
                  kind === "coverage"
                    ? {
                        name: name.trim(),
                        kind: "coverage",
                        period: "weekly",
                        roleId: "",
                        coverageRoleId,
                        candidateEmpIds: [...candidateIds],
                        rotationStartDate: `${startMonth}-01`,
                      }
                    : {
                        name: name.trim(),
                        kind: "rotation",
                        period,
                        roleId,
                        excludedEmpIds: [...excludedIds],
                        // toggle เฉพาะ monthly · weekly บังคับ false
                        grantsPoolEligibility:
                          period === "monthly" ? grantsPoolEligibility : false,
                        rotationStartDate: `${startMonth}-01`,
                      },
                );
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

/* ─── ตัวเลือกตำแหน่ง (ใช้ร่วม rotation + coverage) ─────────────────── */
function RoleRadioList({
  roles,
  employeeDirectory,
  selectedId,
  onSelect,
  emptyHint,
}: {
  roles: Role[];
  employeeDirectory: Employee[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyHint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {roles.length === 0 && emptyHint && (
        <div className="text-xs text-txt-soft italic p-2">{emptyHint}</div>
      )}
      {roles.map((role) => {
        const selected = selectedId === role.id;
        const memberCount = employeeDirectory.filter(
          (e) => e.roleId === role.id && !e.salaryDisabled,
        ).length;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            className={`flex items-center gap-2 p-2 rounded-[8px] border-[1.5px] cursor-pointer font-[inherit] text-left active:scale-[0.99] transition-transform ${
              selected ? "bg-gold-pale border-gold" : "bg-white border-bdr"
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
  );
}

/* ─── ฟิลด์ของ coverage (แทนคนลา) ──────────────────────────────────── */
function CoverageFields({
  roles,
  employeeDirectory,
  coverageRoleId,
  setCoverageRoleId,
  candidateIds,
  toggleCandidate,
  coverageCandidates,
}: {
  roles: Role[];
  employeeDirectory: Employee[];
  coverageRoleId: string;
  setCoverageRoleId: (id: string) => void;
  candidateIds: Set<string>;
  toggleCandidate: (id: string) => void;
  coverageCandidates: Employee[];
}) {
  return (
    <>
      <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
        <label className="text-xs text-maroon font-bold mb-2 block">
          ตำแหน่งเป้าหมาย (เมื่อลา ต้องหาคนแทน)
        </label>
        <RoleRadioList
          roles={roles}
          employeeDirectory={employeeDirectory}
          selectedId={coverageRoleId}
          onSelect={setCoverageRoleId}
        />
      </div>

      <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
        <label className="text-xs text-maroon font-bold mb-1 block">
          รายชื่อคนที่มาแทนได้ ({candidateIds.size} คน)
        </label>
        <div className="text-xs text-txt-soft mb-2">
          เลือกคนที่ทำ weekly — ระบบจะเลือกคน "ที่เคยแทนน้อยสุด" ก่อน ให้ยุติธรรม
        </div>
        <div className="flex flex-wrap gap-1.5">
          {coverageCandidates.map((emp) => {
            const on = candidateIds.has(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggleCandidate(emp.id)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold cursor-pointer font-[inherit] border transition-all active:scale-[0.96] ${
                  on
                    ? "bg-maroon text-gold-lt border-maroon"
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
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ─── ฟิลด์ของ rotation (หมุนเวียน) ────────────────────────────────── */
function RotationFields({
  roles,
  employeeDirectory,
  period,
  setPeriod,
  startMonth,
  setStartMonth,
  roleId,
  setRoleId,
  rotationPool,
  excludedIds,
  toggleExclude,
  includedCount,
  grantsPoolEligibility,
  setGrantsPoolEligibility,
}: {
  roles: Role[];
  employeeDirectory: Employee[];
  period: "weekly" | "monthly";
  setPeriod: (p: "weekly" | "monthly") => void;
  startMonth: string;
  setStartMonth: (m: string) => void;
  roleId: string;
  setRoleId: (id: string) => void;
  rotationPool: Employee[];
  excludedIds: Set<string>;
  toggleExclude: (id: string) => void;
  includedCount: number;
  grantsPoolEligibility: boolean;
  setGrantsPoolEligibility: (v: boolean) => void;
}) {
  return (
    <>
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

      {/* monthly: สิทธิ์กองกลางแม้ขายไม่ถึง 80% — ทั้งกรอบกดได้ + tactile feedback */}
      {period === "monthly" && (
        <button
          type="button"
          onClick={() => setGrantsPoolEligibility(!grantsPoolEligibility)}
          className="w-full text-left mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30] cursor-pointer font-[inherit] flex items-center gap-2.5 transition-all duration-150 active:scale-[0.99]"
        >
          <ToggleSwitch enabled={grantsPoolEligibility} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-txt">
              ให้สิทธิ์กองกลางแม้ขาย/ซื้อไม่ถึง 80%
            </span>
            <span className="block text-xs text-txt-soft mt-0.5">
              คนทำหน้าที่นี้ติดทั้งเดือน ขายไม่ทันเพื่อน → เข้ากองกลางได้ (ยังเคารพฝั่งที่ admin
              ปิด · ไม่กระทบเกณฑ์เงินเดือนพื้นฐาน 50%)
            </span>
          </span>
        </button>
      )}

      {/* rotation start month */}
      <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
        <label className="text-xs text-maroon font-bold mb-1.5 block">
          เริ่ม rotation เดือน
        </label>
        <ThaiMonthPicker value={startMonth} onChange={setStartMonth} />
        <div className="text-xs text-txt-soft mt-1">
          คนแรกใน pool ทำหน้าที่ตั้งแต่ต้นเดือนนี้
        </div>
      </div>

      {/* role selector */}
      <div className="mb-3 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
        <label className="text-xs text-maroon font-bold mb-2 block">
          ตำแหน่งที่ทำหน้าที่นี้
        </label>
        <RoleRadioList
          roles={roles}
          employeeDirectory={employeeDirectory}
          selectedId={roleId}
          onSelect={setRoleId}
          emptyHint='ยังไม่มีตำแหน่ง — เพิ่มที่ "ตั้งค่า → ตำแหน่ง" ก่อน'
        />
      </div>

      {/* preview pool — toggle ตัดคนออกได้ */}
      {rotationPool.length > 0 && (
        <div className="mb-3 p-3 rounded-[10px] bg-cream border border-bdr">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-txt-mid font-bold">
              ลำดับการสลับ · {includedCount}/{rotationPool.length} คน
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
            {rotationPool.map((emp) => {
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
    </>
  );
}
