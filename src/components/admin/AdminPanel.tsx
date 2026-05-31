import {
  AlertOctagon as IconAlertOctagon,
  Ban as IconBan,
  Banknote as IconBanknote,
  Briefcase as IconBriefcase,
  Landmark as IconBuildingBank,
  CalendarDays as IconCalendar,
  Check as IconCheck,
  ChevronDown as IconChevronDown,
  CircleCheck as IconCircleCheck,
  CircleDollarSign as IconCircleDollarSign,
  Copy as IconCopy,
  Cross as IconCross,
  Diamond as IconDiamond,
  FastForward as IconFastForward,
  Lightbulb as IconLightbulb,
  Lock as IconLock,
  MessageCircle as IconMessageCircle,
  Package as IconPackage,
  Pencil as IconPencil,
  RefreshCw as IconRefresh,
  Settings as IconSettings,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Sun as IconSun,
  Ticket as IconTicket,
  Trash2 as IconTrash,
  User as IconUser,
  X as IconX,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { COLORS, LEAVE_TYPES, THAI_MONTH_NAMES } from "../../constants";
import { fmtDate, fmtDateWithWeekday, isPast } from "../../utils/dateUtils";
import {
  ADMIN_NAV_GROUPS,
  type AdminGroupId,
  type AdminNavGroup,
  type AdminSectionId,
  getAdminGroupForSection,
} from "../layout/adminNavConfig";
import ConfirmModal from "../modals/ConfirmModal";
import SalaryAdminEdit from "../salary/SalaryAdminEdit";
import AvatarCircle from "../shared/AvatarCircle";
import BankLogo from "../shared/BankLogo";
import BaseModal from "../shared/BaseModal";
import AdminAdvancePanel from "./AdminAdvancePanel";
import PayrollSummaryPanel from "./PayrollSummaryPanel";
import RolesAdminPanel from "./RolesAdminPanel";

function AdminNavBadge({ count }: { count: number }) {
  return (
    <span className="absolute top-[3px] right-[3px] flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-xs font-bold leading-none text-white shadow-red-glow">
      {count}
    </span>
  );
}

/* ─── แสดง breakdown วันธรรมดา/อาทิตย์ ในวงเล็บ ใต้ยอดรวมวันลา ──── */
function LeaveDayBreakdown({
  weekdays,
  sundays,
}: {
  weekdays: number;
  sundays: number;
}) {
  if (weekdays <= 0 && sundays <= 0) return null;
  const parts: { key: string; node: ReactNode }[] = [];
  if (weekdays > 0) {
    parts.push({ key: "wd", node: <>วันธรรมดา × {weekdays}</> });
  }
  if (sundays > 0) {
    parts.push({
      key: "sun",
      node: (
        <span className="inline-flex items-center gap-0.5">
          <IconSun size={10} strokeWidth={2.4} />
          วันอาทิตย์ × {sundays}
          <span className="opacity-70">(×1.5)</span>
        </span>
      ),
    });
  }
  return (
    <div className="text-[11px] text-txt-soft font-medium mt-0.5 leading-snug whitespace-nowrap">
      {parts.map((p, i) => (
        <span key={p.key} className="block">
          {i === 0 ? "(" : null}
          {p.node}
          {i === parts.length - 1 ? ")" : null}
        </span>
      ))}
    </div>
  );
}

/* ─── Admin Panel (main container) ─────────────────────────────── */
export default function AdminPanel({
  allLeaves,
  employeeDirectory,
  onDelete,
  onUpdateRole,
  onDeleteEmployee,
  salaryData,
  setSalaryData,
  onSaveSalary,
  advanceRequests,
  onUpdateAdvance,
  roles,
  onUpsertRole,
  onDeleteRole,
  payrollConfirms,
  onSetPayrollConfirm,
  showToast,
  // controlled by App so the desktop Sidebar can drive section as well
  section,
  onSectionChange,
  unsavedDirty,
  onUnsavedDirtyChange,
}) {
  function tryChangeSection(newId: AdminSectionId) {
    if (newId === section) return;
    onSectionChange(newId);
  }
  function tryChangeGroup(group: AdminNavGroup) {
    tryChangeSection(group.defaultSection);
  }
  const setUnsavedDirty = onUnsavedDirtyChange;

  // เตือนตอนปิดหน้า/refresh ถ้ามี unsaved
  useEffect(() => {
    if (!unsavedDirty) return;
    function handler(e) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedDirty]);
  const [confirmLeave, setConfirmLeave] = useState<any>(null);
  const [employeeFilter, setFilterEmp] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editingRole, setEditingRole] = useState({});
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  // key = `${employeeName}:${type}` — chip ลากิจ/ลาป่วย ที่ถูกกดให้แสดงรายการวัน
  const [expandedChip, setExpandedChip] = useState<string | null>(null);
  const [confirmDeleteEmp, setConfirmDeleteEmp] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [copiedLineId, setCopiedLineId] = useState(null);

  function copyLineId(text, employeeId) {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedLineId(employeeId);
          setTimeout(() => setCopiedLineId(null), 1500);
        })
        .catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedLineId(employeeId);
        setTimeout(() => setCopiedLineId(null), 1500);
      } catch (_e) {}
      document.body.removeChild(ta);
    }
  }
  const now0 = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, "0")}`,
  );
  const [selYear, setSelYear] = useState(`${now0.getFullYear()}`);

  // รายการลาทั้งหมด (รวมอนาคต) — admin ต้องเห็นทุกใบไม่ใช่แค่ที่ผ่านมาแล้ว
  const filteredLeaves = allLeaves
    .filter((lv) => !employeeFilter || lv.employeeName.includes(employeeFilter))
    .filter((lv) => !filterType || lv.type === filterType)
    .sort((a, b) => b.start.localeCompare(a.start));
  const uniqueEmployees: string[] = [
    ...new Set(allLeaves.map((lv) => lv.employeeName)),
  ] as string[];
  const activeGroup = getAdminGroupForSection(section);
  const ActiveGroupIcon = activeGroup.Icon;
  const pendingAdvanceCount = (advanceRequests || []).filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <div>
      {/* section tabs — แสดงเฉพาะ mobile; desktop ใช้ sidebar */}
      <div className="bg-cream-dk rounded-[14px] p-2.5 mb-[18px] flex-col gap-2 flex md:hidden">
        {/* หมวดหลัก — segmented control, หมวดที่เลือกพื้นเลือดหมูทึบให้เด่น */}
        <div className="grid grid-cols-3 gap-1.5">
          {ADMIN_NAV_GROUPS.map((group) => {
            const Icon = group.Icon;
            const active = activeGroup.id === group.id;
            const pendingCount =
              group.id === "payroll" ? pendingAdvanceCount : 0;

            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={active}
                onClick={() => tryChangeGroup(group)}
                className={`relative min-w-0 px-2 py-2.5 rounded-[11px] cursor-pointer font-[inherit] transition-all duration-200 flex items-center justify-center gap-1.5 border ${active ? "bg-maroon text-white border-maroon shadow-[0_2px_8px_rgba(123,28,28,0.30)]" : "bg-transparent text-txt-soft border-[#C9973A30] hover:border-[#C9973A50]"}`}
              >
                <Icon
                  size={16}
                  color={active ? COLORS.gold : COLORS.textSoft}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="min-w-0 truncate text-sm font-bold">
                  {group.label}
                </span>
                {pendingCount > 0 && <AdminNavBadge count={pendingCount} />}
              </button>
            );
          })}
        </div>

        {/* หัวข้อย่อย — กล่องซ้อนใน + caption บอกว่าอยู่ใต้หมวดไหน */}
        <div className="rounded-[12px] bg-white/55 border border-[#C9973A25] p-2">
          <div className="flex items-center gap-1 px-1 pb-1.5 text-[11px] font-bold text-txt-soft tracking-wide">
            <ActiveGroupIcon size={12} color={COLORS.gold} strokeWidth={2.5} />
            <span className="truncate">{activeGroup.label}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeGroup.items.map((item) => {
              const Icon = item.Icon;
              const active = section === item.id;
              const pendingCount =
                item.id === "advance" ? pendingAdvanceCount : 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => tryChangeSection(item.id)}
                  className={`relative min-w-[88px] flex-1 px-2.5 py-[9px] rounded-[9px] border cursor-pointer font-[inherit] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap ${active ? "bg-gold-pale text-maroon border-[#C9973A80] shadow-[0_1px_5px_rgba(201,151,58,0.25)]" : "bg-transparent text-txt-soft border-transparent hover:bg-white/70"}`}
                >
                  <Icon
                    size={16}
                    color={active ? COLORS.maroon : COLORS.textSoft}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  <span>{item.label}</span>
                  {pendingCount > 0 && <AdminNavBadge count={pendingCount} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── POSITIONS section ── */}
      {section === "positions" && (
        <RolesAdminPanel
          roles={roles}
          employeeDirectory={employeeDirectory}
          onUpdateEmployeeRole={onUpdateRole}
          onUpsertRole={onUpsertRole}
          onDeleteRole={onDeleteRole}
          showToast={showToast}
        />
      )}

      {/* ── PAYROLL SUMMARY section ── */}
      {section === "payroll" && (
        <PayrollSummaryPanel
          employeeDirectory={employeeDirectory}
          salaryData={salaryData}
          allLeaves={allLeaves}
          advanceRequests={advanceRequests}
          roles={roles}
          payrollConfirms={payrollConfirms}
          onSetPayrollConfirm={onSetPayrollConfirm}
          onSaveSalary={onSaveSalary}
          showToast={showToast}
        />
      )}

      {/* ── ADVANCE section ── */}
      {section === "advance" && (
        <AdminAdvancePanel
          advanceRequests={advanceRequests || []}
          employeeDirectory={employeeDirectory}
          onUpdate={onUpdateAdvance}
        />
      )}

      {/* ── SALARY edit section ── */}
      {section === "salary" && (
        <SalaryAdminEdit
          employeeDirectory={employeeDirectory}
          salaryData={salaryData}
          setSalaryData={setSalaryData}
          onSaveSalary={onSaveSalary}
          allLeaves={allLeaves}
          advanceRequests={advanceRequests}
          roles={roles}
          setUnsavedDirty={setUnsavedDirty}
        />
      )}

      {/* ── SUMMARY section ── */}
      {section === "summary" &&
        (() => {
          const _now = new Date();

          // gather all unique employee names
          const empNames: string[] = [
            ...new Set(allLeaves.map((lv) => lv.employeeName)),
          ] as string[];
          const months: string[] = (
            [
              ...new Set(allLeaves.map((lv) => lv.start.slice(0, 7))),
            ] as string[]
          )
            .sort()
            .reverse();
          // selectedMonth default = เดือนปัจจุบัน แต่ dropdown มีให้เลือกแค่
          // เดือนที่มีใบลาจริง → ถ้า selectedMonth ไม่อยู่ใน list ก็ filter
          // ไม่เจอ (และ <select> โชว์ option แรกแบบโกหก) → fall back มา months[0]
          const effectiveMonth = months.includes(selectedMonth)
            ? selectedMonth
            : months[0] || selectedMonth;
          const years: string[] = (
            [
              ...new Set(allLeaves.map((lv) => lv.start.slice(0, 4))),
            ] as string[]
          )
            .sort()
            .reverse();

          // count weekday vs sunday days in a leave entry
          function countByDayType(start, end) {
            let weekdays = 0,
              sundays = 0;
            const s = new Date(`${start}T00:00:00`),
              e = new Date(`${end}T00:00:00`),
              c = new Date(s);
            while (c <= e) {
              const dow = c.getDay();
              if (dow === 0) sundays++;
              else if (dow !== 6) weekdays++;
              c.setDate(c.getDate() + 1);
            }
            return { weekdays, sundays };
          }
          function sumDayType(leaves) {
            let weekdays = 0,
              sundays = 0;
            leaves.forEach((lv) => {
              const r = countByDayType(lv.start, lv.end);
              weekdays += r.weekdays;
              sundays += r.sundays;
            });
            return { weekdays, sundays };
          }

          return (
            <div>
              {/* Monthly summary */}
              <div className="bg-white rounded-2xl p-4 mb-3.5 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="font-bold text-maroon text-base flex items-center gap-1.5">
                    <IconCalendar size={16} strokeWidth={2.4} />
                    สรุปรายเดือน
                  </div>
                  <div className="relative inline-block">
                    <select
                      value={effectiveMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="appearance-none cursor-pointer pl-2.5 pr-7 py-1.5 rounded-lg border border-bdr text-sm text-txt bg-cream font-[inherit] outline-none"
                    >
                      {months.map((m) => {
                        const [y, mo] = m.split("-");
                        return (
                          <option key={m} value={m}>
                            {THAI_MONTH_NAMES[parseInt(mo, 10) - 1]}{" "}
                            {parseInt(y, 10) + 543}
                          </option>
                        );
                      })}
                    </select>
                    <IconChevronDown
                      size={12}
                      strokeWidth={2.4}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
                    />
                  </div>
                </div>
                {empNames.length === 0 && (
                  <div className="text-txt-soft text-sm text-center py-4">
                    ไม่มีข้อมูล
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {empNames
                    .map((name) => {
                      const employeeInfo = employeeDirectory.find(
                        (e) => e.name === name,
                      );
                      const monthLeaves = allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(effectiveMonth),
                      );
                      const totalTimes = monthLeaves.length;
                      if (totalTimes === 0) return null;
                      const { weekdays, sundays } = sumDayType(monthLeaves);
                      const totalDays = weekdays + sundays;
                      const personalDays = monthLeaves
                        .filter((lv) => lv.type === "personal")
                        .reduce((s, lv) => s + lv.days, 0);
                      const sickDays = monthLeaves
                        .filter((lv) => lv.type === "sick")
                        .reduce((s, lv) => s + lv.days, 0);
                      const overQuota = totalTimes > 2;
                      return (
                        <div
                          key={name}
                          className={`px-3.5 py-3 rounded-xl border ${overQuota ? "bg-red-lt border-[#C0392B30]" : "bg-cream border-bdr"}`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <AvatarCircle
                              avatar={employeeInfo?.avatar || name.slice(0, 2)}
                              avatarType={employeeInfo?.avatarType || "text"}
                              avatarImageUrl={
                                employeeInfo?.avatarImageUrl || null
                              }
                              size={36}
                              fontSize={12}
                              border={`2px solid ${COLORS.gold}40`}
                            />
                            <div className="flex-1">
                              <div className="font-bold text-txt text-sm">
                                {name}
                              </div>
                              <div className="text-xs text-txt-soft">
                                {employeeInfo?.role || "-"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-extrabold text-lg ${overQuota ? "text-red" : "text-maroon"}`}
                              >
                                {totalDays}{" "}
                                <span className="text-xs font-medium text-txt-soft">
                                  วัน
                                </span>
                              </div>
                              <LeaveDayBreakdown
                                weekdays={weekdays}
                                sundays={sundays}
                              />
                              {overQuota && (
                                <div className="text-xs text-red font-bold inline-flex items-center gap-1 mt-0.5">
                                  <IconAlertOctagon
                                    size={11}
                                    strokeWidth={2.4}
                                  />
                                  เกินโควต้า
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap items-center">
                            {personalDays > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedChip((prev) =>
                                    prev === `${name}:personal`
                                      ? null
                                      : `${name}:personal`,
                                  )
                                }
                                className={`rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#FFE7C2] text-[#B45309] cursor-pointer font-[inherit] border inline-flex items-center gap-1 ${expandedChip === `${name}:personal` ? "border-[#B45309]" : "border-transparent"}`}
                              >
                                <IconBriefcase size={12} strokeWidth={2.4} />
                                ลากิจ {personalDays} วัน
                              </button>
                            )}
                            {sickDays > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedChip((prev) =>
                                    prev === `${name}:sick`
                                      ? null
                                      : `${name}:sick`,
                                  )
                                }
                                className={`rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#CCFBF1] text-[#0F766E] cursor-pointer font-[inherit] border inline-flex items-center gap-1 ${expandedChip === `${name}:sick` ? "border-[#0F766E]" : "border-transparent"}`}
                              >
                                <IconCross size={12} strokeWidth={2.4} />
                                ลาป่วย {sickDays} วัน
                              </button>
                            )}
                          </div>
                          {expandedChip?.startsWith(`${name}:`) && (
                            <div className="mt-2 pl-2.5 text-xs text-txt-mid border-l-2 border-gold/40 flex flex-col gap-0.5">
                              {monthLeaves
                                .filter(
                                  (lv) =>
                                    lv.type === expandedChip.split(":")[1],
                                )
                                .sort((a, b) => a.start.localeCompare(b.start))
                                .map((lv) => (
                                  <div
                                    key={lv.id}
                                    className="flex items-center gap-1"
                                  >
                                    <IconCalendar size={11} strokeWidth={2.4} />
                                    {fmtDateWithWeekday(lv.start)}
                                    {lv.start !== lv.end
                                      ? ` - ${fmtDateWithWeekday(lv.end)}`
                                      : ""}{" "}
                                    <span className="text-txt-soft">
                                      ({lv.days} วัน)
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                    .filter(Boolean)}
                  {empNames.every(
                    (name) =>
                      allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(effectiveMonth),
                      ).length === 0,
                  ) && (
                    <div className="text-txt-soft text-sm text-center py-4">
                      ไม่มีการลาในเดือนนี้
                    </div>
                  )}
                </div>
              </div>

              {/* Yearly summary */}
              <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="font-bold text-maroon text-base flex items-center gap-1.5">
                    <IconCalendar size={16} strokeWidth={2.4} />
                    สรุปรายปี
                  </div>
                  <div className="relative inline-block">
                    <select
                      value={selYear}
                      onChange={(e) => setSelYear(e.target.value)}
                      className="appearance-none cursor-pointer pl-2.5 pr-7 py-1.5 rounded-lg border border-bdr text-sm text-txt bg-cream font-[inherit] outline-none"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          ปี {parseInt(y, 10) + 543}
                        </option>
                      ))}
                    </select>
                    <IconChevronDown
                      size={12}
                      strokeWidth={2.4}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
                    />
                  </div>
                </div>
                {empNames.length === 0 && (
                  <div className="text-txt-soft text-sm text-center py-4">
                    ไม่มีข้อมูล
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {empNames
                    .map((name) => {
                      const employeeInfo = employeeDirectory.find(
                        (e) => e.name === name,
                      );
                      const yearLeaves = allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(selYear),
                      );
                      const totalTimes = yearLeaves.length;
                      if (totalTimes === 0) return null;
                      const { weekdays, sundays } = sumDayType(yearLeaves);
                      const totalDays = weekdays + sundays;
                      const personalDays = yearLeaves
                        .filter((lv) => lv.type === "personal")
                        .reduce((s, lv) => s + lv.days, 0);
                      const sickDays = yearLeaves
                        .filter((lv) => lv.type === "sick")
                        .reduce((s, lv) => s + lv.days, 0);
                      const barPct = Math.min(100, (totalDays / 30) * 100);
                      return (
                        <div
                          key={name}
                          className="p-3.5 rounded-xl bg-cream border border-bdr"
                        >
                          <div className="flex items-center gap-3 mb-2.5">
                            <AvatarCircle
                              avatar={employeeInfo?.avatar || name.slice(0, 2)}
                              avatarType={employeeInfo?.avatarType || "text"}
                              avatarImageUrl={
                                employeeInfo?.avatarImageUrl || null
                              }
                              size={38}
                              fontSize={12}
                              border={`2px solid ${COLORS.gold}40`}
                            />
                            <div className="flex-1">
                              <div className="font-bold text-txt text-sm">
                                {name}
                              </div>
                              <div className="text-sm text-txt-soft">
                                {employeeInfo?.role || "-"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-xl text-maroon">
                                {totalDays}{" "}
                                <span className="text-xs font-medium text-txt-soft">
                                  วัน
                                </span>
                              </div>
                              <LeaveDayBreakdown
                                weekdays={weekdays}
                                sundays={sundays}
                              />
                            </div>
                          </div>
                          <div className="bg-cream-dk rounded-md h-[7px] overflow-hidden mb-2.5">
                            <div
                              className="h-full rounded-md bg-linear-to-r from-gold to-gold-lt"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <div className="flex gap-1.5 flex-wrap items-center">
                            {personalDays > 0 && (
                              <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#FFE7C2] text-[#B45309] inline-flex items-center gap-1">
                                <IconBriefcase size={12} strokeWidth={2.4} />
                                ลากิจ {personalDays} วัน
                              </div>
                            )}
                            {sickDays > 0 && (
                              <div className="rounded-[20px] px-2.5 py-[3px] text-sm font-semibold bg-[#CCFBF1] text-[#0F766E] inline-flex items-center gap-1">
                                <IconCross size={12} strokeWidth={2.4} />
                                ลาป่วย {sickDays} วัน
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean)}
                  {empNames.every(
                    (name) =>
                      allLeaves.filter(
                        (lv) =>
                          lv.employeeName === name &&
                          lv.start.startsWith(selYear),
                      ).length === 0,
                  ) && (
                    <div className="text-txt-soft text-sm text-center py-4">
                      ไม่มีการลาในปีนี้
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── LEAVES section ── */}
      {section === "leaves" && (
        <div>
          <div className="flex gap-2 mb-3.5">
            <div className="relative flex-1">
              <select
                value={employeeFilter}
                onChange={(e) => setFilterEmp(e.target.value)}
                className="appearance-none cursor-pointer w-full pl-3 pr-8 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
              >
                <option value="">พนักงานทั้งหมด</option>
                {uniqueEmployees.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <IconChevronDown
                size={14}
                strokeWidth={2.4}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
              />
            </div>
            <div className="relative flex-1">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="appearance-none cursor-pointer w-full pl-3 pr-8 py-2.5 rounded-[10px] border-[1.5px] border-bdr text-sm text-txt bg-white font-[inherit] outline-none"
              >
                <option value="">ประเภททั้งหมด</option>
                {LEAVE_TYPES.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.label}
                  </option>
                ))}
              </select>
              <IconChevronDown
                size={14}
                strokeWidth={2.4}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-txt-soft"
              />
            </div>
          </div>
          {filteredLeaves.length === 0 && (
            <div className="text-center text-txt-soft py-10 text-base">
              ไม่มีรายการลาย้อนหลัง
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {filteredLeaves.map((lv) => {
              const lt = LEAVE_TYPES.find((t) => t.id === lv.type);
              const employeeInfo = employeeDirectory.find(
                (e) => e.name === lv.employeeName,
              );
              return (
                <div
                  key={lv.id}
                  className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(90,30,10,0.06)] border border-bdr flex items-start gap-3"
                >
                  <AvatarCircle
                    avatar={
                      employeeInfo?.avatar || lv.employeeName?.slice(0, 2)
                    }
                    avatarType={employeeInfo?.avatarType || "text"}
                    avatarImageUrl={employeeInfo?.avatarImageUrl || null}
                    size={42}
                    fontSize={13}
                    border={`2px solid ${COLORS.gold}40`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-txt text-base mb-[3px] flex items-center gap-1.5">
                      {lv.employeeName}
                      {!isPast(lv.end) && (
                        <span className="text-xs font-bold px-1.5 py-px rounded-[10px] bg-gold-pale text-maroon border border-[#C9973A40] inline-flex items-center gap-0.5">
                          <IconFastForward size={10} strokeWidth={2.4} />
                          อนาคต
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: lt?.color }}
                      >
                        {lt?.icon} {lt?.label}
                      </span>
                      <span className="text-sm text-txt-soft">
                        · {lv.days} วันทำการ
                      </span>
                    </div>
                    <div className="text-sm text-txt-mid">
                      {fmtDateWithWeekday(lv.start)}
                      {lv.start !== lv.end
                        ? ` - ${fmtDateWithWeekday(lv.end)}`
                        : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmLeave(lv)}
                    className="w-9 h-9 rounded-[10px] bg-red-lt flex items-center justify-center cursor-pointer shrink-0 border-[1.5px] border-[#C0392B30]"
                  >
                    <IconTrash size={16} color={COLORS.red} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })}
          </div>
          <ConfirmModal
            leave={confirmLeave}
            onConfirm={() => {
              onDelete(confirmLeave.id);
              setConfirmLeave(null);
            }}
            onCancel={() => setConfirmLeave(null)}
          />
        </div>
      )}

      {/* ── ROLES section ── */}
      {section === "roles" && (
        <div>
          <div className="flex items-center justify-between mb-3.5 gap-2">
            <div className="text-sm text-txt-soft">
              กดที่ชื่อพนักงานเพื่อเปิดหน้าต่างแก้ไข
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {employeeDirectory.map((employee) => {
              const editingNormalSalePieceRate =
                editingRole[`${employee.id}:normalSalePieceRate`];
              const editingSpecialSalePieceRate =
                editingRole[`${employee.id}:specialSalePieceRate`];
              const editingBuyPieceRate =
                editingRole[`${employee.id}:buyPieceRate`];
              const editingInvitePieceRate =
                editingRole[`${employee.id}:invitePieceRate`];
              const editingTransferPieceRate =
                editingRole[`${employee.id}:transferPieceRate`];
              const editingSinglePieceRate =
                editingRole[`${employee.id}:singlePieceRate`];
              const editingBaseSalary =
                editingRole[`${employee.id}:baseSalary`];
              const editingSocialSecurity =
                editingRole[`${employee.id}:socialSecurity`];
              const editingStartWorkMonth =
                editingRole[`${employee.id}:startWorkMonth`];
              const editingPrefix = editingRole[`${employee.id}:prefix`];
              const editingSalaryDisabled =
                editingRole[`${employee.id}:salaryDisabled`];
              const editingPoolExclusion =
                editingRole[`${employee.id}:poolExclusion`];
              const editingName = editingRole[`${employee.id}:name`];
              const dirty =
                editingNormalSalePieceRate !== undefined ||
                editingSpecialSalePieceRate !== undefined ||
                editingBuyPieceRate !== undefined ||
                editingInvitePieceRate !== undefined ||
                editingTransferPieceRate !== undefined ||
                editingSinglePieceRate !== undefined ||
                editingBaseSalary !== undefined ||
                editingSocialSecurity !== undefined ||
                editingStartWorkMonth !== undefined ||
                editingPrefix !== undefined ||
                editingSalaryDisabled !== undefined ||
                editingPoolExclusion !== undefined ||
                editingName !== undefined;
              const saveAll = async () => {
                if (editingName !== undefined && editingName.trim() !== "")
                  await onUpdateRole(employee.id, "name", editingName.trim());
                if (editingNormalSalePieceRate !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "normalSalePieceRate",
                    parseFloat(editingNormalSalePieceRate) || 0,
                  );
                if (editingSpecialSalePieceRate !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "specialSalePieceRate",
                    parseFloat(editingSpecialSalePieceRate) || 0,
                  );
                if (editingBuyPieceRate !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "buyPieceRate",
                    parseFloat(editingBuyPieceRate) || 0,
                  );
                if (editingInvitePieceRate !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "invitePieceRate",
                    parseFloat(editingInvitePieceRate) || 0,
                  );
                if (editingTransferPieceRate !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "transferPieceRate",
                    parseFloat(editingTransferPieceRate) || 0,
                  );
                if (editingSinglePieceRate !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "singlePieceRate",
                    parseFloat(editingSinglePieceRate) || 0,
                  );
                if (editingBaseSalary !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "baseSalary",
                    parseFloat(editingBaseSalary) || 0,
                  );
                if (editingSocialSecurity !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "socialSecurity",
                    parseFloat(editingSocialSecurity) || 0,
                  );
                if (editingStartWorkMonth !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "startWorkMonth",
                    editingStartWorkMonth,
                  );
                if (editingPrefix !== undefined)
                  await onUpdateRole(employee.id, "prefix", editingPrefix);
                if (editingSalaryDisabled !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "salaryDisabled",
                    editingSalaryDisabled,
                  );
                if (editingPoolExclusion !== undefined)
                  await onUpdateRole(
                    employee.id,
                    "poolExclusion",
                    editingPoolExclusion || null,
                  );
                setEditingRole((previousEditingRole) => {
                  const nextEditingRole = { ...previousEditingRole };
                  delete nextEditingRole[`${employee.id}:normalSalePieceRate`];
                  delete nextEditingRole[`${employee.id}:specialSalePieceRate`];
                  delete nextEditingRole[`${employee.id}:buyPieceRate`];
                  delete nextEditingRole[`${employee.id}:invitePieceRate`];
                  delete nextEditingRole[`${employee.id}:transferPieceRate`];
                  delete nextEditingRole[`${employee.id}:singlePieceRate`];
                  delete nextEditingRole[`${employee.id}:baseSalary`];
                  delete nextEditingRole[`${employee.id}:socialSecurity`];
                  delete nextEditingRole[`${employee.id}:startWorkMonth`];
                  delete nextEditingRole[`${employee.id}:prefix`];
                  delete nextEditingRole[`${employee.id}:name`];
                  delete nextEditingRole[`${employee.id}:salaryDisabled`];
                  delete nextEditingRole[`${employee.id}:poolExclusion`];
                  return nextEditingRole;
                });
                setEditingEmpId(null);
              };
              const cancelAll = (closeModal = false) => {
                setEditingRole((previousEditingRole) => {
                  const nextEditingRole = { ...previousEditingRole };
                  delete nextEditingRole[`${employee.id}:normalSalePieceRate`];
                  delete nextEditingRole[`${employee.id}:specialSalePieceRate`];
                  delete nextEditingRole[`${employee.id}:buyPieceRate`];
                  delete nextEditingRole[`${employee.id}:invitePieceRate`];
                  delete nextEditingRole[`${employee.id}:transferPieceRate`];
                  delete nextEditingRole[`${employee.id}:singlePieceRate`];
                  delete nextEditingRole[`${employee.id}:baseSalary`];
                  delete nextEditingRole[`${employee.id}:socialSecurity`];
                  delete nextEditingRole[`${employee.id}:startWorkMonth`];
                  delete nextEditingRole[`${employee.id}:prefix`];
                  delete nextEditingRole[`${employee.id}:name`];
                  delete nextEditingRole[`${employee.id}:salaryDisabled`];
                  delete nextEditingRole[`${employee.id}:poolExclusion`];
                  return nextEditingRole;
                });
                if (closeModal) setEditingEmpId(null);
              };
              const employeeRole = roles?.find((r) => r.id === employee.roleId);
              return (
                <div
                  key={employee.id}
                  className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(90,30,10,0.06)] border border-bdr overflow-hidden transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => setEditingEmpId(employee.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 cursor-pointer border-0 bg-white text-left font-[inherit] transition-colors duration-200 hover:bg-cream/70"
                  >
                    <AvatarCircle
                      avatar={employee.avatar}
                      avatarType={employee.avatarType}
                      avatarImageUrl={employee.avatarImageUrl}
                      size={40}
                      fontSize={13}
                      border={`2px solid ${COLORS.gold}40`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-txt text-sm truncate">
                        {employee.name}
                      </div>
                      <div className="text-xs text-txt-soft mt-px flex items-center gap-[5px] flex-wrap">
                        <IconBriefcase size={11} strokeWidth={2.4} />
                        {employee.role || "-"}
                        {employee.poolExclusion &&
                          (() => {
                            const m = {
                              sell: (
                                <span className="inline-flex items-center gap-0.5">
                                  <IconDiamond size={10} strokeWidth={2.4} />
                                  ปิดขาย
                                </span>
                              ),
                              buy: (
                                <span className="inline-flex items-center gap-0.5">
                                  <IconShoppingBag
                                    size={10}
                                    strokeWidth={2.4}
                                  />
                                  ปิดซื้อ
                                </span>
                              ),
                              both: (
                                <span className="inline-flex items-center gap-0.5">
                                  <IconLock size={10} strokeWidth={2.4} />
                                  ปิดทั้งคู่
                                </span>
                              ),
                            };
                            return (
                              <span className="px-1.5 py-px rounded-md bg-red-lt text-red font-bold text-xs">
                                {m[employee.poolExclusion]}
                              </span>
                            );
                          })()}
                        {employee.salaryDisabled && (
                          <span className="px-1.5 py-px rounded-md bg-red-lt text-red font-bold text-xs inline-flex items-center gap-0.5">
                            <IconLock size={10} strokeWidth={2.4} />
                            ปิดเงินเดือน
                          </span>
                        )}
                        {employee.lineUserId && (
                          <span className="px-1.5 py-px rounded-md bg-[#06C75520] text-[#06A04E] font-bold text-xs inline-flex items-center gap-0.5">
                            <IconMessageCircle size={10} strokeWidth={2.4} />
                            LINE
                          </span>
                        )}
                      </div>
                    </div>
                    {dirty && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-[#D9770630] text-amber">
                        มีการแก้ไข
                      </span>
                    )}
                    <IconSettings
                      size={16}
                      color={COLORS.textSoft}
                      strokeWidth={2.2}
                      className="shrink-0"
                    />
                  </button>

                  {editingEmpId === employee.id && (
                    <BaseModal
                      onClose={() => setEditingEmpId(null)}
                      maxWidthClass="max-w-[760px]"
                    >
                      <div className="sticky top-0 z-10 bg-cream px-5 py-4 border-b border-bdr flex items-center gap-3">
                        <AvatarCircle
                          avatar={employee.avatar}
                          avatarType={employee.avatarType}
                          avatarImageUrl={employee.avatarImageUrl}
                          size={46}
                          fontSize={15}
                          border={`2px solid ${COLORS.gold}40`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-lg text-txt truncate">
                            {employee.name}
                          </div>
                          <div className="text-sm text-txt-soft mt-0.5 truncate inline-flex items-center gap-1.5">
                            <IconBriefcase size={13} strokeWidth={2.4} />
                            {employee.role || "ยังไม่กำหนดตำแหน่ง"}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="ปิดหน้าต่างแก้ไขพนักงาน"
                          onClick={() => setEditingEmpId(null)}
                          className="w-9 h-9 rounded-[10px] border border-bdr bg-white text-txt-mid cursor-pointer flex items-center justify-center"
                        >
                          <IconX size={18} strokeWidth={2.3} />
                        </button>
                      </div>
                      <div className="px-4 py-3.5">
                        {/* Name + prefix — editable */}
                        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
                            <IconPencil
                              size={12}
                              strokeWidth={2.4}
                              className="inline mr-1 -mt-px"
                            />
                            ชื่อพนักงาน (คำนำหน้า + ชื่อ)
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={
                                editingPrefix !== undefined
                                  ? editingPrefix
                                  : employee.prefix || "นางสาว"
                              }
                              onChange={(e) =>
                                setEditingRole((previousEditingRole) => ({
                                  ...previousEditingRole,
                                  [`${employee.id}:prefix`]: e.target.value,
                                }))
                              }
                              className={`shrink-0 w-[110px] py-[9px] px-2 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${editingPrefix !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                            >
                              <option value="นางสาว">นางสาว</option>
                              <option value="นาง">นาง</option>
                              <option value="นาย">นาย</option>
                            </select>
                            <input
                              type="text"
                              value={
                                editingName !== undefined
                                  ? editingName
                                  : employee.name
                              }
                              onChange={(e) =>
                                setEditingRole((previousEditingRole) => ({
                                  ...previousEditingRole,
                                  [`${employee.id}:name`]: e.target.value,
                                }))
                              }
                              className={`flex-1 min-w-0 py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${editingName !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                            />
                          </div>
                          <div className="text-xs text-txt-soft mt-[3px]">
                            คำนำหน้าใช้ในหนังสือรับรองเงินเดือน
                          </div>
                        </div>
                        {/* Role — read-only (แก้จากแท็บ "ตำแหน่ง") */}
                        <div className="mb-2.5 px-3 py-2.5 bg-cream rounded-[10px] border border-dashed border-bdr">
                          <div className="text-xs text-txt-soft font-semibold mb-[5px] flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1">
                              <IconUser size={12} strokeWidth={2.4} />
                              ตำแหน่ง
                            </span>
                            <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
                              แก้ในแท็บ "ตำแหน่ง"
                            </span>
                          </div>
                          <div
                            className={`text-sm font-bold ${employee.role && employee.role !== "-" ? "text-txt" : "text-txt-soft italic"}`}
                          >
                            {employee.role && employee.role !== "-"
                              ? employee.role
                              : "ยังไม่กำหนดตำแหน่ง"}
                          </div>
                        </div>
                        {/* Bank info — read-only (พนักงานเป็นคนกรอกเอง) */}
                        <div className="mb-3 px-3 py-2.5 bg-cream rounded-[10px] border border-dashed border-bdr">
                          <div className="text-xs text-txt-soft font-semibold mb-[5px] flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1">
                              <IconBuildingBank size={12} strokeWidth={2.4} />
                              บัญชีรับเงินเดือน
                            </span>
                            <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
                              พนักงานกรอกเอง
                            </span>
                          </div>
                          {employee.bank || employee.bankAccountNumber ? (
                            <>
                              <div className="text-sm font-bold text-txt mb-px flex items-center gap-1.5">
                                <BankLogo bank={employee.bank} size={18} />
                                {employee.bank || "-"}
                              </div>
                              <div className="text-sm text-txt-mid tracking-wider">
                                {employee.bankAccountNumber || "-"}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-txt-soft italic">
                              ยังไม่มีข้อมูลบัญชี
                            </div>
                          )}
                        </div>

                        {/* LINE User ID — read-only, copy only */}
                        <div className="mb-3">
                          <label className="text-xs text-txt-soft font-semibold mb-1 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1">
                              <IconMessageCircle
                                size={12}
                                strokeWidth={2.4}
                                className="inline mr-1 -mt-px"
                              />
                              LINE User ID
                              {employee.lineUserId ? (
                                <span className="text-xs px-1.5 py-px rounded-lg bg-[#06C75520] text-[#06A04E] font-bold">
                                  เชื่อมแล้ว
                                </span>
                              ) : (
                                <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold">
                                  ยังไม่เชื่อม
                                </span>
                              )}
                            </span>
                            <span className="text-xs px-1.5 py-px rounded-lg bg-bdr text-txt-soft font-bold ml-auto">
                              อ่านอย่างเดียว
                            </span>
                          </label>
                          {employee.lineUserId ? (
                            <button
                              onClick={() =>
                                copyLineId(employee.lineUserId, employee.id)
                              }
                              className={`w-full px-3 py-[9px] rounded-[9px] bg-cream cursor-pointer font-[inherit] flex items-center gap-2 transition-all duration-200 border ${copiedLineId === employee.id ? "border-green" : "border-bdr"}`}
                            >
                              <span className="flex-1 text-left text-sm text-txt font-[Prompt,monospace] tracking-[0.02em] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                                {employee.lineUserId}
                              </span>
                              <span
                                className={`flex items-center gap-1 px-[9px] py-1 rounded-[7px] text-xs font-bold whitespace-nowrap transition-all duration-200 ${copiedLineId === employee.id ? "bg-green-lt text-green" : "bg-gold-pale text-maroon"}`}
                              >
                                {copiedLineId === employee.id ? (
                                  <>
                                    <IconCheck size={12} strokeWidth={3} />
                                    คัดลอกแล้ว
                                  </>
                                ) : (
                                  <>
                                    <IconCopy size={12} strokeWidth={2.2} />
                                    คัดลอก
                                  </>
                                )}
                              </span>
                            </button>
                          ) : (
                            <div className="px-3 py-2.5 rounded-[9px] border border-dashed border-bdr bg-cream text-sm text-txt-soft italic text-center">
                              — ยังไม่ได้เชื่อมต่อ LINE —
                            </div>
                          )}
                          <div className="text-xs text-txt-soft mt-[3px] leading-normal">
                            <IconLightbulb
                              size={12}
                              strokeWidth={2.4}
                              className="inline mr-1 -mt-px"
                            />
                            ID จะถูกเก็บอัตโนมัติเมื่อพนักงานเข้าสู่ระบบผ่าน LINE
                          </div>
                        </div>

                        {/* Base Salary */}
                        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
                            <IconBriefcase
                              size={12}
                              strokeWidth={2.4}
                              className="inline mr-1 -mt-px"
                            />
                            เงินเดือนพื้นฐาน
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold pointer-events-none">
                              ฿
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              value={
                                editingBaseSalary !== undefined
                                  ? editingBaseSalary
                                  : employee.baseSalary || ""
                              }
                              onChange={(e) =>
                                setEditingRole((previousEditingRole) => ({
                                  ...previousEditingRole,
                                  [`${employee.id}:baseSalary`]: e.target.value,
                                }))
                              }
                              className={`w-full py-[9px] pr-3 pl-[30px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt text-right border-[1.5px] ${editingBaseSalary !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                            />
                          </div>
                          <div className="text-xs text-txt-soft mt-[3px]">
                            หน่วย: บาท/เดือน
                          </div>
                        </div>

                        {/* Social Security */}
                        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
                            <IconBuildingBank
                              size={12}
                              strokeWidth={2.4}
                              className="inline mr-1 -mt-px"
                            />
                            หักประกันสังคม
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-soft text-sm font-semibold pointer-events-none">
                              ฿
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              value={
                                editingSocialSecurity !== undefined
                                  ? editingSocialSecurity
                                  : employee.socialSecurity || ""
                              }
                              onChange={(e) =>
                                setEditingRole((previousEditingRole) => ({
                                  ...previousEditingRole,
                                  [`${employee.id}:socialSecurity`]:
                                    e.target.value,
                                }))
                              }
                              className={`w-full py-[9px] pr-3 pl-[30px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt text-right border-[1.5px] ${editingSocialSecurity !== undefined ? "border-gold bg-white" : "border-bdr bg-cream"}`}
                            />
                          </div>
                          <div className="text-xs text-txt-soft mt-[3px]">
                            หน่วย: บาท/เดือน (หักทุกเดือนอัตโนมัติ)
                          </div>
                        </div>

                        {/* Start work month — ใช้ในหนังสือรับรองเงินเดือน */}
                        <div className="mb-2.5 p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                          <label className="text-xs text-maroon font-bold mb-1.5 flex items-center gap-1.5">
                            <IconCalendar size={12} strokeWidth={2.4} />
                            วันที่เริ่มงาน
                          </label>
                          {(() => {
                            const curYM =
                              editingStartWorkMonth !== undefined
                                ? editingStartWorkMonth
                                : employee.startWorkMonth || "";
                            const [curYear, curMonth] = curYM.includes("-")
                              ? curYM.split("-")
                              : ["", ""];
                            const thaiMonths = [
                              "มกราคม",
                              "กุมภาพันธ์",
                              "มีนาคม",
                              "เมษายน",
                              "พฤษภาคม",
                              "มิถุนายน",
                              "กรกฎาคม",
                              "สิงหาคม",
                              "กันยายน",
                              "ตุลาคม",
                              "พฤศจิกายน",
                              "ธันวาคม",
                            ];
                            const nowYear = new Date().getFullYear();
                            const years = Array.from(
                              { length: 40 },
                              (_, i) => nowYear - i,
                            );
                            const setYM = (y: string, m: string) =>
                              setEditingRole((previousEditingRole) => ({
                                ...previousEditingRole,
                                [`${employee.id}:startWorkMonth`]:
                                  y && m ? `${y}-${m}` : "",
                              }));
                            const dirtyCls =
                              editingStartWorkMonth !== undefined
                                ? "border-gold bg-white"
                                : "border-bdr bg-cream";
                            return (
                              <div className="flex gap-2">
                                <select
                                  value={curMonth}
                                  onChange={(e) =>
                                    setYM(
                                      curYear || String(nowYear),
                                      e.target.value,
                                    )
                                  }
                                  className={`flex-1 py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${dirtyCls}`}
                                >
                                  <option value="">เดือน</option>
                                  {thaiMonths.map((mn, i) => (
                                    <option
                                      key={mn}
                                      value={String(i + 1).padStart(2, "0")}
                                    >
                                      {mn}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={curYear}
                                  onChange={(e) =>
                                    setYM(e.target.value, curMonth || "01")
                                  }
                                  className={`flex-1 py-[9px] px-3 rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt border-[1.5px] ${dirtyCls}`}
                                >
                                  <option value="">ปี (พ.ศ.)</option>
                                  {years.map((y) => (
                                    <option key={y} value={String(y)}>
                                      {y + 543}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}
                          <div className="text-xs text-txt-soft mt-[3px]">
                            ใช้ในหนังสือรับรองเงินเดือน
                          </div>
                        </div>

                        {/* Disable Salary toggle */}
                        {(() => {
                          const currentSalaryDisabled =
                            editingSalaryDisabled !== undefined
                              ? editingSalaryDisabled
                              : !!employee.salaryDisabled;
                          return (
                            <div
                              className={`px-3 py-2.5 rounded-[10px] mb-2.5 border-[1.5px] ${currentSalaryDisabled ? "bg-red-lt border-[#C0392B50]" : "bg-cream border-bdr"}`}
                            >
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentSalaryDisabled}
                                  onChange={(e) =>
                                    setEditingRole((previousEditingRole) => ({
                                      ...previousEditingRole,
                                      [`${employee.id}:salaryDisabled`]:
                                        e.target.checked,
                                    }))
                                  }
                                  className="w-4 h-4 cursor-pointer accent-red"
                                />
                                <div className="flex-1">
                                  <div
                                    className={`text-sm font-bold ${currentSalaryDisabled ? "text-red" : "text-txt"}`}
                                  >
                                    <IconLock
                                      size={12}
                                      strokeWidth={2.4}
                                      className="inline mr-1 -mt-px"
                                    />
                                    ปิดสิทธิ์ระบบเงินเดือน
                                  </div>
                                  <div className="text-xs text-txt-soft mt-0.5 leading-normal">
                                    ซ่อนแท็บ "เงินเดือน" จากพนักงาน · ใช้ได้แค่ระบบลา
                                  </div>
                                </div>
                              </label>
                            </div>
                          );
                        })()}

                        {/* Commission rates per piece */}
                        {(() => {
                          const employeeRole = roles?.find(
                            (r) => r.id === employee.roleId,
                          );
                          const usesSinglePieceRate =
                            employeeRole && !employeeRole.poolGroup;
                          const editingSinglePieceRate =
                            editingRole[`${employee.id}:singlePieceRate`];
                          if (usesSinglePieceRate) {
                            return (
                              <div className="p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                                <div className="text-sm font-bold text-maroon mb-2">
                                  <IconCircleDollarSign
                                    size={12}
                                    strokeWidth={2.4}
                                    className="inline mr-1 -mt-px"
                                  />
                                  Rate ค่าคอมต่อชิ้น
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                      <IconPackage
                                        size={12}
                                        strokeWidth={2.4}
                                        className="inline mr-1 -mt-px"
                                      />
                                      ค่าคอมต่อชิ้น
                                    </label>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      value={
                                        editingSinglePieceRate !== undefined
                                          ? editingSinglePieceRate
                                          : employee.singlePieceRate || ""
                                      }
                                      onChange={(e) =>
                                        setEditingRole(
                                          (previousEditingRole) => ({
                                            ...previousEditingRole,
                                            [`${employee.id}:singlePieceRate`]:
                                              e.target.value,
                                          }),
                                        )
                                      }
                                      className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingSinglePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                    />
                                  </div>
                                </div>
                                <div className="text-xs text-txt-soft text-center mt-1.5">
                                  หน่วย: ฿/ชิ้น
                                </div>

                                <div className="h-px my-2.5 bg-[#C9973A30]" />
                                <div className="text-xs font-bold text-maroon mb-2">
                                  <IconTicket
                                    size={12}
                                    strokeWidth={2.4}
                                    className="inline mr-1 -mt-px"
                                  />
                                  Rate บัตรสมาชิกต่อใบ
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                      <IconTicket
                                        size={12}
                                        strokeWidth={2.4}
                                        className="inline mr-1 -mt-px"
                                      />
                                      เชิญชวนสมัคร
                                    </label>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      value={
                                        editingInvitePieceRate !== undefined
                                          ? editingInvitePieceRate
                                          : employee.invitePieceRate || ""
                                      }
                                      onChange={(e) =>
                                        setEditingRole(
                                          (previousEditingRole) => ({
                                            ...previousEditingRole,
                                            [`${employee.id}:invitePieceRate`]:
                                              e.target.value,
                                          }),
                                        )
                                      }
                                      className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingInvitePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                      <IconRefresh
                                        size={12}
                                        strokeWidth={2.4}
                                        className="inline mr-1 -mt-px"
                                      />
                                      ย้ายข้อมูล
                                    </label>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      value={
                                        editingTransferPieceRate !== undefined
                                          ? editingTransferPieceRate
                                          : employee.transferPieceRate || ""
                                      }
                                      onChange={(e) =>
                                        setEditingRole(
                                          (previousEditingRole) => ({
                                            ...previousEditingRole,
                                            [`${employee.id}:transferPieceRate`]:
                                              e.target.value,
                                          }),
                                        )
                                      }
                                      className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingTransferPieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                    />
                                  </div>
                                </div>
                                <div className="text-xs text-txt-soft text-center mt-1.5">
                                  หน่วย: ฿/ใบ
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="p-3 rounded-[10px] bg-[#F5E6C860] border border-[#C9973A30]">
                              {/* Exclude from Pool — 3 levels (only for pool-group roles) */}
                              {employeeRole?.poolGroup &&
                                (() => {
                                  const currentPoolExclusion =
                                    editingPoolExclusion !== undefined
                                      ? editingPoolExclusion
                                      : employee.poolExclusion || "";
                                  const poolExclusionOptions = [
                                    {
                                      id: "",
                                      label: "ไม่ปิด",
                                      Icon: IconCircleCheck,
                                      desc: "ใช้กฎ 80% ปกติทั้ง 2 ฝั่ง",
                                    },
                                    {
                                      id: "sell",
                                      label: "ปิดฝั่งขาย",
                                      Icon: IconDiamond,
                                      desc: "ไม่ได้ Pool ขาย · รับซื้อยังใช้กฎ 80%",
                                    },
                                    {
                                      id: "buy",
                                      label: "ปิดฝั่งรับซื้อ",
                                      Icon: IconShoppingBag,
                                      desc: "ไม่ได้ Pool รับซื้อ · ขายยังใช้กฎ 80%",
                                    },
                                    {
                                      id: "both",
                                      label: "ปิดทั้งคู่",
                                      Icon: IconLock,
                                      desc: "ไม่ได้ Pool ทั้งหมด · ถ้าขาย < 50% ไม่ได้เงินเดือนพื้นฐาน",
                                    },
                                  ];
                                  return (
                                    <div
                                      className={`px-3 py-2.5 rounded-[9px] mb-2.5 border-[1.5px] ${currentPoolExclusion ? "bg-[#FDECEA80] border-[#C0392B50]" : "bg-cream border-bdr"}`}
                                    >
                                      <div
                                        className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${currentPoolExclusion ? "text-red" : "text-txt"}`}
                                      >
                                        <IconBan
                                          size={14}
                                          strokeWidth={2.4}
                                          className="inline mr-1 -mt-px"
                                        />
                                        ปิดสิทธิ์ Pool ค่าคอม
                                      </div>
                                      <div className="flex flex-col gap-[5px]">
                                        {poolExclusionOptions.map(
                                          (poolExclusionOption) => {
                                            const active =
                                              currentPoolExclusion ===
                                              poolExclusionOption.id;
                                            return (
                                              <label
                                                key={poolExclusionOption.id}
                                                className={`flex items-start gap-2 px-2.5 py-[7px] rounded-[7px] cursor-pointer transition-all duration-150 border ${active ? (poolExclusionOption.id ? "bg-[#C0392B15] border-[#C0392B40]" : "bg-green-lt border-[#1A6B3A30]") : "bg-transparent border-transparent"}`}
                                              >
                                                <input
                                                  type="radio"
                                                  name={`poolExclusion_${employee.id}`}
                                                  value={poolExclusionOption.id}
                                                  checked={active}
                                                  onChange={() =>
                                                    setEditingRole(
                                                      (
                                                        previousEditingRole,
                                                      ) => ({
                                                        ...previousEditingRole,
                                                        [`${employee.id}:poolExclusion`]:
                                                          poolExclusionOption.id,
                                                      }),
                                                    )
                                                  }
                                                  className={`mt-0.5 cursor-pointer ${poolExclusionOption.id ? "accent-red" : "accent-green"}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <div
                                                    className={`text-sm font-semibold flex items-center gap-1.5 ${active ? (poolExclusionOption.id ? "text-red" : "text-green") : "text-txt"}`}
                                                  >
                                                    <poolExclusionOption.Icon
                                                      size={13}
                                                      strokeWidth={2.4}
                                                    />
                                                    {poolExclusionOption.label}
                                                  </div>
                                                  <div className="text-xs text-txt-soft mt-px leading-normal">
                                                    {poolExclusionOption.desc}
                                                  </div>
                                                </div>
                                              </label>
                                            );
                                          },
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              <div className="text-sm font-bold text-maroon mb-2">
                                <IconCircleDollarSign
                                  size={12}
                                  strokeWidth={2.4}
                                  className="inline mr-1 -mt-px"
                                />
                                Rate ค่าคอมต่อชิ้น
                              </div>
                              <div className="flex gap-2 mb-2">
                                <div className="flex-1">
                                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                    <IconDiamond
                                      size={12}
                                      strokeWidth={2.4}
                                      className="inline mr-1 -mt-px"
                                    />
                                    ขาย-ทั่วไป
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      editingNormalSalePieceRate !== undefined
                                        ? editingNormalSalePieceRate
                                        : employee.normalSalePieceRate || ""
                                    }
                                    onChange={(e) =>
                                      setEditingRole((previousEditingRole) => ({
                                        ...previousEditingRole,
                                        [`${employee.id}:normalSalePieceRate`]:
                                          e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingNormalSalePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                    <IconSparkles
                                      size={12}
                                      strokeWidth={2.4}
                                      className="inline mr-1 -mt-px"
                                    />
                                    ขาย-พิเศษ
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      editingSpecialSalePieceRate !== undefined
                                        ? editingSpecialSalePieceRate
                                        : employee.specialSalePieceRate || ""
                                    }
                                    onChange={(e) =>
                                      setEditingRole((previousEditingRole) => ({
                                        ...previousEditingRole,
                                        [`${employee.id}:specialSalePieceRate`]:
                                          e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingSpecialSalePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                    <IconShoppingBag
                                      size={12}
                                      strokeWidth={2.4}
                                      className="inline mr-1 -mt-px"
                                    />
                                    รับซื้อ
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      editingBuyPieceRate !== undefined
                                        ? editingBuyPieceRate
                                        : employee.buyPieceRate || ""
                                    }
                                    onChange={(e) =>
                                      setEditingRole((previousEditingRole) => ({
                                        ...previousEditingRole,
                                        [`${employee.id}:buyPieceRate`]:
                                          e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingBuyPieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                              </div>
                              <div className="text-xs text-txt-soft text-center mb-2.5">
                                หน่วย: ฿/ชิ้น
                              </div>

                              <div className="h-px my-2.5 bg-[#C9973A30]" />
                              <div className="text-xs font-bold text-maroon mb-2">
                                <IconTicket
                                  size={12}
                                  strokeWidth={2.4}
                                  className="inline mr-1 -mt-px"
                                />
                                Rate บัตรสมาชิกต่อใบ
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                    <IconTicket
                                      size={12}
                                      strokeWidth={2.4}
                                      className="inline mr-1 -mt-px"
                                    />
                                    เชิญชวนสมัคร
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      editingInvitePieceRate !== undefined
                                        ? editingInvitePieceRate
                                        : employee.invitePieceRate || ""
                                    }
                                    onChange={(e) =>
                                      setEditingRole((previousEditingRole) => ({
                                        ...previousEditingRole,
                                        [`${employee.id}:invitePieceRate`]:
                                          e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingInvitePieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-xs text-txt-soft font-semibold mb-1 block">
                                    <IconRefresh
                                      size={12}
                                      strokeWidth={2.4}
                                      className="inline mr-1 -mt-px"
                                    />
                                    ย้ายข้อมูล
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={
                                      editingTransferPieceRate !== undefined
                                        ? editingTransferPieceRate
                                        : employee.transferPieceRate || ""
                                    }
                                    onChange={(e) =>
                                      setEditingRole((previousEditingRole) => ({
                                        ...previousEditingRole,
                                        [`${employee.id}:transferPieceRate`]:
                                          e.target.value,
                                      }))
                                    }
                                    className={`w-full px-3 py-[9px] rounded-[9px] text-sm font-bold outline-none font-[inherit] text-txt bg-white text-center border-[1.5px] ${editingTransferPieceRate !== undefined ? "border-gold" : "border-bdr"}`}
                                  />
                                </div>
                              </div>
                              <div className="text-xs text-txt-soft text-center mt-1.5">
                                หน่วย: ฿/ใบ
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="sticky bottom-0 z-10 bg-white px-4 py-3 border-t border-bdr shadow-[0_-8px_20px_rgba(90,30,10,0.06)]">
                        {dirty ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => cancelAll(true)}
                              className="flex-1 py-[11px] rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
                            >
                              ยกเลิกการแก้ไข
                            </button>
                            <button
                              onClick={saveAll}
                              className="flex-2 py-[11px] rounded-[10px] border-none bg-linear-135 from-gold to-gold-lt text-maroon-dk text-sm font-bold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5 shadow-gold-glow"
                            >
                              <IconCheck size={14} strokeWidth={2.5} />
                              บันทึกการเปลี่ยนแปลง
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEmpId(null);
                                setConfirmDeleteEmp({
                                  id: employee.id,
                                  name: employee.name,
                                });
                              }}
                              className="py-[11px] px-4 rounded-[10px] border-[1.5px] border-red/40 bg-white text-red text-sm font-semibold cursor-pointer font-[inherit] flex items-center justify-center gap-1.5"
                            >
                              <IconTrash size={15} strokeWidth={2.2} />
                              ลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEmpId(null)}
                              className="flex-1 py-[11px] rounded-[10px] border-[1.5px] border-bdr bg-white text-txt-mid text-sm font-semibold cursor-pointer font-[inherit]"
                            >
                              ปิด
                            </button>
                          </div>
                        )}
                      </div>
                    </BaseModal>
                  )}
                </div>
              );
            })}
          </div>
          {confirmDeleteEmp && (
            <BaseModal
              onClose={() => setConfirmDeleteEmp(null)}
              zIndexClass="z-1000"
              maxWidthClass="max-w-[360px]"
              overlayClassName="px-6 bg-[rgba(45,26,14,0.55)] backdrop-blur-xs"
              contentClassName="rounded-[20px] px-6 py-7"
            >
              <div className="w-14 h-14 rounded-full bg-red-lt flex items-center justify-center mx-auto mb-4">
                <IconTrash
                  size={26}
                  color="var(--color-red)"
                  strokeWidth={2.5}
                />
              </div>
              <div className="font-bold text-lg text-txt text-center mb-2">
                ลบพนักงานคนนี้?
              </div>
              <div className="text-sm text-txt-mid text-center mb-5 leading-[1.8]">
                <b>{confirmDeleteEmp.name}</b>
                <br />
                <span className="text-sm text-red">การลบจะไม่สามารถกู้คืนได้</span>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setConfirmDeleteEmp(null)}
                  className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit]"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    onDeleteEmployee(confirmDeleteEmp.id);
                    setConfirmDeleteEmp(null);
                  }}
                  className="flex-1 p-3.5 rounded-xl border-none bg-red text-white text-base font-bold cursor-pointer font-[inherit] shadow-[0_4px_12px_rgba(192,57,43,0.31)]"
                >
                  ลบพนักงาน
                </button>
              </div>
            </BaseModal>
          )}
        </div>
      )}
    </div>
  );
}
