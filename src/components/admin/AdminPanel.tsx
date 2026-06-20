import { useEffect, useState } from "react";
import { COLORS } from "../../constants";
import { todayYmd } from "../../utils/dateUtils";
import TeamCalendar from "../home/TeamCalendar";
import KnowledgeView from "../knowledge/KnowledgeView";
import {
  ADMIN_NAV_GROUPS,
  type AdminNavGroup,
  type AdminSectionId,
  getAdminGroupForSection,
} from "../layout/adminNavConfig";
import SalaryAdminEdit from "../salary/SalaryAdminEdit";
import AdminAdvancePanel from "./AdminAdvancePanel";
import BackupPanel from "./BackupPanel";
import DutySchedulePanel from "./DutySchedulePanel";
import EmployeeAdminPanel from "./EmployeeAdminPanel";
import EmployeeLoansPanel from "./EmployeeLoansPanel";
import LeaveListPanel from "./LeaveListPanel";
import LeaveSummaryPanel from "./LeaveSummaryPanel";
import LineBotCommandsPanel from "./LineBotCommandsPanel";
import LineBotNotificationsPanel from "./LineBotNotificationsPanel";
import PayrollSummaryPanel from "./PayrollSummaryPanel";
import RolesAdminPanel from "./RolesAdminPanel";
import StoreCalendarPanel from "./StoreCalendarPanel";
import WipeDataPanel from "./WipeDataPanel";

function AdminNavBadge({ count }: { count: number }) {
  return (
    <span className="absolute top-[3px] right-[3px] flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-xs font-bold leading-none text-white shadow-red-glow">
      {count}
    </span>
  );
}

/* ─── Admin Panel (main container) ─────────────────────────────── */
export default function AdminPanel({
  allLeaves,
  employeeDirectory,
  onDelete,
  onAddLeave,
  onUpdateRole,
  onDeleteEmployee,
  onReorderEmployees,
  salaryData,
  setSalaryData,
  onSaveSalary,
  advanceRequests,
  onUpdateAdvance,
  roles,
  onUpsertRole,
  onDeleteRole,
  duties,
  dutyAssignmentsToday,
  onUpsertDuty,
  onDeleteDuty,
  payrollConfirms,
  onSetPayrollConfirm,
  onSyncAutoCarryAdvance,
  poolAdjustments,
  onSetPoolAdjustment,
  employeeLoans,
  storeCalendar,
  onUpdateStoreCalendar,
  onAddLoan,
  onUpdateLoan,
  onDeleteLoan,
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

  // draft แก้ไขพนักงาน + modal ที่เปิดอยู่ — ถือไว้ที่ AdminPanel (parent ร่วม)
  // เพื่อให้รอดเมื่อสลับ section แล้วกลับมา (EmployeeAdminPanel ถูก unmount)
  const [employeeEditingRole, setEmployeeEditingRole] = useState<
    Record<string, any>
  >({});
  const [employeeEditingId, setEmployeeEditingId] = useState<string | null>(
    null,
  );
  // เดือนที่ admin กำลังดู (YYYY-MM) — share ระหว่าง section การลา/เงินเดือน/
  // จ่ายเงิน · admin เลือก ส.ค. ในแท็บค่าคอม → ไปแท็บจ่ายเงิน ยังเป็น ส.ค.
  // default = เดือนปัจจุบัน (todayYmd() กัน stale ข้าม midnight)
  const [adminMonth, setAdminMonth] = useState(() => todayYmd().slice(0, 7));

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
          <div
            className={`min-h-[86px] ${
              activeGroup.items.length > 2
                ? "grid grid-cols-2 gap-1.5"
                : "flex flex-wrap gap-1.5"
            }`}
          >
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
                  className={`relative min-w-0 flex-1 px-2.5 py-[9px] rounded-[9px] border cursor-pointer font-[inherit] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap ${active ? "bg-gold-pale text-maroon border-[#C9973A80] shadow-[0_1px_5px_rgba(201,151,58,0.25)]" : "bg-transparent text-txt-soft border-transparent hover:bg-white/70"}`}
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

      {/* Section content · keyed by section → fadeIn re-triggers on swap */}
      <div key={section} className="animate-[fadeIn_0.18s_ease-out]">

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

      {/* ── DUTY SCHEDULE section ── */}
      {section === "duty-schedule" && (
        <DutySchedulePanel
          duties={duties || []}
          dutyAssignmentsToday={dutyAssignmentsToday}
          roles={roles || []}
          employeeDirectory={employeeDirectory}
          onUpsertDuty={onUpsertDuty}
          onDeleteDuty={onDeleteDuty}
          showToast={showToast}
        />
      )}

      {/* ── CALENDAR VIEW section (ปฏิทินรวม — ลาทุกคน + วันเปิด-ปิดร้าน) ── */}
      {section === "calendar-view" && (
        <TeamCalendar
          leaveEntries={allLeaves}
          employeeDirectory={employeeDirectory}
          storeCalendar={storeCalendar}
        />
      )}

      {/* ── KNOWLEDGE section (ความรู้ต่างๆ) ── */}
      {section === "knowledge" && (
        <KnowledgeView isAdmin showToast={showToast} />
      )}

      {/* ── STORE CALENDAR section (วันเปิด-ปิดร้าน) ── */}
      {section === "store-calendar" && (
        <StoreCalendarPanel
          storeCalendar={storeCalendar}
          onUpdate={onUpdateStoreCalendar}
          allLeaves={allLeaves}
          employeeDirectory={employeeDirectory}
          onDeleteLeave={onDelete}
          showToast={showToast}
        />
      )}

      {/* ── LINE BOT > NOTIFICATIONS section ── */}
      {section === "linebot-notifications" && (
        <LineBotNotificationsPanel showToast={showToast} />
      )}

      {/* ── LINE BOT > COMMANDS section ── */}
      {section === "linebot-commands" && <LineBotCommandsPanel />}

      {section === "backup" && <BackupPanel showToast={showToast} />}

      {section === "wipe-data" && (
        <WipeDataPanel
          employeeDirectory={employeeDirectory}
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
          onSyncAutoCarryAdvance={onSyncAutoCarryAdvance}
          poolAdjustments={poolAdjustments}
          employeeLoans={employeeLoans}
          storeCalendar={storeCalendar}
          onSaveSalary={onSaveSalary}
          selectedMonth={adminMonth}
          onSelectMonth={setAdminMonth}
          showToast={showToast}
        />
      )}

      {/* ── ADVANCE section ── */}
      {section === "advance" && (
        <AdminAdvancePanel
          advanceRequests={advanceRequests || []}
          employeeDirectory={employeeDirectory}
          onUpdate={onUpdateAdvance}
          showToast={showToast}
        />
      )}

      {/* ── LOANS section (เงินกู้ผ่อนคืน) ── */}
      {section === "loans" && (
        <EmployeeLoansPanel
          employeeLoans={employeeLoans || []}
          employeeDirectory={employeeDirectory}
          onAddLoan={onAddLoan}
          onUpdateLoan={onUpdateLoan}
          onDeleteLoan={onDeleteLoan}
          showToast={showToast}
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
          payrollConfirms={payrollConfirms}
          poolAdjustments={poolAdjustments}
          onSetPoolAdjustment={onSetPoolAdjustment}
          employeeLoans={employeeLoans}
          storeCalendar={storeCalendar}
          onReorderEmployees={onReorderEmployees}
          setUnsavedDirty={setUnsavedDirty}
          selectedMonth={adminMonth}
          onSelectMonth={setAdminMonth}
          showToast={showToast}
        />
      )}

      {/* ── SUMMARY section ── */}
      {section === "summary" && (
        <LeaveSummaryPanel
          allLeaves={allLeaves}
          employeeDirectory={employeeDirectory}
          storeCalendar={storeCalendar}
          selectedMonth={adminMonth}
          onSelectMonth={setAdminMonth}
        />
      )}

      {/* ── LEAVES section ── */}
      {section === "leaves" && (
        <LeaveListPanel
          allLeaves={allLeaves}
          employeeDirectory={employeeDirectory}
          payrollConfirms={payrollConfirms}
          storeCalendar={storeCalendar}
          onDelete={onDelete}
          onAddLeave={onAddLeave}
          selectedMonth={adminMonth}
          onSelectMonth={setAdminMonth}
          showToast={showToast}
        />
      )}

      {/* ── EMPLOYEE (พนักงาน) section ── */}
      {section === "roles" && (
        <EmployeeAdminPanel
          employeeDirectory={employeeDirectory}
          roles={roles}
          onUpdateRole={onUpdateRole}
          onDeleteEmployee={onDeleteEmployee}
          editingRole={employeeEditingRole}
          setEditingRole={setEmployeeEditingRole}
          editingEmpId={employeeEditingId}
          setEditingEmpId={setEmployeeEditingId}
        />
      )}
      </div>
    </div>
  );
}
