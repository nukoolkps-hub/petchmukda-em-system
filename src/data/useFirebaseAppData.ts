/* ─── Firebase Data Hook ─────────────────────────────────────
   Production mode — ใช้ Firestore real-time
   Interface เหมือน useInMemoryAppData แต่:
   - State มาจาก Firestore (real-time sync)
   - Actions เป็น async + เรียก Firestore                          */

import * as advancesAPI from "../firebase/advances";

import * as employeesAPI from "../firebase/employees";
import {
  useAdvances,
  useEmployees,
  useLeaves,
  usePayrollConfirms,
  useRoles,
  useSalaries,
} from "../firebase/hooks/useFirestore";
import * as leavesAPI from "../firebase/leaves";
import * as payrollConfirmsAPI from "../firebase/payrollConfirms";
import * as rolesAPI from "../firebase/roles";
import * as salariesAPI from "../firebase/salaries";

export default function useFirebaseAppData() {
  const empResult = useEmployees();
  const leavesResult = useLeaves();
  const salResult = useSalaries();
  const advResult = useAdvances();
  const rolesResult = useRoles();
  const pcResult = usePayrollConfirms();

  // Aggregate loading/error states
  const loading =
    empResult.loading ||
    leavesResult.loading ||
    salResult.loading ||
    advResult.loading ||
    rolesResult.loading ||
    pcResult.loading;
  const error =
    empResult.error ||
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
  async function upsertEmployee(emp) {
    return await employeesAPI.upsertEmployee(emp.id, emp);
  }

  /* ─── Salaries ──────────────────────────────────────────── */
  async function updateSalary(empId, ym, fields) {
    await salariesAPI.updateSalary(empId, ym, fields);
  }

  /* ─── Advances ──────────────────────────────────────────── */
  async function submitAdvance(req) {
    return await advancesAPI.submitAdvance(req);
  }
  async function updateAdvance(id, fields) {
    // Firestore: ไม่มี method generic update — ใช้ approve/reject แทน
    if (fields.status === "approved") {
      await advancesAPI.approveAdvance(id, fields.slipImg);
    } else if (fields.status === "rejected") {
      await advancesAPI.rejectAdvance(id, fields.rejectReason);
    }
  }
  async function approveAdvance(id, slipImg = null) {
    await advancesAPI.approveAdvance(id, slipImg);
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
  async function setPayrollConfirm(ym, empId, confirmed) {
    await payrollConfirmsAPI.setPayrollConfirm(ym, empId, confirmed);
  }

  /* ─── Legacy setters (deprecated — แต่ component เก่าใช้) ───
     ใน Firebase mode setters เหล่านี้เป็น no-op
     เพราะ data sync ผ่าน real-time subscription                   */
  const noop = () =>
    console.warn("[Firebase mode] setter ไม่ถูกใช้ — เรียก action method แทน");

  return {
    // State (real-time from Firestore)
    allLeaves: leavesResult.data,
    empDir: empResult.data,
    salaryData: salResult.data,
    advanceRequests: advResult.data,
    roles: rolesResult.data,
    payrollConfirms: pcResult.data,

    // Status
    loading,
    error,

    // Legacy setters (warn instead of update)
    setAllLeaves: noop,
    setEmpDir: noop,
    setSalaryData: noop,
    setAdvanceRequests: noop,
    setRoles: noop,
    setPayrollConfirms: noop,

    // Action methods
    addLeave,
    deleteLeave,
    updateEmployee,
    upsertEmployee,
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
