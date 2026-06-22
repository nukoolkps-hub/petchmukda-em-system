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
import {
  computeCoverageEarningsForMonth,
  employeeHasPoolExemptDuty,
} from "../utils/dutyUtils";
import { countWeekdayLeaves, getOverQuotaDays } from "../utils/leaveUtils";
import {
  buildRateFieldsSnapshot,
  computeEmployeeMonthRow,
  settleEmployeeMonth,
} from "../utils/payrollCompute";
import {
  isMonthLocked,
  monthOf,
  PAYROLL_EDIT_GRACE_MS,
} from "../utils/payrollLock";

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
  async function addLeave(leave) {
    if (monthLocked(monthOf(leave?.start))) throw new Error(LOCK_MSG);
    const id = await leavesAPI.addLeave(leave);
    triggerRecomputeDutyAssignments();
    return id;
  }
  async function deleteLeave(id) {
    const target = leavesResult.data.find((l) => l.id === id);
    if (target && monthLocked(monthOf(target.start))) throw new Error(LOCK_MSG);
    await leavesAPI.deleteLeave(id);
    triggerRecomputeDutyAssignments();
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
    const scalarRateFields = [
      "baseSalary",
      "annualRaiseAmount",
      "roleId",
      "singlePieceRate",
      "normalSalePieceRate",
      "specialSalePieceRate",
      "buyPieceRate",
      "invitePieceRate",
      "transferPieceRate",
      "socialSecurity",
    ];
    const objectRateFields = [
      "annualRaises",
      "poolExclusion",
      "pieceRates",
      "poolItemRates",
      "bonusRates",
    ];
    const salaryAffectingChanged =
      scalarRateFields.some(
        (k) => k in fields && (fields as any)[k] !== (before as any)?.[k],
      ) || objectRateFields.some((k) => k in fields);
    if (salaryAffectingChanged) {
      // subscription (employeeResult.data) ยัง stale ทันทีหลัง write — merge
      // fields ใหม่ลง before ให้ re-stamp/recompute ใช้เรทใหม่ ไม่ใช่เรทเก่าใน state
      const freshEmployee = { ...(before || {}), ...fields, id };
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
      const targets = Object.keys(empSalaries).filter((ym) => {
        if (monthLocked(ym)) return false;
        const confirmed = !!pcResult.data?.[ym]?.confirmedAt;
        return ym === currentYm || confirmed;
      });
      await Promise.allSettled(
        targets.map(async (ym) => {
          try {
            await updateSalary(id, ym, {}, freshEmployee);
            // เดือน grace (ยืนยันแล้วยังไม่ปิดรอบ) → settle net/auto-carry/loan
            // ledger ให้ตรงเรทใหม่ทันที · กัน drift ค้างถาวรตอนเดือนล็อก
            // (ปุ่ม "ยืนยันยอดใหม่" จะหายไป) · เดือนปัจจุบันที่ยังไม่ยืนยันยังไม่มี
            // denorm/auto-carry ให้ settle จึงข้าม
            if (pcResult.data?.[ym]?.confirmedAt) {
              await resettleConfirmedMonth(id, ym, freshEmployee);
            }
          } catch (err) {
            console.warn(
              `[updateEmployee] auto-refresh ${id}/${ym} salary snapshot failed:`,
              err,
            );
          }
        }),
      );
    }
  }
  async function upsertEmployee(employee) {
    const id = await employeesAPI.upsertEmployee(employee.id, employee);
    triggerRecomputeDutyAssignments();
    return id;
  }
  async function deleteEmployee(id) {
    await employeesAPI.deleteEmployee(id);
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
        ...safeFields
      } = fields || {};
      await salariesAPI.updateSalary(employeeId, yearMonth, safeFields);
      return;
    }
    // join ลาด้วย employeeId (ไม่ใช่ชื่อ) — ทนต่อการเปลี่ยนชื่อ/ชื่อซ้ำ
    const monthLeaves = leavesResult.data.filter(
      (leave) =>
        leave.employeeId === employeeId && leave.start.startsWith(yearMonth),
    );
    const weekdayLeaves = countWeekdayLeaves(
      monthLeaves,
      storeCalendarResult.data,
    );
    const overInfo = getOverQuotaDays(monthLeaves, storeCalendarResult.data);
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
  }

  /* ─── Auto-settle เดือนที่ยืนยันแล้วแต่ยังไม่ปิดรอบ (grace) ──────────
     หลัง re-stamp เรทใหม่ → recompute net / auto-carry / loan ledger ของเดือน
     นั้นให้ตรงเรทใหม่ทันที โดยไม่ต้องรอ admin กด "ยืนยันยอดใหม่" (ปุ่มจะหายเมื่อ
     ปิดรอบ → กัน drift ค้างถาวร) · ใช้ shared computeEmployeeMonthRow +
     settleEmployeeMonth ชุดเดียวกับ confirm pipeline (PayrollSummaryPanel)
     เพื่อให้ผลตรงกับการกดยืนยันยอดใหม่เป๊ะ — ไม่ duplicate logic
     freshEmployee: ร่าง employee หลัง merge fields ใหม่ (subscription ยัง stale) */
  async function resettleConfirmedMonth(employeeId, yearMonth, freshEmployee) {
    // patched directory — แทนคนที่เพิ่งแก้ด้วย freshEmployee (state ยังเก่า)
    const directory = employeeResult.data.map((e) =>
      e.id === employeeId ? freshEmployee : e,
    );
    // overlay เรทใหม่ลง salary doc (in-memory ยังเรทเก่า) — resolve*Rate อ่าน
    // snapshot ก่อน live จึงต้องยัดเรทใหม่เข้า data
    const stale = salResult.data?.[employeeId]?.[yearMonth] || {};
    const dataOverride = {
      ...stale,
      roleId: freshEmployee.roleId ?? null,
      poolExclusion: freshEmployee.poolExclusion ?? null,
      ...buildRateFieldsSnapshot(freshEmployee, yearMonth),
    };
    const monthApprovedAdvances = advResult.data.filter(
      (a) => a.month === yearMonth && a.status === "approved",
    );
    const row = computeEmployeeMonthRow({
      employee: freshEmployee,
      yearMonth,
      salaryData: salResult.data,
      allLeaves: leavesResult.data,
      employeeDirectory: directory,
      roles: rolesResult.data,
      employeeLoans: loansResult.data,
      monthApprovedAdvances,
      poolAdjustment: poolAdjResult.data?.[yearMonth] || null,
      storeCalendar: storeCalendarResult.data,
      dataOverride,
    });
    if (!row?.salaryCalculation) return;
    await settleEmployeeMonth(row, yearMonth, loansResult.data, {
      // denorm net ด้วย low-level write (re-stamp ทำไปแล้วก่อนเรียก resettle)
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
    const existing = advResult.data.find(
      (a) =>
        a.employeeId === args.employeeId &&
        a.autoCarryFromMonth === args.sourceMonth,
    );
    if (args.deficitAmount > 0) {
      if (existing) {
        // update amount ถ้าเปลี่ยน (admin re-confirm หลังแก้ salary fields)
        if (existing.amount !== args.deficitAmount) {
          await advancesAPI.updateAutoCarryAdvanceAmount(
            existing.id,
            args.deficitAmount,
          );
        }
      } else {
        await advancesAPI.createAutoCarryAdvance({
          employeeId: args.employeeId,
          employeeName: args.employeeName,
          amount: args.deficitAmount,
          month: args.nextMonth,
          reason: `ยกจากเงินสุทธิติดลบเดือน ${args.sourceMonth}`,
          autoCarryFromMonth: args.sourceMonth,
        });
      }
    } else if (existing) {
      // net กลับมาเป็นบวก → ลบ auto-carry ที่สร้างไว้ก่อนหน้า
      await advancesAPI.deleteAdvance(existing.id);
    }
  }

  async function rejectAdvance(id, reason = "") {
    const target = advResult.data.find((a) => a.id === id);
    if (target && monthLocked(target.month)) throw new Error(LOCK_MSG);
    await advancesAPI.rejectAdvance(id, reason);
  }

  /* ─── Employee Loans (เงินกู้ผ่อนคืน — admin สร้าง) ────────── */
  async function addEmployeeLoan(loan) {
    return await employeeLoansAPI.addEmployeeLoan(loan);
  }
  async function updateEmployeeLoan(id, fields) {
    await employeeLoansAPI.updateEmployeeLoan(id, fields);
  }
  async function deleteEmployeeLoan(id) {
    await employeeLoansAPI.deleteEmployeeLoan(id);
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
    await poolAdjustmentsAPI.setPoolAdjustment(yearMonth, fields);
  }

  /* ─── Store calendar (ปฏิทินเปิด-ปิดร้าน — admin manage) ─── */
  async function updateStoreCalendar(cal) {
    await storeCalendarAPI.updateStoreCalendar(cal);
    triggerRecomputeDutyAssignments(); // duty filter ขึ้นกับ calendar
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
