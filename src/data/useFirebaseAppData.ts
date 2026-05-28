/* ─── Firebase Data Hook ─────────────────────────────────────
   Production mode — ใช้ Firestore real-time
   Interface เหมือน useInMemoryAppData แต่:
   - State มาจาก Firestore (real-time sync)
   - Actions เป็น async + เรียก Firestore                          */

import * as advancesAPI from "../firebase/advances";

import * as employeesAPI from "../firebase/employees";
import {
  useAdvancesForScope,
  useEmployeesForScope,
  useLeavesForScope,
  usePayrollConfirmsForScope,
  useRoles,
  useSalariesForScope,
} from "../firebase/hooks/useFirestore";
import * as leavesAPI from "../firebase/leaves";
import * as payrollConfirmsAPI from "../firebase/payrollConfirms";
import * as rolesAPI from "../firebase/roles";
import * as salariesAPI from "../firebase/salaries";

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

  // Aggregate loading/error states
  const loading =
    employeeResult.loading ||
    leavesResult.loading ||
    salResult.loading ||
    advResult.loading ||
    rolesResult.loading ||
    pcResult.loading;
  const error =
    employeeResult.error ||
    leavesResult.error ||
    salResult.error ||
    advResult.error ||
    rolesResult.error ||
    pcResult.error;

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
    await salariesAPI.updateSalary(employeeId, yearMonth, fields);
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
    salaryData: salResult.data,
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
