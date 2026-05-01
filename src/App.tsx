/* ─── App — Orchestrator ────────────────────────────────────────
   All business logic lives in hooks; all UI in focused components.
   This file wires everything together.                            */

import { useEffect, useRef, useState } from "react";
import AdminPanel from "./components/admin/AdminPanel";
import HomeTab from "./components/home/HomeTab";
import RequestTab from "./components/home/RequestTab";
import SuccessScreen from "./components/home/SuccessScreen";
import BottomNav from "./components/layout/BottomNav";
import DesktopHeader from "./components/layout/DesktopHeader";
import MobileHeader from "./components/layout/MobileHeader";
import { getNavItems, PAGE_TITLES } from "./components/layout/navConfig";
import Sidebar from "./components/layout/Sidebar";
import AdvanceHistoryModal from "./components/modals/AdvanceHistoryModal";
import AdvanceRequestModal from "./components/modals/AdvanceRequestModal";
import ManualModal from "./components/modals/ManualModal";
import PinModal from "./components/modals/PinModal";
import ProfileSetupModal from "./components/modals/ProfileSetupModal";
import SalaryView from "./components/salary/SalaryView";
import Diamond from "./components/shared/Diamond";
import { C } from "./constants";
import { useAuth } from "./contexts/AuthContext";
import useAppData from "./data/useAppData";
import useLeaveForm from "./hooks/useLeaveForm";
import useLineNotifications from "./hooks/useLineNotifications";
import useProfile from "./hooks/useProfile";

/* ─── Loading Screen ───────────────────────────────────────────── */
function LoadingScreen({ message = "กำลังโหลดข้อมูล..." }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-cream font-sans">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-gold-lt flex items-center justify-center shadow-[0_6px_20px_rgba(201,151,58,0.31)] animate-[pulse_1.5s_ease-in-out_infinite]">
        <Diamond size={32} color={C.maroon} />
      </div>
      <div className="mt-4.5 text-sm font-semibold text-maroon">{message}</div>
      <div className="mt-1.5 text-[11px] text-txt-soft">ห้างเพชรทองมุกดา</div>
    </div>
  );
}

/* ─── Main App ─────────────────────────────────────────────────── */
export default function LeaveApp() {
  /* ─── Auth ─────────────────────────────────────────────────── */
  const { user: authUser, signOut: authSignOut } = useAuth();

  /* ─── Data layer (Firebase) ────────────────────────────────── */
  const data = useAppData();
  const {
    allLeaves,
    empDir,
    salaryData,
    advanceRequests,
    roles,
    payrollConfirms,
    loading,
    error,
    setAllLeaves,
    setEmpDir,
    setSalaryData,
    setRoles,
    setPayrollConfirms,
    submitAdvance: submitAdvanceAction,
    approveAdvance: approveAdvanceAction,
    rejectAdvance: rejectAdvanceAction,
  } = data;

  /* ─── Profile hook ─────────────────────────────────────────── */
  const {
    profile,
    showEditProfile,
    setShowEditProfile,
    handleProfileSave,
    salaryDisabled,
  } = useProfile({ authUser, empDir, setEmpDir });

  /* ─── Tab navigation ───────────────────────────────────────── */
  const [tab, setTab] = useState("home");
  const [toastMsg, setToastMsg] = useState("");

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2800);
  }

  /* ─── Leave form hook ──────────────────────────────────────── */
  const leaveForm = useLeaveForm({
    profileName: profile?.name || null,
    allLeaves,
    empDir,
    setAllLeaves,
    showToast,
  });

  /* ─── LINE notifications hook ──────────────────────────────── */
  const { submitAdvanceRequest, adminUpdateAdvance } = useLineNotifications({
    profileName: profile?.name || "-",
    empDir,
    advanceRequests,
    submitAdvanceAction,
    approveAdvanceAction: approveAdvanceAction as (id: string | number, slipImg?: string | null) => Promise<void>,
    rejectAdvanceAction,
  });

  /* ─── Modal state ──────────────────────────────────────────── */
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  /* ─── Admin state ──────────────────────────────────────────── */
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!authUser) {
      setIsAdmin(false);
      return;
    }
    authUser
      .getIdTokenResult()
      .then((result) => {
        if (result.claims.admin) setIsAdmin(true);
      })
      .catch(() => {});
  }, [authUser]);

  /* ─── Long-press to unlock admin ───────────────────────────── */
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  function startHold() {
    if (isAdmin) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      /* onAnimationEnd handles it */
    }, 5500);
  }
  function endHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHolding(false);
  }
  function onRingComplete() {
    setHolding(false);
    setShowPinModal(true);
  }

  /* ─── Tab change ───────────────────────────────────────────── */
  function goTab(id: string) {
    setTab(id);
    leaveForm.setSubmitted(false);
    leaveForm.setHistDetail(null);
  }

  /* ─── Role update handler (admin) ──────────────────────────── */
  function handleUpdateRole(empId: string, field: string, value: any) {
    (setEmpDir as React.Dispatch<React.SetStateAction<any[]>>)((d: any[]) =>
      d.map((e: any) => (e.id === empId ? { ...e, [field]: value } : e)),
    );
    showToast("บันทึกข้อมูลแล้ว");
  }

  /* ─── Advance request wrapper ──────────────────────────────── */
  async function handleSubmitAdvance({ amount, reason, month }: { amount: number; reason: string; month: string }) {
    await submitAdvanceRequest({ amount, reason, month });
    setShowAdvanceModal(false);
    showToast("ส่งคำขอผ่าน LINE แล้ว — รอ Admin โอนเงิน");
  }

  // ถ้าอยู่ใน salary tab แต่ถูกปิดสิทธิ์ → กลับหน้าแรก
  useEffect(() => {
    if (salaryDisabled && tab === "salary") setTab("home");
  }, [salaryDisabled, tab]);

  /* ─── Nav items ────────────────────────────────────────────── */
  const navItems = getNavItems({ isAdmin, salaryDisabled });

  /* ─── Loading & Error states ───────────────────────────────── */
  if (loading) {
    return <LoadingScreen message="เชื่อมต่อ Firebase..." />;
  }
  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-cream font-sans">
        <div className="max-w-[400px] px-5 py-6 bg-white rounded-[18px] border border-red/25 text-center shadow-[0_8px_24px_rgba(192,57,43,0.12)]">
          <div className="text-[32px] mb-2">⚠️</div>
          <div className="text-base font-bold text-red mb-2">
            เชื่อมต่อข้อมูลไม่สำเร็จ
          </div>
          <div className="text-[13px] text-txt-mid leading-relaxed">
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

  /* ─── Render ───────────────────────────────────────────────── */
  return (
    <>
      <div className="leave-app-root">
        {/* ══ SIDEBAR (desktop only) ══ */}
        <Sidebar
          profile={profile}
          tab={tab}
          navItems={navItems}
          holding={holding}
          onTabChange={goTab}
          onEditProfile={() => setShowEditProfile(true)}
          onSignOut={authSignOut}
          startHold={startHold}
          endHold={endHold}
          onRingComplete={onRingComplete}
        />

        {/* ══ MAIN CONTENT ══ */}
        <div className="leave-main">
          {/* Desktop top bar */}
          <DesktopHeader
            tab={tab}
            pageTitle={PAGE_TITLES}
            profile={profile}
            onShowManual={() => setShowManual(true)}
          />

          {/* Mobile Header */}
          <MobileHeader
            tab={tab}
            pageTitle={PAGE_TITLES}
            profile={profile}
            holding={holding}
            onEditProfile={() => setShowEditProfile(true)}
            onShowManual={() => setShowManual(true)}
            startHold={startHold}
            endHold={endHold}
            onRingComplete={onRingComplete}
          />

          {/* ── Scrollable Body ── */}
          <div className="leave-content flex-1 px-4 pt-4.5 pb-[90px]">
            {/* HOME */}
            {tab === "home" && (
              <HomeTab
                profile={profile}
                allLeaves={allLeaves}
                empDir={empDir}
              />
            )}

            {/* REQUEST */}
            {tab === "request" && !leaveForm.submitted && (
              <RequestTab
                profile={profile}
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
                onSubmit={() => profile && leaveForm.submit(profile)}
              />
            )}

            {/* SUCCESS */}
            {tab === "request" && leaveForm.submitted && (
              <SuccessScreen
                form={leaveForm.form}
                days={leaveForm.days}
                onReset={leaveForm.reset}
                onGoTab={goTab}
              />
            )}

            {/* SALARY (employee view) */}
            {tab === "salary" && !salaryDisabled && (
              <div className="min-h-full">
                <SalaryView
                  profile={profile}
                  salaryData={salaryData}
                  allLeaves={allLeaves}
                  empDir={empDir}
                  advanceRequests={advanceRequests.filter(
                    (r) => r.empId === "me",
                  )}
                  onOpenAdvance={() => setShowAdvanceModal(true)}
                  onOpenHistory={() => setShowHistoryModal(true)}
                  roles={roles}
                />
              </div>
            )}

            {/* ADMIN */}
            {tab === "admin" && isAdmin && (
              <AdminPanel
                allLeaves={allLeaves}
                empDir={empDir}
                onDelete={leaveForm.handleDelete}
                onLogout={() => {
                  setIsAdmin(false);
                  goTab("home");
                  showToast("ออกจากโหมด Admin แล้ว");
                }}
                onUpdateRole={handleUpdateRole}
                salaryData={salaryData}
                setSalaryData={setSalaryData}
                advanceRequests={advanceRequests}
                onUpdateAdvance={adminUpdateAdvance}
                roles={roles}
                setRoles={setRoles}
                payrollConfirms={payrollConfirms}
                setPayrollConfirms={setPayrollConfirms}
                showToast={showToast}
              />
            )}
          </div>

          {/* ── Bottom nav (mobile only) ── */}
          <BottomNav
            navItems={navItems}
            tab={tab}
            onTabChange={goTab}
          />

          {/* Modals */}
          {(showEditProfile || !profile) && (
            <ProfileSetupModal
              initial={profile}
              onSave={handleProfileSave}
              onClose={profile ? () => setShowEditProfile(false) : undefined}
            />
          )}
          {showPinModal && (
            <PinModal
              onSuccess={() => {
                setShowPinModal(false);
                setIsAdmin(true);
                setTab("admin");
                showToast("เข้าสู่โหมดผู้ดูแลระบบแล้ว");
              }}
              onClose={() => {
                setShowPinModal(false);
                setHolding(false);
              }}
            />
          )}

          {showAdvanceModal && (
            <AdvanceRequestModal
              profile={profile}
              salaryData={salaryData}
              advanceRequests={advanceRequests.filter((r) => r.empId === "me")}
              onSubmit={handleSubmitAdvance}
              onClose={() => setShowAdvanceModal(false)}
            />
          )}

          {showHistoryModal && (
            <AdvanceHistoryModal
              advanceRequests={advanceRequests.filter((r) => r.empId === "me")}
              onClose={() => setShowHistoryModal(false)}
            />
          )}

          {showManual && <ManualModal onClose={() => setShowManual(false)} />}

          {/* Toast */}
          {toastMsg && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-maroon text-white px-5.5 py-3 rounded-[30px] text-sm font-semibold font-[inherit] shadow-[0_6px_20px_rgba(123,28,28,0.37)] z-[500] animate-[toastIn_0.25s_ease] whitespace-nowrap">
              ✓ {toastMsg}
            </div>
          )}
        </div>
        {/* end leave-main */}
      </div>
      {/* end leave-app-root */}
    </>
  );
}
