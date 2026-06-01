/* ─── Pool Adjustments (ระดับเดือน) ────────────────────────────
   "หักจากกองกลาง" ที่ admin ใส่แยกจากการกรอกค่าคอมของแต่ละคน — บางสินค้า
   ไม่ได้ค่าคอม (เช่น สินค้าโปรโมชั่นฝั่งขาย, ทองแท่ง MD ฝั่งรับซื้อ) แต่ยอด
   ที่พนักงานทำยังนับเข้าเกณฑ์ 80% ตามปกติ. doc id = "{yearMonth}".

   กฎ:
   - เกณฑ์ 80%: ใช้ gross (ไม่หัก) — พนักงานยัง credit อยู่ในกอง
   - กองกลางที่หารแบ่ง: ใช้ net (gross − excluded)
   - ขาย-พิเศษ: ไม่มี adjustment (ใครขายใครได้อยู่แล้ว)                 */
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.POOL_ADJUSTMENTS);

export interface PoolAdjustment {
  excludedNormalPieces?: number; // หักจากกองขายทั่วไป (เช่น โปรโมชั่น)
  excludedBuyPieces?: number; // หักจากกองรับซื้อ (เช่น ทองแท่ง MD)
  excludedNormalNote?: string; // หมายเหตุของ admin (โชว์ในแผนผัง)
  excludedBuyNote?: string;
  updatedAt?: number;
}

export type PoolAdjustmentsByMonth = Record<string, PoolAdjustment>;

export function subscribePoolAdjustments(
  onChange: (data: PoolAdjustmentsByMonth) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    ref,
    (snap) => {
      const result: PoolAdjustmentsByMonth = {};
      snap.docs.forEach((d) => {
        result[d.id] = d.data() as PoolAdjustment;
      });
      onChange(result);
    },
    (err) => {
      console.error("[PoolAdjustments] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function setPoolAdjustment(
  yearMonth: string,
  fields: PoolAdjustment,
) {
  // Sanitize: number fields default to 0, note ตัดความยาว
  await setDoc(
    doc(ref, yearMonth),
    {
      excludedNormalPieces: Math.max(
        0,
        Number(fields.excludedNormalPieces) || 0,
      ),
      excludedBuyPieces: Math.max(0, Number(fields.excludedBuyPieces) || 0),
      excludedNormalNote: (fields.excludedNormalNote || "").slice(0, 120),
      excludedBuyNote: (fields.excludedBuyNote || "").slice(0, 120),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}
