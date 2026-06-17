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

/** รายการยกเว้นค่าคอม 1 รายการ — 2 variant ตาม kind
 *  - kind="pool" (default): หักจากกองกลาง (poolGroup + ฝั่ง normal/buy) · เดิม
 *  - kind="piece":            หักจาก count ของพนักงานคนนึง รายการเดียว
 *    (employeeId + pieceItemId) · สำหรับตำแหน่ง multi-item
 *  รายการเก่าที่ไม่มี kind ให้ default เป็น "pool" (backward-compat)              */
export interface PoolAdjustmentItem {
  id: string;
  kind?: "pool" | "piece";
  // pool variant
  poolGroup?: string;
  side?: "normal" | "buy";
  // piece variant (multi-item)
  employeeId?: string;
  pieceItemId?: string;
  // ใช้ทั้ง 2 variant
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
  // รองรับทั้ง variant "pool" (เดิม) + "piece" (multi-item per-employee)
  const items = (fields.items || [])
    .map<PoolAdjustmentItem>((it) => {
      const kind: "pool" | "piece" = it.kind === "piece" ? "piece" : "pool";
      const base = {
        id: it.id || randomId(),
        kind,
        pieces: Math.max(0, Number(it.pieces) || 0),
        label: (it.label || "").slice(0, 120),
      };
      if (kind === "piece") {
        return {
          ...base,
          employeeId: it.employeeId || "",
          pieceItemId: it.pieceItemId || "",
          // ลบ field ของ pool variant กันค้าง
          poolGroup: null as any,
          side: null as any,
        };
      }
      return {
        ...base,
        poolGroup: it.poolGroup || "",
        side: it.side === "buy" ? "buy" : "normal",
        employeeId: null as any,
        pieceItemId: null as any,
      };
    })
    .filter((it) => it.pieces > 0 || it.label.trim().length > 0)
    // pool variant ต้องมี poolGroup · piece variant ต้องมี employeeId + pieceItemId
    .filter((it) =>
      it.kind === "piece"
        ? !!it.employeeId && !!it.pieceItemId
        : !!it.poolGroup,
    );

  await setDoc(doc(ref, yearMonth), {
    items,
    updatedAt: Date.now(),
  });
}
