/* ─── Duty Assignments Today (server-computed snapshot) ────────
   Path: /dutyAssignmentsToday/snapshot

   ทำไม:
   - Firestore rules ปิดให้พนักงานอ่าน employees/leaves ของคนอื่นไม่ได้
   - ฝั่ง client compute → activePool เหลือแค่ตัวเอง → rotation ผิด
   - Cloud Function (admin SDK) compute → เขียน snapshot → ทุกคนอ่านได้

   Recompute trigger:
   - Scheduled daily 00:01 Bangkok (วันเปลี่ยน → period index เปลี่ยน)
   - Callable `recomputeDutyAssignments` — client เรียกหลัง CRUD ที่กระทบ
     (duty/employee/leave)                                                  */

import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./config";

/** Safe employee projection — server เลือกเฉพาะ field public */
export interface SnapshotPoolMember {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  avatarType: "text" | "emoji" | "image";
  avatarImageUrl: string | null;
  displayOrder: number | null;
}

export interface SnapshotAssignment {
  dutyId: string;
  dutyName: string;
  kind?: "rotation" | "coverage";
  period: "weekly" | "monthly";
  primaryEmpId: string | null;
  actualEmpId: string | null;
  targetEmpId?: string | null; // coverage: คนในตำแหน่งเป้าหมายที่ลา
  targetName?: string | null; // ชื่อ target (denorm)
  reason:
    | "rotation"
    | "substitute_for_leave"
    | "double_up"
    | "all_on_leave"
    | "empty_pool"
    | "coverage"
    | "coverage_no_candidate"
    | "empty_target_role"
    | "target_present";
  periodStart: string;
  periodEnd: string;
  pool: SnapshotPoolMember[];
  excludedCount: number;
}

/** คนแทนตำแหน่งเป้าหมายล่วงหน้า (coverage duty · จากใบลาที่ยื่นไว้) —
 *  server-computed เพราะต้อง replay ยุติธรรม + รู้ leaves ทุกคน (พนักงาน
 *  อ่าน peer data เองไม่ได้) · target อยู่คนละตำแหน่งกับ pool → denorm ชื่อ */
export interface CoverageForecastItem {
  dutyId: string;
  dutyName: string;
  start: string; // YYYY-MM-DD (inclusive)
  end: string; // YYYY-MM-DD (inclusive)
  targetEmpId: string;
  targetName: string | null;
  substituteEmpId: string | null;
  substituteName: string | null;
}

/** เงินค่าแทน "สด" ของเดือนปัจจุบัน ต่อพนักงาน — server-computed · พนักงาน
 *  เห็นยอดทันทีที่ถูกเลือกมาแทน (preview) ก่อน admin ยืนยันยอด */
export interface CoverageThisMonth {
  month: string; // "YYYY-MM"
  byEmp: Record<
    string,
    {
      total: number;
      breakdown: {
        dutyId: string;
        dutyName: string;
        count: number;
        rate: number;
        subtotal: number;
      }[];
    }
  >;
}

export interface DutyAssignmentsSnapshot {
  date: string;
  assignments: SnapshotAssignment[];
  /** อาจไม่มีใน snapshot เก่า (ก่อน feature นี้) → treat as [] */
  coverageForecast?: CoverageForecastItem[];
  /** เงินค่าแทนสดเดือนปัจจุบัน · อาจไม่มีใน snapshot เก่า */
  coverageThisMonth?: CoverageThisMonth;
  updatedAt: number;
}

const SNAPSHOT_PATH = "dutyAssignmentsToday/snapshot";

export function subscribeDutyAssignments(
  onChange: (snap: DutyAssignmentsSnapshot | null) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, SNAPSHOT_PATH),
    (s) => {
      onChange(s.exists() ? (s.data() as DutyAssignmentsSnapshot) : null);
    },
    (err) => {
      console.error("[DutyAssignments] subscribe error:", err);
      onError?.(err);
    },
  );
}

/** Trigger Cloud Function เพื่อ refresh snapshot — เรียกหลัง CRUD ที่กระทบ
 *  rotation (duty/employee/leave). Fire-and-forget — error log แต่ไม่ throw
 *  เพราะ CRUD operation ที่ trigger เรา succeed ไปแล้ว                       */
let pendingTrigger: Promise<unknown> | null = null;
export function triggerRecomputeDutyAssignments(): Promise<unknown> {
  // dedup overlapping calls — ถ้ามี request ค้างอยู่ ก็คืน promise เดิม
  if (pendingTrigger) return pendingTrigger;
  const callable = httpsCallable(functions, "recomputeDutyAssignments");
  pendingTrigger = callable({})
    .catch((err: unknown) => {
      console.error("[triggerRecomputeDutyAssignments] failed:", err);
    })
    .finally(() => {
      pendingTrigger = null;
    });
  return pendingTrigger;
}
