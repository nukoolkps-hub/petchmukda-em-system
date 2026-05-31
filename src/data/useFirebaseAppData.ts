/* ─── Firebase Data Hook ─────────────────────────────────────
   Production mode — ใช้ Firestore real-time
   Interface เหมือน useInMemoryAppData แต่:
   - State มาจาก Firestore (real-time sync)
   - Actions เป็น async + เรียก Firestore                          */

import { useMemo } from "react";
import * as advancesAPI from "../firebase/advances";

import * as employeesAPI from "../firebase/employees";
import {
  useAdvancesForScope,
  useEmployeesForScope,
  useLeavesForScope,
  usePayrollConfirmsForScope,
  usePoolSnapshots,
  useRoles,
  useSalariesForScope,
} from "../firebase/hooks/useFirestore";
import * as leavesAPI from "../firebase/leaves";
import * as payrollConfirmsAPI from "../firebase/payrollConfirms";
import * as poolSnapshotsAPI from "../firebase/poolSnapshots";
import * as rolesAPI from "../firebase/roles";
import * as salariesAPI from "../firebase/salaries";
import { countWeekdayLeaves, getOverQuotaDays } from "../utils/leaveUtils";

interface FirebaseAppDataOptions {
  authUid?: string;
  isAdmin?: boolean;
}

export default function useFirebaseAppData({
  authUid = "",
  isAdmin = false,
}: FirebaseAppDataOptions = {}) {
  const employeeResult = useEmployeesForScope({ isAdmin, authUid });
  const currentEmployee =
    authUid && !isAdmin
      ? employeeResult.data.find((e) => e.lineUserId === authUid) || null
      : null;
  const currentEmployeeId = currentEmployee?.id || null;

  const leavesResult = useLeavesForScope({
    isAdmin,
    employeeId: currentEmployeeId,
  });
  const salResult = useSalariesForScope({
    isAdmin,
    employeeId: currentEmployeeId,
  });
  const advResult = useAdvancesForScope({
    isAdmin,
    employeeId: currentEmployeeId,
  });
  const rolesResult = useRoles();
  const pcResult = usePayrollConfirmsForScope({ isAdmin });
  // poolSnapshots: doc per month มี pieces + roleId + poolExclusion + leaveDays
  // ของทุกคน — เป็น public source สำหรับ pool calc ฝั่งพนักงาน (ที่ไม่ได้
  // อ่าน salaries ของเพื่อน). admin ไม่ต้องใช้ก็ได้ — แต่ subscribe ทิ้งไว้
  // ค่า read น้อย (1 doc/เดือน) ไม่กระทบ performance.
  const poolSnapResult = usePoolSnapshots();

  // employee เห็น salaries ของตัวเองคนเดียว — เติม peer-data จาก
  // poolSnapshots ลงไปใน salaryData ก่อนส่งต่อให้ component (SalaryView,
  // computePoolSharesForGroup) ใช้แบบ shape เดิม. admin ส่งผ่านตรงๆ —
  // collectionGroup ดึงทุกคนอยู่แล้ว.
  const salaryData = useMemo(() => {
    if (isAdmin) return salResult.data;
    const merged: Record<string, any> = { ...salResult.data };
    for (const [yearMonth, byEmployee] of Object.entries(poolSnapResult.data)) {
      for (const [peerId, snapshot] of Object.entries(byEmployee)) {
        if (!merged[peerId]) merged[peerId] = {};
        // own salary doc มี field ครบกว่า — อย่าให้ snapshot ทับ
        if (!merged[peerId][yearMonth]) {
          merged[peerId][yearMonth] = snapshot;
        }
      }
    }
    return merged;
  }, [isAdmin, salResult.data, poolSnapResult.data]);

  // Aggregate loading/error states
  const loading =
    employeeResult.loading ||
    leavesResult.loading ||
    salResult.loading ||
    advResult.loading ||
    rolesResult.loading ||
    pcResult.loading ||
    poolSnapResult.loading;
  const error =
    employeeResult.error ||
    leavesResult.error ||
    salResult.error ||
    advResult.error ||
    rolesResult.error ||
    pcResult.error ||
    poolSnapResult.error;

  /* ─── Leaves (real-time → no local setState needed) ────── */
  async function addLeave(leave) {
    return await leavesAPI.addLeave(leave);
  }
  async function deleteLeave(id) {
    await leavesAPI.deleteLeave(id);
  }

  /* ─── Employees ─────────────────────────────────────────── */
  async function updateEmployee(id, fields) {
    await employeesAPI.updateEmployee(id, fields);
  }
  async function upsertEmployee(employee) {
    return await employeesAPI.upsertEmployee(employee.id, employee);
  }
  async function deleteEmployee(id) {
    await employeesAPI.deleteEmployee(id);
  }

  /* ─── Salaries ──────────────────────────────────────────── */
  async function updateSalary(employeeId, yearMonth, fields) {
    // snapshot roleId / poolExclusion / เรท / leave days ลง salary doc ของเดือน
    // นั้น เพื่อให้ (1) พนักงานคำนวณ pool ได้โดยไม่ต้องอ่าน employees/leaves ของ
    // เพื่อน และ (2) ข้อมูลเงินเดือนในอดีต "ล็อก" ไม่ขยับเมื่อเปลี่ยนตำแหน่ง/เรท
    // ในอนาคต
    const employee = employeeResult.data.find((e) => e.id === employeeId);
    if (!employee) {
      // ไม่เจอ employee (ถูกลบ / data ยังโหลดไม่เสร็จ) → เขียนเฉพาะ fields
      // ที่ caller ส่งมา อย่าแตะ snapshot ไม่งั้นจะ stomp totalLeaveDays เป็น 0
      await salariesAPI.updateSalary(employeeId, yearMonth, fields);
      return;
    }
    // join ลาด้วย employeeId (ไม่ใช่ชื่อ) — ทนต่อการเปลี่ยนชื่อ/ชื่อซ้ำ
    const monthLeaves = leavesResult.data.filter(
      (leave) =>
        leave.employeeId === employeeId && leave.start.startsWith(yearMonth),
    );
    const weekdayLeaves = countWeekdayLeaves(monthLeaves);
    const overInfo = getOverQuotaDays(monthLeaves);
    const totalLeaveDays = weekdayLeaves + (overInfo.sundays || 0);

    // กฎ "ล็อกเมื่อยืนยันยอดแล้ว": ถ้าเดือนนี้ถูกยืนยันยอดแล้ว + มี snapshot เรท
    // อยู่แล้ว → ห้าม re-stamp เรท/ตำแหน่ง (เก็บค่าเดิมที่ frozen ไว้) เพื่อกัน
    // การเผลอแก้เดือนเก่าหลังเปลี่ยนตำแหน่งแล้วตัวเลขอดีตเพี้ยน. งวดที่ยังไม่
    // ยืนยัน (เปิดอยู่) ยัง stamp ค่าสดตามปกติ (แก้ข้อมูลพนักงานแล้ว re-save ได้)
    const existingSalary = salResult.data?.[employeeId]?.[yearMonth];
    const isMonthConfirmed = !!pcResult.data?.[yearMonth];
    const hasRateSnapshot =
      existingSalary != null && existingSalary.baseSalary != null;
    const freezeSnapshot = isMonthConfirmed && hasRateSnapshot;

    // ดึง field ที่ระบบจัดการเองออกจาก fields ที่ caller ส่งมา (กันส่งค่าเก่าทับ)
    const {
      roleId: _ignoredRoleId,
      poolExclusion: _ignoredPoolExclusion,
      totalLeaveDays: _ignoredTotalLeaveDays,
      baseSalary: _ignoredBaseSalary,
      singlePieceRate: _ignoredSinglePieceRate,
      normalSalePieceRate: _ignoredNormalRate,
      specialSalePieceRate: _ignoredSpecialRate,
      buyPieceRate: _ignoredBuyRate,
      invitePieceRate: _ignoredInviteRate,
      transferPieceRate: _ignoredTransferRate,
      socialSecurity: _ignoredSocialSecurity,
      ...callerFields
    } = fields || {};

    // snapshot เรท/ตำแหน่งจากข้อมูลพนักงานปัจจุบัน — เขียนเฉพาะตอน "ไม่ freeze"
    const rateSnapshot = freezeSnapshot
      ? {}
      : {
          roleId: employee.roleId ?? null,
          poolExclusion: employee.poolExclusion ?? null,
          baseSalary: employee.baseSalary ?? 0,
          singlePieceRate: employee.singlePieceRate ?? 0,
          normalSalePieceRate: employee.normalSalePieceRate ?? 0,
          specialSalePieceRate: employee.specialSalePieceRate ?? 0,
          buyPieceRate: employee.buyPieceRate ?? 0,
          invitePieceRate: employee.invitePieceRate ?? 0,
          transferPieceRate: employee.transferPieceRate ?? 0,
          socialSecurity: employee.socialSecurity ?? 0,
        };

    await salariesAPI.updateSalary(employeeId, yearMonth, {
      ...callerFields,
      ...rateSnapshot,
      totalLeaveDays,
    });
    // mirror non-sensitive pool fields ลง poolSnapshots/{ym} เพื่อให้พนักงานอ่าน
    // pool ของเพื่อนได้โดยไม่ต้องเปิดสิทธิ์อ่าน salary ทั้งใบ. อ่าน doc สดหลัง
    // write แล้ว mirror "ค่าที่อยู่ใน doc จริง" (frozen หรือสด) — ไม่ใช่ค่า live
    // ของ employee เพื่อให้ poolSnapshots ตรงกับ salary doc ที่ frozen ไว้
    try {
      const saved = await salariesAPI.getSalary(employeeId, yearMonth);
      await poolSnapshotsAPI.upsertPoolSnapshot(yearMonth, employeeId, {
        normalSalePieces: saved?.normalSalePieces ?? 0,
        specialSalePieces: saved?.specialSalePieces ?? 0,
        buyPieces: saved?.buyPieces ?? 0,
        roleId: saved?.roleId ?? employee.roleId ?? null,
        poolExclusion: saved?.poolExclusion ?? employee.poolExclusion ?? null,
        totalLeaveDays: saved?.totalLeaveDays ?? totalLeaveDays,
      });
    } catch (err) {
      // poolSnapshot write fail ไม่ block การ save salary หลัก — แต่ log
      // ไว้ ผลลัพธ์: ฝั่งพนักงานอาจเห็น pool ผิดจน save รอบหน้า
      console.error("[Salaries] poolSnapshot write failed:", err);
    }
  }

  /* ─── Advances ──────────────────────────────────────────── */
  async function submitAdvance(request) {
    return await advancesAPI.submitAdvance(request);
  }
  async function updateAdvance(id, fields) {
    // Firestore: ไม่มี method generic update — ใช้ approve/reject แทน
    if (fields.status === "approved") {
      await advancesAPI.approveAdvance(
        id,
        fields.slipImageUrl || fields.slipImageDataUrl,
      );
    } else if (fields.status === "rejected") {
      await advancesAPI.rejectAdvance(id, fields.rejectionReason);
    }
  }
  async function approveAdvance(id, slipImageUrl = null) {
    await advancesAPI.approveAdvance(id, slipImageUrl);
  }
  async function rejectAdvance(id, reason = "") {
    await advancesAPI.rejectAdvance(id, reason);
  }

  /* ─── Roles ─────────────────────────────────────────────── */
  async function upsertRole(role) {
    await rolesAPI.upsertRole(role);
  }
  async function deleteRole(id) {
    await rolesAPI.deleteRole(id);
  }

  /* ─── Payroll Confirms ──────────────────────────────────── */
  async function setPayrollConfirm(yearMonth, summary) {
    await payrollConfirmsAPI.setPayrollConfirm(yearMonth, summary);
  }

  /* ─── Legacy setters (deprecated — แต่ component เก่าใช้) ───
     ใน Firebase mode setters เหล่านี้เป็น no-op
     เพราะ data sync ผ่าน real-time subscription                   */
  const noop = (..._args: any[]) =>
    console.warn("[Firebase mode] setter ไม่ถูกใช้ — เรียก action method แทน");

  return {
    // State (real-time from Firestore)
    allLeaves: leavesResult.data,
    employeeDirectory: employeeResult.data,
    salaryData,
    advanceRequests: advResult.data,
    roles: rolesResult.data,
    payrollConfirms: pcResult.data,

    // Status
    loading,
    error,

    // Legacy setters (warn instead of update)
    setAllLeaves: noop,
    setEmployeeDirectory: noop,
    setSalaryData: noop,
    setAdvanceRequests: noop,
    setRoles: noop,
    setPayrollConfirms: noop,

    // Action methods
    addLeave,
    deleteLeave,
    updateEmployee,
    upsertEmployee,
    deleteEmployee,
    updateSalary,
    submitAdvance,
    updateAdvance,
    approveAdvance,
    rejectAdvance,
    upsertRole,
    deleteRole,
    setPayrollConfirm,
  };
}
