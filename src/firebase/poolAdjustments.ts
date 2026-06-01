/* ─── Pool Adjustments (ระดับเดือน) ────────────────────────────
   "หักจากกองกลาง" ที่ admin ใส่แยกจากการกรอกค่าคอมของแต่ละคน — บางสินค้า
   ไม่ได้ค่าคอม (สินค้าโปรโมชั่นฝั่งขาย, ทองแท่ง MD ฝั่งรับซื้อ ฯลฯ) แต่ยอด
   ที่พนักงานทำยังนับเข้าเกณฑ์ 80% ตามปกติ.

   doc id = "{yearMonth}" · shape:
   {
     items: [{ id, side: "normal"|"buy", pieces, label }],
     updatedAt
   }

   กฎ:
   - เกณฑ์ 80%: ใช้ gross (ไม่หัก) — พนักงานยังมีสิทธิ์อยู่ในกอง
   - กองกลางที่หารแบ่ง: ใช้ net (gross − sum of items)
   - ขาย-พิเศษ: ไม่มี adjustment (ใครขายใครได้อยู่แล้ว)                 */
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { COLLECTIONS, db } from "./config";

const ref = collection(db, COLLECTIONS.POOL_ADJUSTMENTS);

export interface PoolAdjustmentItem {
  id: string;
  poolGroup: string; // ตำแหน่ง/กลุ่มกองกลางที่รายการนี้สังกัด (role.poolGroup)
  side: "normal" | "buy";
  pieces: number;
  label: string;
}

export interface PoolAdjustment {
  items?: PoolAdjustmentItem[];
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

function randomId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export async function setPoolAdjustment(
  yearMonth: string,
  fields: PoolAdjustment,
) {
  // Sanitize items — ตัดรายการว่าง · clamp pieces ≥ 0 · ตัด label ยาว
  const items = (fields.items || [])
    .map<PoolAdjustmentItem>((it) => ({
      id: it.id || randomId(),
      poolGroup: it.poolGroup || "",
      side: it.side === "buy" ? "buy" : "normal",
      pieces: Math.max(0, Number(it.pieces) || 0),
      label: (it.label || "").slice(0, 120),
    }))
    .filter((it) => it.pieces > 0 || it.label.trim().length > 0);

  await setDoc(doc(ref, yearMonth), {
    items,
    updatedAt: Date.now(),
  });
}
