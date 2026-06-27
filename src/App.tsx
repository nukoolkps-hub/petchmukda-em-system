/* ─── App — Orchestrator ────────────────────────────────────────
   All business logic lives in hooks; all UI in focused components.
   This file wires everything together.                            */

import {
  AlertTriangle as IconAlertTriangle,
  Check as IconCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import AdminPanel from "./components/admin/AdminPanel";
import EmployeeViewPreview from "./components/admin/EmployeeViewPreview";
import HomeTab from "./components/home/HomeTab";
import RequestTab from "./components/home/RequestTab";
import SuccessScreen from "./components/home/SuccessScreen";
import KnowledgeView from "./components/knowledge/KnowledgeView";
import type { AdminSectionId } from "./components/layout/adminNavConfig";
import BottomNav from "./components/layout/BottomNav";
import DesktopHeader from "./components/layout/DesktopHeader";
import MobileHeader from "./components/layout/MobileHeader";
import { getNavItems } from "./components/layout/navConfig";
import Sidebar from "./components/layout/Sidebar";
import AdvanceRequestModal from "./components/modals/AdvanceRequestModal";
import ManualModal from "./components/modals/ManualModal";
import ProfileSetupModal from "./components/modals/ProfileSetupModal";
import SalaryView from "./components/salary/SalaryView";
import BaseModal from "./components/shared/BaseModal";
import BootLoadingScreen from "./components/shared/BootLoadingScreen";
import Diamond from "./components/shared/Diamond";
import { COLORS } from "./constants";
import { useAuth } from "./contexts/AuthContext";
import useAppData from "./data/useAppData";
import useLeaveForm from "./hooks/useLeaveForm";
import useLineNotifications from "./hooks/useLineNotifications";
import useProfile from "./hooks/useProfile";

/* Loading Screen ใช้ตัวเดียวกับ AuthGate — `BootLoadingScreen` */

function UnlinkedEmployeeScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-cream font-sans">
      <div className="w-full max-w-[420px] px-5 py-6 bg-white rounded-[18px] border border-gold/25 text-center shadow-[0_8px_24px_rgba(90,30,10,0.10)]">
        <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-gold-pale flex items-center justify-center">
          <Diamond size={28} color={COLORS.maroon} />
        </div>
        <div className="text-base font-bold text-maroon mb-2">
          ยังไม่พบข้อมูลพนักงาน
        </div>
        <div className="text-sm text-txt-mid leading-relaxed">
          บัญชี LINE นี้ยังไม่ได้เชื่อมกับข้อมูลพนักงานใน Firebase
          กรุณาติดต่อผู้ดูแลระบบให้สร้างหรือผูก LINE User ID ก่อนใช้งาน
        </div>
        <button
          onClick={onSignOut}
          className="mt-5 px-5 py-2.5 rounded-[10px] border-none bg-maroon text-white font-bold cursor-pointer font-[inherit] text-sm"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

/* ─── Main App ─────────────────────────────────────────────────── */
export default function LeaveApp() {
  /* ─── Router ───────────────────────────────────────────────── */
  const navigate = useNavigate();
  const location = useLocation();
  const tab = location.pathname.replace("/", "") || "home";

  /* ─── Auth ─────────────────────────────────────────────────── */
  const { user: authUser, signOut: authSignOut } = useAuth();

  /* ─── Admin claim state ────────────────────────────────────── */
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  useEffect(() => {
    let active = true;
    if (!authUser) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    setAdminChecked(false);
    authUser
      .getIdTokenResult()
      .then((result) => {
        if (active) setIsAdmin(result.claims.admin === true);
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      })
      .finally(() => {
        if (active) setAdminChecked(true);
      });
    return () => {
      active = false;
    };
  }, [authUser]);

  /* ─── Data layer (Firebase) ────────────────────────────────── */
  const data = useAppData({ authUid: authUser?.uid || "", isAdmin });
  const {
    allLeaves,
    employeeDirectory,
    salaryData,
    advanceRequests,
    roles,
    payrollConfirms,
    poolAdjustments,
    setPoolAdjustment,
    updateStoreCalendar: updateStoreCalendarAction,
    employeeLoans,
    addEmployeeLoan,
    updateEmployeeLoan,
    deleteEmployeeLoan,
    loading,
    error,
    setSalaryData,
    updateEmployee,
    deleteEmployee,
    reorderEmployees,
    updateSalary,
    addLeave: addLeaveAction,
    deleteLeave: deleteLeaveAction,
    submitAdvance: submitAdvanceAction,
    approveAdvance: approveAdvanceAction,
    rejectAdvance: rejectAdvanceAction,
    upsertRole,
    deleteRole,
    upsertDuty,
    deleteDuty,
    setPayrollConfirm,
    syncAutoCarryAdvance,
  } = data;
  const { duties, dutyAssignmentsToday, storeCalendar } = data;

  /* ─── Profile hook ─────────────────────────────────────────── */
  const {
    profile,
    showEditProfile,
    setShowEditProfile,
    handleProfileSave,
    currentEmployee,
    employeeId,
    salaryDisabled,
  } = useProfile({
    authUser,
    employeeDirectory,
    isAdmin,
    updateEmployee,
    showToast,
  });
  const currentEmployeeId = employeeId || "";

  /* ─── "ดูมุมมองพนักงาน" (admin preview) ─────────────────────────
     admin เลือกพนักงาน → render หน้าตาแบบที่พนักงานคนนั้นเห็น (read-only)
     · ไม่แตะ rules (admin อ่านข้อมูลทุกคนได้อยู่แล้ว) · view* vars override
     เฉพาะตอน render — data layer ยังโหลดแบบ admin (ทุกคน) ตามเดิม */
  const [previewEmpId, setPreviewEmpId] = useState<string | null>(null);
  const previewing = isAdmin && !!previewEmpId;
  const previewEmployee = previewing
    ? (employeeDirectory.find((e) => e.id === previewEmpId) ?? null)
    : null;
  // ถ้าพนักงานที่กำลัง preview ถูกลบ → ออกจากโหมด
  useEffect(() => {
    if (previewEmpId && !employeeDirectory.some((e) => e.id === previewEmpId))
      setPreviewEmpId(null);
  }, [previewEmpId, employeeDirectory]);

  const viewIsAdmin = isAdmin && !previewing;
  const viewEmployee = previewing ? previewEmployee : currentEmployee;
  const viewEmployeeId = previewing ? (previewEmpId ?? "") : currentEmployeeId;
  const viewProfile =
    previewing && previewEmployee
      ? {
          id: previewEmployee.id,
          name: previewEmployee.name,
          avatar: previewEmployee.avatar || previewEmployee.name.slice(0, 2),
          avatarType: previewEmployee.avatarType || "text",
          avatarImageUrl: previewEmployee.avatarImageUrl ?? null,
          role: previewEmployee.role || "-",
          bank: previewEmployee.bank || "",
          bankAccountNumber: previewEmployee.bankAccountNumber || "",
        }
      : profile;
  const viewSalaryDisabled = previewing
    ? !!previewEmployee?.salaryDisabled
    : salaryDisabled;
  // กันเผลอบันทึก/ส่งระหว่าง preview (โหมดดูอย่างเดียว)
  function blockInPreview(): boolean {
    if (previewing) {
      showToast("อยู่ในโหมดดูมุมมองพนักงาน — บันทึก/ส่งไม่ได้");
      return true;
    }
    return false;
  }

  const myAdvanceRequests = viewEmployeeId
    ? advanceRequests.filter((r) => r.employeeId === viewEmployeeId)
    : [];

  /* ─── Bank account required — บังคับให้ตั้งค่าก่อนใช้งาน ───── */
  const needsBankSetup = !isAdmin && !!profile && !profile.bankAccountNumber;

  useEffect(() => {
    if (needsBankSetup) setShowEditProfile(true);
  }, [needsBankSetup, setShowEditProfile]);

  /* ─── Toast ────────────────────────────────────────────────── */
  const [toastMsg, setToastMsg] = useState("");
  const [toastClosing, setToastClosing] = useState(false);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastClosing(false);
    // 2600ms แสดง + 200ms exit fade → รวม 2800ms (เท่าเดิม)
    setTimeout(() => setToastClosing(true), 2600);
    setTimeout(() => {
      setToastMsg("");
      setToastClosing(false);
    }, 2800);
  }

  /* ─── Leave form hook ──────────────────────────────────────── */
  const leaveForm = useLeaveForm({
    profileName: viewProfile?.name || null,
    allLeaves,
    employeeDirectory,
    storeCalendar,
    addLeave: addLeaveAction,
    deleteLeave: deleteLeaveAction,
    authUid: viewEmployeeId,
    showToast,
  });

  /* ─── LINE notifications hook ──────────────────────────────── */
  const { submitAdvanceRequest, adminUpdateAdvance } = useLineNotifications({
    profileName: profile?.name || "-",
    currentEmployee: currentEmployee,
    employeeDirectory,
    advanceRequests,
    submitAdvanceAction,
    approveAdvanceAction: approveAdvanceAction as (
      id: string | number,
      slipImageUrl?: string | null,
    ) => Promise<void>,
    rejectAdvanceAction,
    showToast,
  });

  /* ─── Admin section state (lifted up so the Sidebar can drive it on desktop) */
  const [adminSection, setAdminSection] =
    useState<AdminSectionId>("calendar-view");
  const [adminUnsavedDirty, setAdminUnsavedDirty] = useState(false);
  // กล่องเตือนในแอป (แทน window.confirm ที่เพี้ยนใน mobile webview)
  const [pendingSection, setPendingSection] = useState<AdminSectionId | null>(
    null,
  );
  function tryChangeAdminSection(next: AdminSectionId) {
    if (next === adminSection) return;
    if (adminUnsavedDirty) {
      setPendingSection(next);
      return;
    }
    setAdminSection(next);
  }

  /* ─── Modal state ──────────────────────────────────────────── */
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showManual, setShowManual] = useState(false);

  /* ─── Role update handler (admin) ──────────────────────────── */
  async function handleUpdateRole(
    employeeId: string,
    field: string,
    value: any,
  ) {
    try {
      await updateEmployee(employeeId, { [field]: value });
      showToast("บันทึกข้อมูลแล้ว");
    } catch (err) {
      console.error("[Admin] update employee failed:", err);
      showToast("บันทึกข้อมูลไม่สำเร็จ");
    }
  }

  /* ─── Delete employee handler (admin) ──────────────────────── */
  async function handleDeleteEmployee(employeeId: string) {
    try {
      await deleteEmployee(employeeId);
      showToast("ลบพนักงานแล้ว");
    } catch (err) {
      console.error("[Admin] delete employee failed:", err);
      showToast("ลบพนักงานไม่สำเร็จ");
    }
  }

  /* ─── Advance request wrapper ──────────────────────────────── */
  async function handleSubmitAdvance({
    amount,
    reason,
    month,
  }: {
    amount: number;
    reason: string;
    month: string;
  }) {
    try {
      await submitAdvanceRequest({ amount, reason, month });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "ส่งคำขอไม่สำเร็จ");
      return;
    }
    setShowAdvanceModal(false);
    showToast("ส่งคำขอผ่าน LINE แล้ว — รอ ADMIN โอนเงิน");
  }

  // ถ้าอยู่ใน salary route แต่ถูกปิดสิทธิ์ → redirect ไป home
  useEffect(() => {
    if (!isAdmin && salaryDisabled && tab === "salary")
      navigate("/home", { replace: true });
  }, [isAdmin, salaryDisabled, tab, navigate]);

  /* ─── Nav items ────────────────────────────────────────────── */
  const navItems = getNavItems({
    isAdmin: viewIsAdmin,
    salaryDisabled: viewSalaryDisabled,
  });

  /* ─── Loading & Error states ───────────────────────────────── */
  if (loading || !adminChecked) {
    return <BootLoadingScreen message="เชื่อมต่อ Firebase..." />;
  }
  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-cream font-sans">
        <div className="max-w-[400px] px-5 py-6 bg-white rounded-[18px] border border-red/25 text-center shadow-[0_8px_24px_rgba(192,57,43,0.12)]">
          <div className="flex justify-center mb-2">
            <IconAlertTriangle size={36} strokeWidth={2} className="text-red" />
          </div>
          <div className="text-base font-bold text-red mb-2">
            เชื่อมต่อข้อมูลไม่สำเร็จ
          </div>
          <div className="text-sm text-txt-mid leading-relaxed">
            {error.message || "ไม่ทราบสาเหตุ"}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2.5 rounded-[10px] border-none bg-maroon text-white font-bold cursor-pointer font-[inherit] text-sm"
          >
            โหลดใหม่
          </button>
        </div>
      </div>
    );
  }
  if (!currentEmployee && !isAdmin) {
    return <UnlinkedEmployeeScreen onSignOut={authSignOut} />;
  }

  /* ─── Render ───────────────────────────────────────────────── */
  return (
    <>
      <div className="leave-app-root">
        {/* ══ SIDEBAR (desktop only) ══ */}
        <Sidebar
          profile={viewProfile}
          isAdmin={viewIsAdmin}
          navItems={navItems}
          holding={false}
          onEditProfile={() => {
            if (!isAdmin && !previewing) setShowEditProfile(true);
          }}
          onSignOut={authSignOut}
          startHold={() => {}}
          endHold={() => {}}
          onRingComplete={() => {}}
          adminSection={viewIsAdmin ? adminSection : undefined}
          onAdminSectionChange={viewIsAdmin ? tryChangeAdminSection : undefined}
          adminPendingAdvanceCount={
            (advanceRequests || []).filter((r) => r.status === "pending").length
          }
        />

        {/* ══ MAIN CONTENT ══ */}
        <div className="leave-main">
          {/* Desktop top bar */}
          <DesktopHeader
            profile={viewProfile}
            isAdmin={viewIsAdmin}
            onShowManual={() => setShowManual(true)}
          />

          {/* Mobile Header */}
          <MobileHeader
            profile={viewProfile}
            isAdmin={viewIsAdmin}
            holding={false}
            onEditProfile={() => {
              if (!isAdmin && !previewing) setShowEditProfile(true);
            }}
            onShowManual={() => setShowManual(true)}
            startHold={() => {}}
            endHold={() => {}}
            onRingComplete={() => {}}
          />

          {/* ── Scrollable Body ── */}
          <div className="leave-content flex-1 px-4 pt-4.5 pb-[90px]">
            <Routes>
              {/* HOME */}
              <Route
                path="/home"
                element={
                  viewIsAdmin ? (
                    <Navigate to="/admin" replace />
                  ) : (
                    <HomeTab
                      profile={viewProfile}
                      allLeaves={allLeaves}
                      employeeDirectory={employeeDirectory}
                      currentEmployee={viewEmployee}
                      roles={roles}
                      duties={duties}
                      dutyAssignmentsToday={dutyAssignmentsToday}
                      storeCalendar={storeCalendar}
                    />
                  )
                }
              />

              {/* REQUEST */}
              <Route
                path="/request"
                element={
                  viewIsAdmin ? (
                    <Navigate to="/admin" replace />
                  ) : leaveForm.submitted ? (
                    <SuccessScreen
                      form={leaveForm.form}
                      days={leaveForm.days}
                      onReset={leaveForm.reset}
                    />
                  ) : (
                    <RequestTab
                      profile={viewProfile}
                      allLeaves={allLeaves}
                      form={leaveForm.form}
                      setForm={leaveForm.setForm}
                      errors={leaveForm.errors}
                      histDetail={leaveForm.histDetail}
                      setHistDetail={leaveForm.setHistDetail}
                      myLeaves={leaveForm.myLeaves}
                      balance={leaveForm.balance}
                      used={leaveForm.used}
                      days={leaveForm.days}
                      remain={leaveForm.remain}
                      overLimit={leaveForm.overLimit}
                      onValidate={leaveForm.validateAndSetErrors}
                      onSubmit={() => {
                        if (blockInPreview()) return;
                        if (viewProfile) leaveForm.submit(viewProfile);
                      }}
                      onResetForm={leaveForm.reset}
                      onDelete={(id: string | number) => {
                        if (blockInPreview()) return;
                        leaveForm.handleDelete(id);
                      }}
                      storeCalendar={storeCalendar}
                    />
                  )
                }
              />

              {/* SALARY (employee view) */}
              <Route
                path="/salary"
                element={
                  viewIsAdmin ? (
                    <Navigate to="/admin" replace />
                  ) : viewSalaryDisabled ? (
                    <Navigate to="/home" replace />
                  ) : (
                    <div className="min-h-full">
                      <SalaryView
                        profile={viewProfile}
                        employeeId={viewEmployeeId}
                        salaryData={salaryData}
                        allLeaves={allLeaves}
                        employeeDirectory={employeeDirectory}
                        advanceRequests={myAdvanceRequests}
                        onOpenAdvance={() => {
                          if (blockInPreview()) return;
                          setShowAdvanceModal(true);
                        }}
                        roles={roles}
                        payrollConfirms={payrollConfirms}
                        poolAdjustments={poolAdjustments}
                        employeeLoans={employeeLoans}
                        storeCalendar={storeCalendar}
                        showToast={showToast}
                      />
                    </div>
                  )
                }
              />

              {/* KNOWLEDGE — ความรู้ต่างๆ (ใช้ร่วม admin + employee) */}
              <Route
                path="/knowledge"
                element={
                  <KnowledgeView isAdmin={viewIsAdmin} showToast={showToast} />
                }
              />

              {/* ADMIN */}
              <Route
                path="/admin"
                element={
                  viewIsAdmin ? (
                    <AdminPanel
                      section={adminSection}
                      onSectionChange={tryChangeAdminSection}
                      unsavedDirty={adminUnsavedDirty}
                      onUnsavedDirtyChange={setAdminUnsavedDirty}
                      allLeaves={allLeaves}
                      employeeDirectory={employeeDirectory}
                      onDelete={leaveForm.handleDelete}
                      onAddLeave={addLeaveAction}
                      onUpdateRole={handleUpdateRole}
                      onDeleteEmployee={handleDeleteEmployee}
                      onReorderEmployees={reorderEmployees}
                      salaryData={salaryData}
                      setSalaryData={setSalaryData}
                      onSaveSalary={updateSalary}
                      advanceRequests={advanceRequests}
                      onUpdateAdvance={adminUpdateAdvance}
                      roles={roles}
                      onUpsertRole={upsertRole}
                      duties={duties}
                      dutyAssignmentsToday={dutyAssignmentsToday}
                      onUpsertDuty={upsertDuty}
                      onDeleteDuty={deleteDuty}
                      onDeleteRole={deleteRole}
                      payrollConfirms={payrollConfirms}
                      poolAdjustments={poolAdjustments}
                      onSetPoolAdjustment={setPoolAdjustment}
                      employeeLoans={employeeLoans}
                      onAddLoan={addEmployeeLoan}
                      onUpdateLoan={updateEmployeeLoan}
                      onDeleteLoan={deleteEmployeeLoan}
                      onSetPayrollConfirm={setPayrollConfirm}
                      onSyncAutoCarryAdvance={syncAutoCarryAdvance}
                      storeCalendar={storeCalendar}
                      onUpdateStoreCalendar={updateStoreCalendarAction}
                      showToast={showToast}
                    />
                  ) : (
                    <Navigate to="/home" replace />
                  )
                }
              />

              {/* Catch-all: redirect to home */}
              <Route
                path="*"
                element={
                  <Navigate to={viewIsAdmin ? "/admin" : "/home"} replace />
                }
              />
            </Routes>
          </div>

          {/* ── Bottom nav (mobile only) ── */}
          <BottomNav navItems={navItems} />

          {/* Modals */}
          {!isAdmin && showEditProfile && profile && (
            <ProfileSetupModal
              initial={profile}
              employeeId={currentEmployeeId}
              lockName
              // บัญชีธนาคารกรอกครั้งแรกได้ครั้งเดียว · เมื่อมีค่าแล้ว
              // ห้ามแก้ (ADMIN แก้ผ่าน EmployeeEditModal ได้)
              lockBank={!!profile?.bank && !!profile?.bankAccountNumber}
              onSave={handleProfileSave}
              // ถ้ายังไม่กรอกบัญชี ห้ามปิดจนกว่าจะกรอก (onClose = undefined)
              onClose={
                needsBankSetup ? undefined : () => setShowEditProfile(false)
              }
            />
          )}

          {showAdvanceModal && (
            <AdvanceRequestModal
              profile={viewProfile}
              employee={viewEmployee}
              employeeId={viewEmployeeId}
              salaryData={salaryData}
              advanceRequests={myAdvanceRequests}
              onSubmit={handleSubmitAdvance}
              onClose={() => setShowAdvanceModal(false)}
            />
          )}

          {showManual && <ManualModal onClose={() => setShowManual(false)} />}

          {/* ปุ่ม/แบนเนอร์ "ดูมุมมองพนักงาน" — เฉพาะ admin จริง */}
          {isAdmin && (
            <EmployeeViewPreview
              employees={employeeDirectory}
              previewEmpId={previewEmpId}
              onSelect={setPreviewEmpId}
            />
          )}

          {pendingSection && (
            <BaseModal
              onClose={() => setPendingSection(null)}
              zIndexClass="z-1000"
              maxWidthClass="max-w-[360px]"
              overlayClassName="px-6 bg-[rgba(45,26,14,0.55)] backdrop-blur-xs"
              contentClassName="rounded-[20px] px-6 py-7"
            >
              <div className="w-14 h-14 rounded-full bg-amber-lt flex items-center justify-center mx-auto mb-4">
                <IconAlertTriangle
                  size={26}
                  className="text-amber"
                  strokeWidth={2.5}
                />
              </div>
              <div className="font-bold text-lg text-txt text-center mb-2">
                ยังไม่ได้บันทึกการเปลี่ยนแปลง
              </div>
              <div className="text-sm text-txt-mid text-center mb-5 leading-[1.8]">
                หากออกจากหน้านี้ ข้อมูลที่แก้ไขจะหายไป
                <br />
                ต้องการออกจากหน้านี้ใช่ไหม?
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setPendingSection(null)}
                  className="flex-1 p-3.5 rounded-xl border-[1.5px] border-bdr bg-white text-txt-mid text-base font-semibold cursor-pointer font-[inherit]"
                >
                  อยู่ต่อ
                </button>
                <button
                  onClick={() => {
                    const next = pendingSection;
                    setPendingSection(null);
                    setAdminUnsavedDirty(false);
                    setAdminSection(next);
                  }}
                  className="flex-1 p-3.5 rounded-xl border-none bg-amber text-white text-base font-bold cursor-pointer font-[inherit] shadow-[0_4px_12px_#D9770640] active:scale-[0.98] transition-transform duration-100"
                >
                  ออกจากหน้านี้
                </button>
              </div>
            </BaseModal>
          )}

          {/* Toast */}
          {toastMsg && (
            // wrapper จัดกลาง · `md:left-[calc(50%+130px)]` ชดเชย sidebar 260px
            // เพื่อให้ toast อยู่กลาง .leave-main ไม่ใช่ viewport center
            // z-1200 = สูงกว่า BaseModal (z-800) และ confirm modals (z-1000)
            // → toast ลอยอยู่บนสุดเสมอ (ไม่หายไปหลัง modal)
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:left-[calc(50%+130px)] z-[1200]">
              <div
                className={`bg-maroon text-white px-5.5 py-3 rounded-[30px] text-sm font-semibold font-[inherit] shadow-[0_6px_20px_rgba(123,28,28,0.37)] whitespace-nowrap inline-flex items-center gap-1.5 ${
                  toastClosing
                    ? "animate-[toastOut_0.2s_ease-in_forwards]"
                    : "animate-[toastIn_0.25s_ease]"
                }`}
              >
                <IconCheck size={14} strokeWidth={2.6} />
                {toastMsg}
              </div>
            </div>
          )}
        </div>
        {/* end leave-main */}
      </div>
      {/* end leave-app-root */}
    </>
  );
}
