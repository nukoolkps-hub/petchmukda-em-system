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
    // ใส่ snapshot ของ roleId / poolExclusion / leave days พร้อมไปด้วย
    // เพื่อให้พนักงานคำนวณ pool ได้โดยไม่ต้องอ่าน employees/leaves ของเพื่อน
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
    // snapshot 3 field นี้เป็น "server-managed" — ดึงออกจาก fields ที่ caller
    // ส่งมา (กันส่งค่าเก่าทับ) แล้วเขียนค่าสดเสมอ (?? null เพื่อให้ "ปลด"
    // poolExclusion/roleId ล้างค่าเดิมใน salary doc ได้ ไม่งั้น pool calc ค้าง)
    const {
      roleId: _ignoredRoleId,
      poolExclusion: _ignoredPoolExclusion,
      totalLeaveDays: _ignoredTotalLeaveDays,
      ...callerFields
    } = fields || {};
    await salariesAPI.updateSalary(employeeId, yearMonth, {
      ...callerFields,
      roleId: employee.roleId ?? null,
      poolExclusion: employee.poolExclusion ?? null,
      totalLeaveDays,
    });
    // mirror non-sensitive pool fields ลง poolSnapshots/{ym} เพื่อให้
    // พนักงานอ่าน pool ของเพื่อนได้โดยไม่ต้องเปิดสิทธิ์อ่าน salary ทั้งใบ
    // (salary ใบเต็มมี note, customDeductions, lateDeduction, ฯลฯ — sensitive).
    // อ่าน salary doc สดหลัง write เพื่อให้ pieces ตรงกับใน salary เสมอ —
    // backfill case (callerFields = {}) ก็ได้ pieces เดิมจาก doc ที่มีอยู่
    try {
      const currentSalary = await salariesAPI.getSalary(employeeId, yearMonth);
      await poolSnapshotsAPI.upsertPoolSnapshot(yearMonth, employeeId, {
        normalSalePieces: currentSalary?.normalSalePieces ?? 0,
        specialSalePieces: currentSalary?.specialSalePieces ?? 0,
        buyPieces: currentSalary?.buyPieces ?? 0,
        roleId: employee.roleId ?? null,
        poolExclusion: employee.poolExclusion ?? null,
        totalLeaveDays,
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
