/* ─── Pool Snapshots (public, non-sensitive copy of pool-calc fields) ──
   Path: /poolSnapshots/{yearMonth}
   Shape: { [employeeId]: { normalSalePieces, specialSalePieces, buyPieces,
            roleId, poolExclusion, totalLeaveDays } }

   ทำไมต้องมี collection แยก:
   - salaries มี field sensitive (note, customDeductions, socialSecurity,
     slipUrl ฯลฯ) — เปิดอ่านให้พนักงานทุกคนไม่ได้
   - แต่ pool calc ต้องอ่าน pieces + roleId + poolExclusion + leave ของ
     เพื่อนทั้งกลุ่ม → ถ้าล็อก salaries แล้ว pool จะคำนวณผิด
   - แก้: คัดเฉพาะ field ที่จำเป็นต่อ pool ออกมาใส่ doc public — เปิดอ่านได้
     ทั่ว, salaries กลับไปล็อกแค่ admin/เจ้าของ                                */
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./config";

const COLLECTION = "poolSnapshots";

export interface PoolSnapshotFields {
  normalSalePieces?: number;
  specialSalePieces?: number;
  buyPieces?: number;
  roleId?: string | null;
  poolExclusion?: string | null;
  totalLeaveDays?: number;
}

export type PoolSnapshotsByMonth = Record<
  string,
  Record<string, PoolSnapshotFields>
>;

export function subscribeAllPoolSnapshots(
  onChange: (data: PoolSnapshotsByMonth) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    collection(db, COLLECTION),
    (snap) => {
      const result: PoolSnapshotsByMonth = {};
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const byEmployee: Record<string, PoolSnapshotFields> = {};
        for (const [key, value] of Object.entries(data)) {
          // skip meta field ของ doc (ไม่ใช่ employeeId)
          if (key === "updatedAt") continue;
          if (value && typeof value === "object") {
            byEmployee[key] = value as PoolSnapshotFields;
          }
        }
        result[d.id] = byEmployee;
      });
      onChange(result);
    },
    (err) => {
      console.error("[PoolSnapshots] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function upsertPoolSnapshot(
  yearMonth: string,
  employeeId: string,
  fields: PoolSnapshotFields,
) {
  await setDoc(
    doc(db, COLLECTION, yearMonth),
    { [employeeId]: fields, updatedAt: Date.now() },
    { merge: true },
  );
}
