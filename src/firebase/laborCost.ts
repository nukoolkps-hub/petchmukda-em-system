/* ─── Labor cost — ค่าแรงเริ่มต้น (ทอง 96.5%) ─────────────────────
   doc เดียว: /config/laborCost
   เก็บ override ของ labor base values · default fallback ใน
   `changePriceUtils.ts` (CHANGE_PRICE_WEIGHTS) เมื่อ doc ว่าง/บาง field

   ใช้เป็น single source of truth สำหรับ:
   - ตาราง "ค่าแรง เริ่มต้น" ใน knowledge
   - ตาราง "ค่าเปลี่ยน นน. เท่ากัน" (live)
   - ตาราง "ราคาขาย 96.5% เริ่มต้น" (live)
   - ตาราง "ราคารับซื้อ 96.5%" (live · ใช้แค่ grams ไม่ใช้ labor)  */

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./config";

/** override ของ labor base · key = weightId (เช่น "0.6g", "1-saleung",
 *  "1-baht", "6-saleung", "2-baht-plus") */
export interface LaborCostOverrides {
  values: Record<string, number>;
  updatedAt: number;
  updatedBy: string;
}

const PATH = "config/laborCost";

export const EMPTY_LABOR_COST: LaborCostOverrides = {
  values: {},
  updatedAt: 0,
  updatedBy: "",
};

export function subscribeLaborCost(
  onChange: (data: LaborCostOverrides) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, PATH),
    (snap) => {
      const data = snap.exists()
        ? (snap.data() as Partial<LaborCostOverrides>)
        : {};
      const values: Record<string, number> = {};
      if (data.values && typeof data.values === "object") {
        for (const [k, v] of Object.entries(data.values)) {
          if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
            values[k] = v;
          }
        }
      }
      onChange({
        values,
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
      });
    },
    (err) => {
      console.error("[LaborCost] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function updateLaborCost(
  values: Record<string, number>,
  updatedBy: string,
): Promise<void> {
  // sanitize — เก็บเฉพาะค่าที่เป็นเลขบวก
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      clean[k] = Math.round(v);
    }
  }
  await setDoc(
    doc(db, PATH),
    {
      values: clean,
      updatedAt: Date.now(),
      updatedBy: updatedBy || "",
    },
    { merge: true },
  );
}
