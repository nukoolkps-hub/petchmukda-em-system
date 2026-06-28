/* ─── Firebase Data Hook ─────────────────────────────────────
   Production mode — ใช้ Firestore real-time
   Interface เหมือน useInMemoryAppData แต่:
   - State มาจาก Firestore (real-time sync)
   - Actions เป็น async + เรียก Firestore                          */

import { useMemo } from "react";
import * as advancesAPI from "../firebase/advances";
import * as dutiesAPI from "../firebase/duties";
import { triggerRecomputeDutyAssignments } from "../firebase/dutyAssignments";
import * as employeeLoansAPI from "../firebase/employeeLoans";
import * as employeesAPI from "../firebase/employees";
import {
  useAdvancesForScope,
  useDuties,
  useDutyAssignments,
  useEmployeeLoansForScope,
  useEmployeesForScope,
  useLeavesForScope,
  usePayrollConfirmsForScope,
  usePoolAdjustments,
  usePoolSnapshots,
  useRoles,
  useSalariesForScope,
  useStoreCalendar,
} from "../firebase/hooks/useFirestore";
import * as leavesAPI from "../firebase/leaves";
import * as payrollConfirmsAPI from "../firebase/payrollConfirms";
import * as poolAdjustmentsAPI from "../firebase/poolAdjustments";
import * as poolSnapshotsAPI from "../firebase/poolSnapshots";
import * as rolesAPI from "../firebase/roles";
import * as salariesAPI from "../firebase/salaries";
import * as storeCalendarAPI from "../firebase/storeCalendar";
import { wipeEmployeeData } from "../firebase/wipeTestData";
import {
  computeCoverageEarningsForMonth,
  employeeHasPoolExemptDuty,
} from "../utils/dutyUtils";
import {
  countWeekdayLeaves,
  getOverQuotaDays,
  leaveOverlapsMonth,
} from "../utils/leaveUtils";
import {
  buildRateFieldsSnapshot,
  computeMonthSummary,
  diffCalendarChanges,
  diffLoanFields,
  diffPoolAdjustment,
  diffSalaryCounts,
  diffSalaryFields,
  loanSummary,
  SALARY_AFFECTING_OBJECT_FIELDS,
  SALARY_AFFECTING_SCALAR_FIELDS,
  settleEmployeeMonth,
} from "../utils/payrollCompute";
import {
  isMonthLocked,
  monthOf,
  PAYROLL_EDIT_GRACE_MS,
} from "../utils/payrollLock";
import {
  roleBonusItems,
  rolePieceItems,
  rolePoolItems,
} from "../utils/salaryUtils";

interface FirebaseAppDataOptions {
  authUid?: string;
  isAdmin?: boolean;
  /** แจ้งเตือนแบบ non-fatal (เช่น sync poolSnapshot ล้มเหลวบางส่วน) → toast */
  onWarning?: (msg: string) => void;
}

export default function useFirebaseAppData({
  authUid = "",
  isAdmin = false,
  onWarning,
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
  const dutiesResult = useDuties();
  // dutyAssignmentsToday/snapshot — server-computed สำหรับ display ทั้ง 2 ฝั่ง
  // (Firestore rules ปิดให้พนักงานอ่าน employees/leaves ของคนอื่นไม่ได้
  // → client compute ผิด → ใช้ snapshot นี้แทน)
  const dutyAssignmentsResult = useDutyAssignments();
  const pcResult = usePayrollConfirmsForScope({ isAdmin });
  const loansResult = useEmployeeLoansForScope({
    isAdmin,
    employeeId: currentEmployeeId,
  });
  // poolSnapshots: doc per month มี pieces + roleId + poolExclusion + leaveDays
  // ของทุกคน — เป็น public source สำหรับ pool calc ฝั่งพนักงาน (ที่ไม่ได้
  // อ่าน salaries ของคนอื่น). admin ไม่ต้องใช้ก็ได้ — แต่ subscribe ทิ้งไว้
  // ค่า read น้อย (1 doc/เดือน) ไม่กระทบ performance.
  const poolSnapResult = usePoolSnapshots();
  const poolAdjResult = usePoolAdjustments();
  const storeCalendarResult = useStoreCalendar();

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

  // Block loading screen เฉพาะ subscription ที่ "ขาดไม่ได้" สำหรับ render shell:
  // - employees → ต้องรู้ currentEmployee เพื่อ route + แสดง profile/header
  // ที่เหลือ (leaves/salaries/advances/roles/payrollConfirms/poolSnapshots/...)
  // ปล่อยให้ subscribe ใน background — view ของแต่ละ tab handle empty state เอง
  // เหตุผล: ถ้ารอครบทุก sub บน Safari iOS / cold start WebChannel จะค้าง 10-30+
  // วินาที โดยไม่จำเป็น (sub ที่ช้าหนึ่งตัวก็ block หมด)
  const loading = employeeResult.loading;
  const error =
    employeeResult.error ||
    leavesResult.error ||
    salResult.error ||
    advResult.error ||
    rolesResult.error ||
    pcResult.error ||
    poolSnapResult.error ||
    poolAdjResult.error ||
    loansResult.error;

  // เดือน (YYYY-MM) นี้ถูกล็อกถาวรแล้วหรือยัง (พ้น 7 วันหลังยืนยันยอดครั้งแรก)
  function monthLocked(yearMonth: string) {
    return isMonthLocked(pcResult.data?.[yearMonth]);
  }
  const LOCK_MSG = "เดือนนี้ปิดรอบแล้ว (พ้น 7 วันหลังยืนยันยอด) — แก้ไขไม่ได้";

  /* ─── Leaves (real-time → no local setState needed) ────── */
  // คำอธิบายช่วงวันลาแบบสั้นสำหรับ changeLog
  function leaveRangeText(lv: { start: string; end: string }) {
    return lv.start === lv.end ? lv.start : `${lv.start}–${lv.end}`;
  }
  // re-stamp snapshot totalLeaveDays ของพนักงานคนหนึ่ง จาก leaves ที่ override
  // (in-memory ยัง stale หลังเพิ่ม/ลบใบลา) — จำเป็นเพราะ computePoolSharesForGroup
  // อ่าน leave จาก salary snapshot ก่อน (ไม่ใช่ live leaves) → ถ้าไม่ restamp
  // การหักกองกลางจากวันลาจะค้างค่าเก่า (ทั้งที่ over-quota/โบนัสขยันอัปเดตแล้ว)
  // เขียนทั้ง salary doc + mirror poolSnapshot (peer ฝั่งพนักงานอ่าน pool คนนี้)
  // คืน salary doc ใหม่ให้ใส่ salaryDataPatch · null ถ้าไม่มี snapshot เดิม
  // (pool calc fallback ใช้ live leaves อยู่แล้ว — ไม่ต้อง restamp)
  async function restampLeaveSnapshot(
    employeeId: string,
    yearMonth: string,
    overrideLeaves: any[],
    overrideCalendar?: any,
  ) {
    const existing = salResult.data?.[employeeId]?.[yearMonth];
    if (!existing) return null;
    const calendar = overrideCalendar ?? storeCalendarResult.data;
    const monthLeaves = overrideLeaves.filter(
      (l) => l.employeeId === employeeId && leaveOverlapsMonth(l, yearMonth),
    );
    const weekdayLeaves = countWeekdayLeaves(monthLeaves, calendar, yearMonth);
    const overInfo = getOverQuotaDays(monthLeaves, calendar, yearMonth);
    const totalLeaveDays = weekdayLeaves + (overInfo.sundays || 0);
    if (existing.totalLeaveDays === totalLeaveDays) return existing;
    await salariesAPI.updateSalary(employeeId, yearMonth, { totalLeaveDays });
    const patched = { ...existing, totalLeaveDays };
    try {
      await poolSnapshotsAPI.upsertPoolSnapshot(yearMonth, employeeId, {
        totalLeaveDays,
      });
    } catch (err) {
      console.error("[restampLeaveSnapshot] poolSnapshot mirror failed:", err);
      onWarning?.(
        "เตือน: sync ข้อมูลวันลา (กองกลาง) ไม่สำเร็จ — เพื่อนร่วมงานอาจเห็นยอดเก่า ลองแก้อีกครั้ง",
      );
    }
    return patched;
  }
  async function addLeave(leave) {
    if (monthLocked(monthOf(leave?.start))) throw new Error(LOCK_MSG);
    const id = await leavesAPI.addLeave(leave);
    triggerRecomputeDutyAssignments();
    // ลาในเดือนที่ยืนยันยอดแล้ว (grace) → over-quota/โบนัสขยัน + pool เปลี่ยน →
    // re-settle ทั้งเดือน + log (admin เท่านั้น · in-memory leaves ยัง stale →
    // เติม leave ใหม่เข้าไปเอง)
    const ym = monthOf(leave?.start);
    if (isAdmin && pcResult.data?.[ym]?.confirmedAt && !monthLocked(ym)) {
      const emp = employeeResult.data.find((e) => e.id === leave.employeeId);
      const newLeaves = [...leavesResult.data, { id, ...leave }];
      const patched = await restampLeaveSnapshot(
        leave.employeeId,
        ym,
        newLeaves,
      );
      await syncConfirmedMonth(ym, {
        allLeaves: newLeaves,
        salaryDataPatch: patched ? { [leave.employeeId]: patched } : undefined,
        employeeName: emp?.nickname || emp?.name || leave.employeeId,
        changeStrings: [`เพิ่มวันลา ${leaveRangeText(leave)}`],
      });
    }
    return id;
  }
  async function deleteLeave(id) {
    const target = leavesResult.data.find((l) => l.id === id);
    if (target && monthLocked(monthOf(target.start))) throw new Error(LOCK_MSG);
    await leavesAPI.deleteLeave(id);
    triggerRecomputeDutyAssignments();
    const ym = target ? monthOf(target.start) : "";
    if (
      target &&
      isAdmin &&
      pcResult.data?.[ym]?.confirmedAt &&
      !monthLocked(ym)
    ) {
      const emp = employeeResult.data.find((e) => e.id === target.employeeId);
      const newLeaves = leavesResult.data.filter((l) => l.id !== id);
      const patched = await restampLeaveSnapshot(
        target.employeeId,
        ym,
        newLeaves,
      );
      await syncConfirmedMonth(ym, {
        allLeaves: newLeaves,
        salaryDataPatch: patched ? { [target.employeeId]: patched } : undefined,
        employeeName: emp?.nickname || emp?.name || target.employeeId,
        changeStrings: [`ลบวันลา ${leaveRangeText(target)}`],
      });
    }
  }

  /* ─── Employees ─────────────────────────────────────────── */
  async function updateEmployee(id, fields) {
    // เก็บค่าก่อนแก้ไว้เทียบ · ใช้ตัดสินใจว่าต้อง auto-refresh salary snapshot
    // ของเดือนปัจจุบันไหม (กรณี admin แก้ baseSalary แต่ salary doc ยังโชว์เก่า)
    const before = employeeResult.data.find((e) => e.id === id);
    await employeesAPI.updateEmployee(id, fields);
    triggerRecomputeDutyAssignments();
    // ถ้าแก้ field ที่กระทบเงินเดือนพื้นฐาน/เรทค่าคอม/ตำแหน่ง → re-stamp snapshot
    // ของทุกเดือนที่ยังอยู่ในหน้าต่างแก้ไข (ดู targets ด้านล่าง) · ให้ admin เห็น
    // เลขใหม่ทันทีใน SalaryAdminEdit / หน้าเงินเดือน · ไม่ต้องไปกด save salary เอง
    // - scalar: trigger เฉพาะเมื่อค่าจริงเปลี่ยน (กัน write ซ้ำโดยไม่จำเป็น)
    // - object/array (map เรท, annualRaises, poolExclusion): trigger เมื่อมี key
    //   ส่งมา (เทียบ deep ยาก · re-stamp ซ้ำเป็น idempotent ไม่เสียหาย)
    // list มาจาก payrollCompute (single source · ตรงกับ diffSalaryFields เสมอ)
    const salaryAffectingChanged =
      SALARY_AFFECTING_SCALAR_FIELDS.some(
        (k) => k in fields && (fields as any)[k] !== (before as any)?.[k],
      ) || SALARY_AFFECTING_OBJECT_FIELDS.some((k) => k in fields);
    if (salaryAffectingChanged) {
      // subscription (employeeResult.data) ยัง stale ทันทีหลัง write — merge
      // fields ใหม่ลง before ให้ re-stamp/recompute ใช้เรทใหม่ ไม่ใช่เรทเก่าใน state
      const freshEmployee = { ...(before || {}), ...fields, id };
      // รายการ "อะไรเปลี่ยนบ้าง" (human-readable) สำหรับบันทึก changeLog เดือน grace
      // map id→ชื่อรายการ จาก role → โชว์ "ค่าคอมขายเพชร" แทน id ดิบ "(p_1781...)"
      const labelRole = rolesResult.data.find(
        (r) => r.id === (fields.roleId ?? before?.roleId),
      );
      const toLabelMap = (items: { id: string; label: string }[]) =>
        Object.fromEntries(items.map((it) => [it.id, it.label]));
      const itemLabels = {
        poolItemRates: toLabelMap(rolePoolItems(labelRole)),
        pieceRates: toLabelMap(rolePieceItems(labelRole)),
        bonusRates: toLabelMap(roleBonusItems(labelRole)),
        // map id ตำแหน่ง → ชื่อ (changeLog โชว์ "ช่างทอง" แทน id ดิบ)
        roleId: Object.fromEntries(rolesResult.data.map((r) => [r.id, r.name])),
      };
      const changeStrings = diffSalaryFields(before, fields, itemLabels);
      const now = new Date();
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const empSalaries = salResult.data?.[id] || {};
      // re-stamp ทุกเดือนที่ "ยังอยู่ในหน้าต่างแก้ไข" = เดือนปัจจุบัน + เดือนที่
      // ยืนยันยอดแล้วแต่ยังไม่ปิดรอบถาวร (grace period 7 วัน) · ครอบเคสจริง
      // "ยืนยันเดือนก่อนตอนต้นเดือนถัดไป" โดยไม่ต้องไปกดบันทึกเดือนนั้นเอง
      // ข้าม:
      //  - เดือนที่ปิดรอบถาวร (locked) → ห้ามแตะ (updateSalary throw อยู่แล้ว)
      //  - เดือนเปิดเก่าที่ "ไม่เคยยืนยัน" + ไม่ใช่เดือนปัจจุบัน → กันแก้ประวัติ
      //    ย้อนหลังโดยไม่ตั้งใจ (เดือนนั้นควรคงrate ของยุคนั้น · admin จะ
      //    re-stamp เองตอนเปิดเดือนนั้น save/ยืนยัน)
      // เรียงเก่า→ใหม่ + ทำ "ตามลำดับ" (ไม่ขนาน) — เพราะ resettle ของเดือน X
      // สร้าง auto-carry เข้าเดือน X+1 · ถ้าทั้งสองเป็น grace แล้วรันขนานกัน
      // เดือน X+1 อาจอ่าน approved advances ก่อน carry ของ X ถูกเขียน → ยอด
      // X+1 ไม่นิ่ง (race). sequential → X เขียน carry เสร็จก่อน X+1 อ่าน (อ่าน
      // จาก Firestore สด เห็น carry) → ยอดทางการ X+1 ถูกต้อง
      const targets = Object.keys(empSalaries)
        .filter((ym) => {
          if (monthLocked(ym)) return false;
          const confirmed = !!pcResult.data?.[ym]?.confirmedAt;
          return ym === currentYm || confirmed;
        })
        .sort();
      const restampFailedMonths: string[] = [];
      for (const ym of targets) {
        try {
          await updateSalary(id, ym, {}, freshEmployee);
          // เดือน grace (ยืนยันแล้วยังไม่ปิดรอบ) → settle net/auto-carry/loan
          // ledger + sync ยอดทางการ + บันทึก changeLog ให้ตรงเรทใหม่ทันที ·
          // กัน drift ค้างถาวรตอนเดือนล็อก · เดือนปัจจุบันที่ยังไม่ยืนยันยังไม่มี
          // denorm/ยอดทางการ ให้ settle จึงข้าม
          if (pcResult.data?.[ym]?.confirmedAt) {
            await resettleAndSyncMonth(id, ym, freshEmployee, changeStrings);
          }
        } catch (err) {
          console.warn(
            `[updateEmployee] auto-refresh ${id}/${ym} salary snapshot failed:`,
            err,
          );
          restampFailedMonths.push(ym);
        }
      }
      if (restampFailedMonths.length > 0) {
        onWarning?.(
          `เตือน: อัปเดตยอดเงินเดือนบางเดือนไม่สำเร็จ (${restampFailedMonths.join(", ")}) — ลองบันทึกอีกครั้ง`,
        );
      }
    }
  }
  async function upsertEmployee(employee) {
    const id = await employeesAPI.upsertEmployee(employee.id, employee);
    triggerRecomputeDutyAssignments();
    return id;
  }
  async function deleteEmployee(id) {
    // ลบข้อมูลพ่วงทั้งหมด (ลา/เบิก/กู้/เงินเดือนรายเดือน + purge poolSnapshots)
    // ผ่าน cloud function แทนการลบเฉพาะ doc พนักงาน — กันข้อมูลค้าง + กองกลาง
    // (pool) ของเพื่อนเพี้ยนจาก snapshot ที่ยังอ้างถึงคนที่ถูกลบ
    await wipeEmployeeData([id]);
    triggerRecomputeDutyAssignments();
  }
  async function reorderEmployees(orderedIds) {
    await employeesAPI.reorderEmployees(orderedIds);
    triggerRecomputeDutyAssignments();
  }

  /* ─── Salaries ──────────────────────────────────────────── */
  async function updateSalary(
    employeeId,
    yearMonth,
    fields,
    employeeOverride?,
    opts?: { resyncConfirmed?: boolean },
  ) {
    // ปิดรอบแล้ว (พ้น 7 วันหลังยืนยันยอด) → ห้ามแก้ค่าคอม/เงินเดือนเดือนนั้น
    if (monthLocked(yearMonth)) throw new Error(LOCK_MSG);
    // snapshot roleId / poolExclusion / เรท / leave days ลง salary doc ของเดือน
    // นั้น เพื่อให้ (1) พนักงานคำนวณ pool ได้โดยไม่ต้องอ่าน employees/leaves ของ
    // เพื่อน และ (2) ข้อมูลเงินเดือนในอดีต "ล็อก" ไม่ขยับเมื่อเปลี่ยนตำแหน่ง/เรท
    // ในอนาคต
    // employeeOverride: ใช้ตอน caller เพิ่งแก้ employee แล้วเรียกต่อทันที — state
    // subscription (employeeResult.data) ยัง stale อยู่ใน closure เดิม จึงต้อง
    // ส่งร่าง employee ที่ merge fields ใหม่แล้วเข้ามาตรงๆ (กัน re-stamp เรทเก่า)
    const employee =
      employeeOverride ?? employeeResult.data.find((e) => e.id === employeeId);
    if (!employee) {
      // ไม่เจอ employee (ถูกลบ / data ยังโหลดไม่เสร็จ) → เขียนเฉพาะ fields
      // ที่ caller ส่งมา · DON'T touch snapshot fields · ไม่งั้น stomp ของเก่า
      // (roleId/poolExclusion/totalLeaveDays ที่เคย freeze ไว้)
      // strip snapshot keys ที่ caller ส่งมาด้วย กัน partial overwrite พังด้วย
      const {
        roleId: _r,
        poolExclusion: _pe,
        totalLeaveDays: _td,
        baseSalary: _bs,
        singlePieceRate: _sp,
        pieceRates: _pr,
        normalSalePieceRate: _ns,
        specialSalePieceRate: _ss,
        buyPieceRate: _bp,
        invitePieceRate: _ir,
        transferPieceRate: _tr,
        bonusRates: _br,
        poolItemRates: _pir,
        socialSecurity: _soc,
        recurringItems: _ri,
        ...safeFields
      } = fields || {};
      await salariesAPI.updateSalary(employeeId, yearMonth, safeFields);
      return;
    }
    // join ลาด้วย employeeId (ไม่ใช่ชื่อ) — ทนต่อการเปลี่ยนชื่อ/ชื่อซ้ำ
    const monthLeaves = leavesResult.data.filter(
      (leave) =>
        leave.employeeId === employeeId && leaveOverlapsMonth(leave, yearMonth),
    );
    const weekdayLeaves = countWeekdayLeaves(
      monthLeaves,
      storeCalendarResult.data,
      yearMonth,
    );
    const overInfo = getOverQuotaDays(
      monthLeaves,
      storeCalendarResult.data,
      yearMonth,
    );
    const totalLeaveDays = weekdayLeaves + (overInfo.sundays || 0);

    // กฎ "ล็อกเมื่อปิดรอบถาวร": freeze เรท/ตำแหน่งเฉพาะเดือนที่ปิดรอบถาวรแล้ว
    // (พ้น grace 7 วัน) — เดือนพวกนี้ถูก block ที่ต้นฟังก์ชันอยู่แล้ว (throw)
    // ระหว่าง grace period (ยืนยันยอดแล้วแต่ยังไม่ครบ 7 วัน) ตามกฎ "ยังแก้ได้"
    // → ยัง re-stamp เรทสดทุกครั้ง เพื่อให้ admin แก้ rate ค่าคอม/ตำแหน่ง ใน
    // โปรไฟล์ แล้วเงินเดือนเดือนนั้นอัปเดตตาม (ไม่ค้างที่ค่าตอนกดยืนยันยอด)
    // เดิมเช็ค isMonthConfirmed → freeze ทันทีที่ยืนยัน ทำให้แก้เรทใน grace
    // period ไม่มีผล (bug)
    const existingSalary = salResult.data?.[employeeId]?.[yearMonth];
    const hasRateSnapshot =
      existingSalary != null && existingSalary.baseSalary != null;
    const freezeSnapshot = monthLocked(yearMonth) && hasRateSnapshot;
    // coveragePay: preserve เดิมถ้ามี snapshot อยู่แล้ว (กัน admin re-save
    // เดือนที่มี snapshot แล้ว coverage stamp ใหม่จากสถานะ leaves ปัจจุบัน ·
    // เคยทำให้ past month earnings ขยับเงียบ · audit bug E)
    // baseSalary: ไม่ preserve แล้ว — re-stamp ทุกครั้งจาก effective ปัจจุบัน
    // เพื่อเคารพการแก้ baseSalary / annualRaises ใน profile (admin คาดหวังเห็น
    // ยอดสด ไม่ stuck) · เดือนที่ปิดรอบถาวรแล้ว freeze ผ่าน freezeSnapshot ปกติ
    const preserveCoverage = !freezeSnapshot && hasRateSnapshot;

    // ดึง field ที่ระบบจัดการเองออกจาก fields ที่ caller ส่งมา (กันส่งค่าเก่าทับ)
    const {
      roleId: _ignoredRoleId,
      poolExclusion: _ignoredPoolExclusion,
      totalLeaveDays: _ignoredTotalLeaveDays,
      baseSalary: _ignoredBaseSalary,
      singlePieceRate: _ignoredSinglePieceRate,
      pieceRates: _ignoredPieceRates,
      normalSalePieceRate: _ignoredNormalRate,
      specialSalePieceRate: _ignoredSpecialRate,
      buyPieceRate: _ignoredBuyRate,
      invitePieceRate: _ignoredInviteRate,
      transferPieceRate: _ignoredTransferRate,
      bonusRates: _ignoredBonusRates,
      poolItemRates: _ignoredPoolItemRates,
      socialSecurity: _ignoredSocialSecurity,
      recurringItems: _ignoredRecurringItems,
      ...callerFields
    } = fields || {};

    // เดือนนี้คนนี้ทำ monthly duty ที่ให้สิทธิ์กองกลางไหม → ยกเว้นเกณฑ์ 80%
    const poolThresholdExempt = employeeHasPoolExemptDuty(
      employeeId,
      yearMonth,
      dutiesResult.data,
      employeeResult.data,
    );
    // เงินค่าแทน (coverage) ของเดือนนี้ — count × rate ต่อ duty
    const coverage = computeCoverageEarningsForMonth(
      employeeId,
      yearMonth,
      dutiesResult.data,
      employeeResult.data,
      leavesResult.data,
    );

    // snapshot เรท/ตำแหน่งจากข้อมูลพนักงานปัจจุบัน — เขียนเฉพาะตอน "ไม่ freeze"
    // baseSalary: ถ้าเคยมี snapshot อยู่แล้ว → preserve (กัน raise ปีปัจจุบัน
    // เพิ่ม retroactive แล้วเดือนเก่าเด้ง) · ไม่เคยมี → ใช้ effective ของเดือนนั้น
    const rateSnapshot = freezeSnapshot
      ? {}
      : {
          roleId: employee.roleId ?? null,
          poolExclusion: employee.poolExclusion ?? null,
          // snapshot salaryDisabled → กัน flip ในอนาคตทำให้ pool past month
          // เปลี่ยน (computePoolSharesForGroup เคารพ snapshot ก่อน current)
          salaryDisabled: !!employee.salaryDisabled,
          poolThresholdExempt,
          // coveragePay: preserve เดิมถ้ามี snapshot อยู่แล้ว (กัน admin
          // re-save unconfirmed month แล้ว coverage stamp ใหม่จากสถานะ leaves
          // ปัจจุบัน · เคยทำให้ past month earnings ขยับเงียบ · audit bug E)
          coveragePay: preserveCoverage
            ? (existingSalary.coveragePay ?? coverage.total)
            : coverage.total,
          coveragePayBreakdown: preserveCoverage
            ? (existingSalary.coveragePayBreakdown ?? coverage.breakdown)
            : coverage.breakdown,
          // เรท/เงินเดือนพื้นฐาน — freeze ของเดือนนั้น (single source helper)
          ...buildRateFieldsSnapshot(employee, yearMonth),
        };

    await salariesAPI.updateSalary(employeeId, yearMonth, {
      ...callerFields,
      ...rateSnapshot,
      totalLeaveDays,
    });
    // mirror non-sensitive pool fields ลง poolSnapshots/{ym} เพื่อให้พนักงานอ่าน
    // pool ของคนอื่นได้โดยไม่ต้องเปิดสิทธิ์อ่าน salary ทั้งใบ. คำนวณ "snapshot
    // ที่จะอยู่ใน doc หลัง write" จากค่า in-memory โดยตรง — ไม่ต้อง re-read
    // (เร็วกว่า + ทนต่อ network glitch ระหว่าง write กับ read). merge:
    // existingSalary (frozen fields) ← rateSnapshot (live fields if !freeze)
    // ← callerFields (sale counts ที่ caller ส่ง) ← totalLeaveDays (เพิ่งคำนวณ)
    const mirrorSource: Record<string, any> = {
      ...(existingSalary || {}),
      ...callerFields,
      ...rateSnapshot,
      totalLeaveDays,
    };
    try {
      await poolSnapshotsAPI.upsertPoolSnapshot(yearMonth, employeeId, {
        normalSalePieces: mirrorSource.normalSalePieces ?? 0,
        specialSalePieces: mirrorSource.specialSalePieces ?? 0,
        buyPieces: mirrorSource.buyPieces ?? 0,
        // mirror poolItemPieces map (multi-item · รวม custom) เพื่อให้ employee-side
        // pool calc เห็น peers' custom items · ถ้าไม่มี → resolver fallback 0
        poolItemPieces: mirrorSource.poolItemPieces ?? {},
        roleId: mirrorSource.roleId ?? employee.roleId ?? null,
        poolExclusion:
          mirrorSource.poolExclusion ?? employee.poolExclusion ?? null,
        totalLeaveDays: mirrorSource.totalLeaveDays ?? totalLeaveDays,
        poolThresholdExempt:
          mirrorSource.poolThresholdExempt ?? poolThresholdExempt,
      });
    } catch (err) {
      // poolSnapshot write fail = ฝั่งพนักงานเห็น pool ผิดจน save รอบหน้า
      // → throw กลับให้ caller (admin) เห็น error + retry ได้ ดีกว่า silent
      console.error("[Salaries] poolSnapshot mirror failed:", err);
      throw new Error(
        "บันทึกเงินเดือนสำเร็จ แต่ sync pool snapshot ไม่ได้ — กรุณา save อีกครั้ง",
      );
    }
    // resyncConfirmed: เรียกจาก SalaryAdminEdit ตอนแก้จำนวนชิ้น/โบนัส ในเดือน grace
    // (ยืนยันแล้วยังไม่ปิดรอบ) → settle + sync ยอดทางการ + บันทึกประวัติ ให้ consistent
    // กับการแก้เรท (caller อื่น เช่น backfill/re-stamp ไม่ส่ง flag → ไม่ resync/log)
    if (opts?.resyncConfirmed && pcResult.data?.[yearMonth]?.confirmedAt) {
      const role = rolesResult.data.find(
        (r) => r.id === (existingSalary?.roleId ?? employee.roleId),
      );
      const toLabelMap = (items: { id: string; label: string }[]) =>
        Object.fromEntries(items.map((it) => [it.id, it.label]));
      const changeStrings = diffSalaryCounts(existingSalary || {}, fields, {
        poolItemPieces: toLabelMap(rolePoolItems(role)),
        piecePieces: toLabelMap(rolePieceItems(role)),
        bonusCounts: toLabelMap(roleBonusItems(role)),
      });
      // doc ใหม่ = ที่เพิ่งเขียน (existing + callerFields + rateSnapshot + leaveDays)
      const newDoc = {
        ...(existingSalary || {}),
        ...callerFields,
        ...rateSnapshot,
        totalLeaveDays,
      };
      await syncConfirmedMonth(yearMonth, {
        salaryDataPatch: { [employeeId]: newDoc },
        employeeName: employee.nickname || employee.name || employeeId,
        changeStrings,
      });
    }
  }

  /* ─── Core: re-settle เดือน grace ที่ยืนยันแล้วทั้งเดือน → sync + log ─────
     เรียกหลังมีการแก้ใดๆ ที่กระทบ net/ยอดของเดือนที่ยืนยันยอดแล้ว (เรท/ชิ้น/ลา/
     เงินกู้/เบิก/หักกองกลาง/ปิดสิทธิ์) · ADMIN เท่านั้น (เขียน payrollConfirms +
     salaries ของทุกคน)
     - settle "ทุกแถว" (ไม่ใช่แค่คนที่แก้) เพราะการเกลี่ยกองกลาง/หักกองกลาง
       กระทบ net ของเพื่อนทั้งกลุ่ม → denorm/auto-carry/loan ledger ต้องตรงทุกคน
     - override (in-memory subscription ยัง stale หลัง write): salaryDataPatch /
       directory / allLeaves / employeeLoans / poolAdjustment / storeCalendar
     - re-stamp payrollConfirms (preserve firstConfirmedAt/lockAtMs) + changeLog */
  async function syncConfirmedMonth(
    yearMonth: string,
    opts: {
      salaryDataPatch?: Record<string, any>;
      directory?: any[];
      allLeaves?: any[];
      employeeLoans?: any[];
      poolAdjustment?: any;
      storeCalendar?: any;
      employeeName: string;
      changeStrings: string[];
    },
  ) {
    // เฉพาะ admin + เดือนที่ยืนยันยอดแล้ว (ยังไม่ปิดรอบ) เท่านั้น
    if (!isAdmin) return;
    const existingConfirm = pcResult.data?.[yearMonth];
    if (!existingConfirm?.confirmedAt || monthLocked(yearMonth)) return;

    const directory = opts.directory ?? employeeResult.data;
    const allLeaves = opts.allLeaves ?? leavesResult.data;
    const employeeLoans = opts.employeeLoans ?? loansResult.data;
    const poolAdjustment =
      opts.poolAdjustment !== undefined
        ? opts.poolAdjustment
        : (poolAdjResult.data?.[yearMonth] ?? null);
    const storeCalendar = opts.storeCalendar ?? storeCalendarResult.data;
    let salaryData = salResult.data;
    if (opts.salaryDataPatch) {
      salaryData = { ...salResult.data };
      for (const [id, doc] of Object.entries(opts.salaryDataPatch)) {
        salaryData[id] = { ...(salResult.data?.[id] || {}), [yearMonth]: doc };
      }
    }
    // approved advances อ่าน on-demand — admin subscription (advResult) เป็น
    // pending-only จึงหัก advance ไม่ได้ถ้าใช้มัน (net/ยอดสูงเกินจริง)
    const monthApprovedAdvances =
      await advancesAPI.getApprovedAdvancesByMonth(yearMonth);
    const summary = computeMonthSummary({
      activeEmployees: directory.filter((e) => !e.salaryDisabled),
      yearMonth,
      salaryData,
      allLeaves,
      employeeDirectory: directory,
      roles: rolesResult.data,
      employeeLoans,
      monthApprovedAdvances,
      poolAdjustment,
      storeCalendar,
    });
    // 1) settle ทุกแถว (denorm net + auto-carry + loan ledger) · best-effort
    await Promise.allSettled(
      summary.rows.map((row) =>
        settleEmployeeMonth(row, yearMonth, employeeLoans, {
          saveNetDenorm: (id, ym, net, clearDeficit) =>
            salariesAPI.updateSalary(
              id,
              ym,
              clearDeficit
                ? { netSalary: net, deficitClearedAt: null }
                : { netSalary: net },
            ),
          syncAutoCarry: (args) => syncAutoCarryAdvance(args),
          recordLoanRepayment: (loanId, ym, amount) =>
            employeeLoansAPI.recordLoanRepaymentTx(loanId, ym, amount),
        }).catch((err) =>
          console.error(
            `[syncConfirmedMonth] settle ${row.employee.id} failed:`,
            err,
          ),
        ),
      ),
    );
    // 2) auto-sync ยอดทางการ → แบนเนอร์ drift ไม่เด้ง + ยอดไม่ค้างผิดตอนล็อก
    const totalBefore = existingConfirm.totalAmount ?? 0;
    await setPayrollConfirm(yearMonth, {
      confirmedAt: existingConfirm.confirmedAt,
      totalAmount: summary.total,
      employeeCount: summary.count,
      breakdownSig: summary.breakdownSig,
    });
    // 3) บันทึกประวัติการแก้หลังยืนยัน — เฉพาะเมื่อมีผลจริง
    if (opts.changeStrings.length > 0 || totalBefore !== summary.total) {
      try {
        await payrollConfirmsAPI.appendPayrollChangeLog(yearMonth, {
          at: new Date().toISOString(),
          employeeName: opts.employeeName,
          changes: opts.changeStrings,
          totalBefore,
          totalAfter: summary.total,
        });
      } catch (err) {
        console.warn("[syncConfirmedMonth] append change log failed:", err);
      }
    }
  }

  /* ─── แก้เรท/ตำแหน่ง/ปิดสิทธิ์ (จาก updateEmployee) → re-settle เดือน grace ──
     freshEmployee: ร่าง employee หลัง merge fields ใหม่ (subscription ยัง stale) */
  async function resettleAndSyncMonth(
    employeeId,
    yearMonth,
    freshEmployee,
    changeStrings: string[],
  ) {
    // patched directory — แทนคนที่เพิ่งแก้ด้วย freshEmployee (state ยังเก่า)
    const directory = employeeResult.data.map((e) =>
      e.id === employeeId ? freshEmployee : e,
    );
    // overlay เรท/ตำแหน่ง/exclusion/ปิดสิทธิ์ ใหม่ลง salary doc — pool grouping/
    // eligibility ของเดือนนี้ต้องใช้ค่าใหม่ (computePoolSharesForGroup อ่าน
    // snapshot salary ก่อน)
    const stale = salResult.data?.[employeeId]?.[yearMonth] || {};
    const dataOverride = {
      ...stale,
      roleId: freshEmployee.roleId ?? null,
      poolExclusion: freshEmployee.poolExclusion ?? null,
      salaryDisabled: !!freshEmployee.salaryDisabled,
      ...buildRateFieldsSnapshot(freshEmployee, yearMonth),
    };
    await syncConfirmedMonth(yearMonth, {
      salaryDataPatch: { [employeeId]: dataOverride },
      directory,
      employeeName: freshEmployee.nickname || freshEmployee.name || employeeId,
      changeStrings,
    });
  }

  /* ─── Advances ──────────────────────────────────────────── */
  async function submitAdvance(request) {
    if (monthLocked(request?.month)) throw new Error(LOCK_MSG);
    return await advancesAPI.submitAdvance(request);
  }
  async function updateAdvance(id, fields) {
    const target = advResult.data.find((a) => a.id === id);
    if (target && monthLocked(target.month)) throw new Error(LOCK_MSG);
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
    const target = advResult.data.find((a) => a.id === id);
    if (target && monthLocked(target.month)) throw new Error(LOCK_MSG);
    await advancesAPI.approveAdvance(id, slipImageUrl);
    // อนุมัติเบิกในเดือนที่ยืนยันแล้ว (grace) → หักเบิกเพิ่ม → net เปลี่ยน ·
    // getApprovedAdvancesByMonth อ่านสด (เห็นตัวที่เพิ่งอนุมัติ) → ไม่ต้อง override
    const ym = target?.month;
    if (target && pcResult.data?.[ym]?.confirmedAt && !monthLocked(ym)) {
      const emp = employeeResult.data.find((e) => e.id === target.employeeId);
      await syncConfirmedMonth(ym, {
        employeeName: emp?.nickname || emp?.name || target.employeeId,
        changeStrings: [`อนุมัติเบิกล่วงหน้า ${target.amount} ฿`],
      });
    }
  }
  /* ─── Auto-carry advances (deficit เดือนก่อน → advance เดือนถัดไป) ──
     ใช้ตอน admin ยืนยันยอด · ถ้า salaryCalc.netSalary < 0 → สร้าง advance
     status=approved ใน month ถัดไป · idempotent (update amount ถ้าเปลี่ยน) */
  async function syncAutoCarryAdvance(args: {
    sourceMonth: string;
    nextMonth: string;
    employeeId: string;
    employeeName: string;
    deficitAmount: number; // > 0 = สร้าง/update · 0 = ลบ (ถ้ามี)
  }) {
    if (monthLocked(args.nextMonth)) {
      // เดือนถัดไป lock อยู่ → skip · log แต่ไม่ throw (best-effort)
      console.warn(
        `[syncAutoCarryAdvance] ${args.nextMonth} locked · skip carry from ${args.sourceMonth}`,
      );
      return;
    }
    // หา auto-carry เดิมด้วย targeted query (on-demand) — auto-carry เป็น
    // status="approved" จึงไม่อยู่ใน admin pending subscription (advResult) ·
    // เคยใช้ advResult.find → หาไม่เจอ → สร้างซ้ำ/ลบไม่ได้ (bug). cleanup
    // duplicate ที่อาจค้างจากของเดิมด้วย (เก็บตัวแรก ลบที่เหลือ)
    const existingList = await advancesAPI.getAutoCarryAdvances(
      args.employeeId,
      args.sourceMonth,
    );
    const existing = existingList[0] as any;
    const duplicates = existingList.slice(1) as any[];
    // ปัดเป็นจำนวนเต็มบาท — net เป็น float ได้ (coveragePay/recurring) · กัน
    // updateAutoCarryAdvanceAmount เขียนซ้ำจาก rounding noise (1200 vs 1200.0001)
    const deficit = Math.round(args.deficitAmount);
    if (deficit > 0) {
      if (existing) {
        // update amount ถ้าเปลี่ยน (admin re-confirm หลังแก้ salary fields)
        if (Math.round(existing.amount) !== deficit) {
          await advancesAPI.updateAutoCarryAdvanceAmount(existing.id, deficit);
        }
      } else {
        await advancesAPI.createAutoCarryAdvance({
          employeeId: args.employeeId,
          employeeName: args.employeeName,
          amount: deficit,
          month: args.nextMonth,
          reason: `ยกจากเงินสุทธิติดลบเดือน ${args.sourceMonth}`,
          autoCarryFromMonth: args.sourceMonth,
        });
      }
      // ลบ auto-carry ซ้ำที่อาจค้างไว้
      await Promise.allSettled(
        duplicates.map((d) => advancesAPI.deleteAdvance(d.id)),
      );
    } else if (existingList.length > 0) {
      // net กลับมาเป็นบวก → ลบ auto-carry ทุกตัวที่สร้างไว้ก่อนหน้า
      await Promise.allSettled(
        existingList.map((d) => advancesAPI.deleteAdvance(d.id)),
      );
    }
  }

  async function rejectAdvance(id, reason = "") {
    const target = advResult.data.find((a) => a.id === id);
    if (target && monthLocked(target.month)) throw new Error(LOCK_MSG);
    await advancesAPI.rejectAdvance(id, reason);
    // safety net: ถ้าปฏิเสธเบิกที่ "อนุมัติแล้ว" ในเดือน grace → ยอดหักหายไป →
    // re-settle (getApprovedAdvancesByMonth อ่านสด ไม่เห็นตัวที่เพิ่งปฏิเสธ) ·
    // UI ปัจจุบันให้ปฏิเสธเฉพาะรายการ pending (ยังไม่ถูกหัก) → ปกติเป็น no-op
    const ym = target?.month;
    if (
      target?.status === "approved" &&
      pcResult.data?.[ym]?.confirmedAt &&
      !monthLocked(ym)
    ) {
      const emp = employeeResult.data.find((e) => e.id === target.employeeId);
      await syncConfirmedMonth(ym, {
        employeeName: emp?.nickname || emp?.name || target.employeeId,
        changeStrings: [`ปฏิเสธเบิกล่วงหน้า ${target.amount} ฿`],
      });
    }
  }

  /* ─── Employee Loans (เงินกู้ผ่อนคืน — admin สร้าง) ────────── */
  // resync ทุกเดือน grace ของพนักงานคนหนึ่ง (ใช้ตอนแก้เงินกู้ — กระทบหักผ่อน
  // ต่อเดือน · loan เป็นการหักส่วนตัว ไม่กระทบ pool เพื่อน แต่ settle ทั้งเดือน
  // ก็ idempotent กับคนอื่น) · employeeLoansOverride = loans หลังแก้ (state stale)
  async function resyncEmployeeGraceMonths(
    employeeId: string,
    employeeLoansOverride: any[],
    changeStrings: string[],
  ) {
    if (!isAdmin) return;
    const emp = employeeResult.data.find((e) => e.id === employeeId);
    const months = Object.keys(salResult.data?.[employeeId] || {})
      .filter((ym) => pcResult.data?.[ym]?.confirmedAt && !monthLocked(ym))
      .sort();
    for (const ym of months) {
      await syncConfirmedMonth(ym, {
        employeeLoans: employeeLoansOverride,
        employeeName: emp?.nickname || emp?.name || employeeId,
        changeStrings,
      });
    }
  }
  async function addEmployeeLoan(loan) {
    const id = await employeeLoansAPI.addEmployeeLoan(loan);
    await resyncEmployeeGraceMonths(
      loan.employeeId,
      [...loansResult.data, { id, ...loan }],
      [`เพิ่มเงินกู้ผ่อนคืน — ${loanSummary(loan)}`],
    );
    return id;
  }
  async function updateEmployeeLoan(id, fields) {
    const loan = loansResult.data.find((l) => l.id === id);
    await employeeLoansAPI.updateEmployeeLoan(id, fields);
    if (loan) {
      // diff รายละเอียด (เงินต้น/หักต่อเดือน/เดือนเริ่ม/สถานะ) — fallback ข้อความ
      // รวมถ้าไม่มี field ที่ track เปลี่ยน
      const diffs = diffLoanFields(loan, fields);
      await resyncEmployeeGraceMonths(
        loan.employeeId,
        loansResult.data.map((l) => (l.id === id ? { ...l, ...fields } : l)),
        diffs.length ? diffs.map((s) => `แก้เงินกู้ผ่อนคืน — ${s}`) : ["แก้เงินกู้ผ่อนคืน"],
      );
    }
  }
  async function deleteEmployeeLoan(id) {
    const loan = loansResult.data.find((l) => l.id === id);
    await employeeLoansAPI.deleteEmployeeLoan(id);
    if (loan) {
      await resyncEmployeeGraceMonths(
        loan.employeeId,
        loansResult.data.filter((l) => l.id !== id),
        [`ลบเงินกู้ผ่อนคืน — ${loanSummary(loan)}`],
      );
    }
  }

  /* ─── Roles ─────────────────────────────────────────────── */
  async function upsertRole(role) {
    await rolesAPI.upsertRole(role);
  }
  async function upsertDuty(id, data) {
    const newId = await dutiesAPI.upsertDuty(id, data);
    triggerRecomputeDutyAssignments();
    return newId;
  }
  async function deleteDuty(id) {
    await dutiesAPI.deleteDuty(id);
    triggerRecomputeDutyAssignments();
  }
  async function deleteRole(id) {
    await rolesAPI.deleteRole(id);
  }

  /* ─── Payroll Confirms ──────────────────────────────────── */
  async function setPayrollConfirm(yearMonth, summary) {
    const existing = pcResult.data?.[yearMonth];
    // ปิดรอบถาวรแล้ว → ห้ามยืนยันใหม่ (ยอดถูก freeze ไปแล้ว)
    if (isMonthLocked(existing)) throw new Error(LOCK_MSG);
    // firstConfirmedAt + lockAtMs เขียนครั้งเดียวตอนยืนยัน "ครั้งแรก" — ยืนยัน
    // ใหม่ภายหลังไม่รีเซ็ตเวลา (เดดไลน์ล็อกอิงครั้งแรกเสมอ)
    const firstConfirmedAt = existing?.firstConfirmedAt || summary.confirmedAt;
    const lockAtMs =
      typeof existing?.lockAtMs === "number"
        ? existing.lockAtMs
        : new Date(firstConfirmedAt).getTime() + PAYROLL_EDIT_GRACE_MS;
    await payrollConfirmsAPI.setPayrollConfirm(yearMonth, {
      ...summary,
      firstConfirmedAt,
      lockAtMs,
    });
  }

  /* ─── Pool Adjustments (หักจากกองกลาง ระดับเดือน) ────────── */
  async function setPoolAdjustment(yearMonth, fields) {
    if (monthLocked(yearMonth)) throw new Error(LOCK_MSG);
    const prevAdjustment = poolAdjResult.data?.[yearMonth] ?? null;
    // ใช้ items ที่ sanitize แล้ว (บาง item ถูก drop/clamp) เป็น override —
    // ไม่ใช่ raw fields ไม่งั้น net จะคิดจาก item ที่ doc ไม่ได้เก็บจริง
    const saved = await poolAdjustmentsAPI.setPoolAdjustment(yearMonth, fields);
    // หักกองกลางในเดือนที่ยืนยันแล้ว (grace) → กระทบ pool share ทุกคนในกลุ่ม →
    // re-settle ทั้งเดือน + log (poolAdjustment override เพราะ state ยัง stale)
    if (pcResult.data?.[yearMonth]?.confirmedAt && !monthLocked(yearMonth)) {
      // รายละเอียดว่าหักรายการไหน เพิ่ม/ลบ/แก้จำนวนชิ้น — fallback ข้อความรวมถ้า
      // diff ว่าง (เช่น แก้แค่ label) แต่ net ขยับ
      const changeStrings = diffPoolAdjustment(prevAdjustment, saved);
      await syncConfirmedMonth(yearMonth, {
        poolAdjustment: saved,
        employeeName: "หักกองกลาง",
        changeStrings: changeStrings.length
          ? changeStrings
          : ["แก้รายการหักกองกลาง"],
      });
    }
  }

  /* ─── Store calendar (ปฏิทินเปิด-ปิดร้าน — admin manage) ─── */
  // วันที่ (YYYY-MM-DD) ที่ต่างกันระหว่างปฏิทินเก่า/ใหม่ (symmetric diff ทุก array)
  function diffCalendarDates(a: any, b: any): Set<string> {
    const keys = [
      "extraOpenSaturdays",
      "extraClosedWeekdays",
      "paidExtraSaturdays",
      "extraClosedSundays",
    ];
    const changed = new Set<string>();
    for (const k of keys) {
      const sa = new Set<string>(a?.[k] || []);
      const sb = new Set<string>(b?.[k] || []);
      for (const d of sa) if (!sb.has(d)) changed.add(d);
      for (const d of sb) if (!sa.has(d)) changed.add(d);
    }
    return changed;
  }
  async function updateStoreCalendar(cal) {
    const prev = storeCalendarResult.data;
    const changedDates = diffCalendarDates(prev, cal);
    // กันแก้ปฏิทินย้อนหลังเดือนที่ปิดรอบถาวร — ปฏิทินเป็น config กลาง · ถ้าแก้วันใน
    // เดือน locked หน้าจอจะ recompute สด (view คิดจากปฏิทินปัจจุบัน) แต่ net ที่
    // freeze ไม่ขยับ → ตัวเลขเพี้ยน · บล็อกทั้ง batch ถ้ามีวันใดอยู่ในเดือน locked
    for (const d of changedDates) {
      if (monthLocked(d.slice(0, 7))) {
        throw new Error(`ปฏิทินวันที่ ${d} อยู่ในเดือนที่ปิดรอบแล้ว — แก้ไขไม่ได้`);
      }
    }
    await storeCalendarAPI.updateStoreCalendar(cal);
    triggerRecomputeDutyAssignments(); // duty filter ขึ้นกับ calendar
    // ปฏิทินกระทบเงินทุกคนในเดือนนั้น (จ่ายเพิ่มเสาร์พิเศษ + ฐานนับวันลา/×1.5) →
    // re-settle เดือนที่ยืนยันแล้วยังไม่ปิดรอบ + log (admin เท่านั้น)
    if (!isAdmin) return;
    // รายละเอียดวันที่เปลี่ยน ต่อเดือน (เปิด/ปิด/จ่ายเพิ่ม) — แทนข้อความรวม
    const changesByMonth = diffCalendarChanges(prev, cal);
    const affectedMonths = new Set([...changedDates].map((d) => d.slice(0, 7)));
    // เรียงเก่า→ใหม่ + sequential — กัน auto-carry race ข้ามเดือน (เหมือน updateEmployee)
    const months = [...affectedMonths]
      .filter((ym) => pcResult.data?.[ym]?.confirmedAt && !monthLocked(ym))
      .sort();
    for (const ym of months) {
      // calendar ใหม่ → การนับวันลาเปลี่ยน → restamp totalLeaveDays ทุกคนที่มี
      // salary doc เดือนนั้น (pool leave-deduction อ่าน snapshot) · no-op ถ้าไม่เปลี่ยน
      const patch: Record<string, any> = {};
      for (const empId of Object.keys(salResult.data || {})) {
        if (!salResult.data[empId]?.[ym]) continue;
        const patched = await restampLeaveSnapshot(
          empId,
          ym,
          leavesResult.data,
          cal,
        );
        if (patched) patch[empId] = patched;
      }
      await syncConfirmedMonth(ym, {
        storeCalendar: cal,
        salaryDataPatch: Object.keys(patch).length ? patch : undefined,
        employeeName: "ปฏิทินร้าน",
        changeStrings: changesByMonth[ym]?.length
          ? changesByMonth[ym]
          : ["แก้ปฏิทินเปิด-ปิดร้าน"],
      });
    }
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
    duties: dutiesResult.data,
    dutyAssignmentsToday: dutyAssignmentsResult.data,
    payrollConfirms: pcResult.data,
    poolAdjustments: poolAdjResult.data,
    employeeLoans: loansResult.data,
    storeCalendar: storeCalendarResult.data,

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
    reorderEmployees,
    updateSalary,
    submitAdvance,
    updateAdvance,
    approveAdvance,
    rejectAdvance,
    syncAutoCarryAdvance,
    upsertRole,
    upsertDuty,
    deleteDuty,
    deleteRole,
    setPayrollConfirm,
    setPoolAdjustment,
    updateStoreCalendar,
    addEmployeeLoan,
    updateEmployeeLoan,
    deleteEmployeeLoan,
  };
}
