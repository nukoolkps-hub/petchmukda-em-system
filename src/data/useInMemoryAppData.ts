/* ─── In-Memory Data Hook ────────────────────────────────────
   Default mode (สำหรับ demo / ไม่มี Firebase)
   - state เก็บใน React state
   - หาย refresh
   - เร็ว, ไม่ต้องตั้งค่า                                          */

import { useState } from "react";
import {
  ADVANCE_REQUESTS_INIT,
  ALL_LEAVES_INIT,
  EMP_DIR_INIT,
  ROLES_INIT,
  SALARY_INIT,
} from "../seedData";

export default function useInMemoryAppData() {
  const [allLeaves, setAllLeaves] = useState(ALL_LEAVES_INIT);
  const [empDir, setEmpDir] = useState(EMP_DIR_INIT);
  const [salaryData, setSalaryData] = useState(SALARY_INIT);
  const [advanceRequests, setAdvanceRequests] = useState(ADVANCE_REQUESTS_INIT);
  const [roles, setRoles] = useState(ROLES_INIT);
  const [payrollConfirms, setPayrollConfirms] = useState({});

  /* ─── Leaves ────────────────────────────────────────────── */
  function addLeave(leave) {
    const newLeave = { id: Date.now(), ...leave };
    setAllLeaves((prev) => [...prev, newLeave]);
    return newLeave.id;
  }
  function deleteLeave(id) {
    setAllLeaves((prev) => prev.filter((l) => l.id !== id));
  }

  /* ─── Employees ─────────────────────────────────────────── */
  function updateEmployee(id, fields) {
    setEmpDir((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...fields } : e)),
    );
  }
  function upsertEmployee(emp) {
    setEmpDir((prev) => {
      const exists = prev.find((e) => e.id === emp.id);
      if (exists)
        return prev.map((e) => (e.id === emp.id ? { ...e, ...emp } : e));
      return [...prev, emp];
    });
    return emp.id;
  }

  /* ─── Salaries ──────────────────────────────────────────── */
  function updateSalary(empId, ym, fields) {
    setSalaryData((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        [ym]: { ...(prev[empId]?.[ym] || {}), ...fields },
      },
    }));
  }

  /* ─── Advances ──────────────────────────────────────────── */
  function submitAdvance(req) {
    const newReq = {
      id: Date.now(),
      status: "pending",
      submittedAt: new Date().toISOString(),
      slipImg: null,
      ...req,
    };
    setAdvanceRequests((prev) => [newReq, ...prev]);
    return newReq.id;
  }
  function updateAdvance(id, fields) {
    setAdvanceRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...fields } : r)),
    );
  }
  function approveAdvance(id, slipImg = null) {
    updateAdvance(id, {
      status: "approved",
      approvedAt: new Date().toISOString(),
      slipImg,
    });
  }
  function rejectAdvance(id) {
    updateAdvance(id, {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
    });
  }

  /* ─── Roles ─────────────────────────────────────────────── */
  function upsertRole(role) {
    setRoles((prev) => {
      const exists = prev.find((r) => r.id === role.id);
      if (exists)
        return prev.map((r) => (r.id === role.id ? { ...r, ...role } : r));
      return [...prev, role];
    });
  }
  function deleteRole(id) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  }

  /* ─── Payroll Confirms ──────────────────────────────────── */
  function setPayrollConfirm(ym, empId, confirmed) {
    const key = `${ym}_${empId}`;
    setPayrollConfirms((prev) => ({ ...prev, [key]: confirmed }));
  }

  return {
    // State
    allLeaves,
    empDir,
    salaryData,
    advanceRequests,
    roles,
    payrollConfirms,
    // Loading state (ไม่มีในโหมด in-memory แต่ขอ interface เดียวกัน)
    loading: false,
    error: null,

    // Direct setters (legacy, สำหรับ component เก่าที่ยังใช้)
    setAllLeaves,
    setEmpDir,
    setSalaryData,
    setAdvanceRequests,
    setRoles,
    setPayrollConfirms,

    // Action methods (recommended)
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
