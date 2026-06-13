/* ─── Block cost — ค่าบล็อก (ทองคำแท่ง + เงินแท่ง) + ค่าประกัน ───
   doc เดียว: /config/blockCost
   เก็บเป็น string ทุก field (เพราะบาง row มี "300 / 350 / 450" format)
   default fallback ใน DEFAULT_BLOCK_COST เมื่อ doc ว่าง/บาง field         */

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./config";

export interface BlockCostOverrides {
  values: Record<string, string>;
  updatedAt: number;
  updatedBy: string;
}

const PATH = "config/blockCost";

/** ค่า default ทุก cell · key = rowId · value = string (รองรับ "300 / 350 / 450") */
export const DEFAULT_BLOCK_COST_VALUES: Record<string, string> = {
  // ทองคำแท่ง · ค่าบล็อก
  "gold-005g-1baht": "300 / 350 / 450",
  "gold-2baht": "500 / 600 / 900",
  "gold-5baht": "1,000",
  "gold-10baht": "1,000",
  "gold-1kilo": "6,500",
  // ทองคำแท่ง · ค่าส่ง
  "gold-ship-005g-10baht": "60",
  "gold-ship-1kilo": "200",
  // เงินแท่ง · ค่าบล็อก
  "silver-half-1baht": "350",
  "silver-5baht": "500",
  "silver-10baht": "700",
  "silver-20baht": "1,000",
  "silver-1kilo": "2,000",
  // เงินแท่ง · ค่าส่ง
  "silver-ship-1baht-10baht": "60",
  "silver-ship-20baht": "100",
  "silver-ship-1kilo": "200",
  // ค่าประกัน
  "insurance-pct": "1.5",
  "insurance-max": "200,000",
};

export const EMPTY_BLOCK_COST: BlockCostOverrides = {
  values: {},
  updatedAt: 0,
  updatedBy: "",
};

export function subscribeBlockCost(
  onChange: (data: BlockCostOverrides) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, PATH),
    (snap) => {
      const data = snap.exists()
        ? (snap.data() as Partial<BlockCostOverrides>)
        : {};
      const values: Record<string, string> = {};
      if (data.values && typeof data.values === "object") {
        for (const [k, v] of Object.entries(data.values)) {
          if (typeof v === "string" && v.length <= 60) {
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
      console.error("[BlockCost] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function updateBlockCost(
  values: Record<string, string>,
  updatedBy: string,
): Promise<void> {
  // sanitize — string เท่านั้น · ตัดให้สั้นกัน abuse
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && v.trim().length > 0 && v.length <= 60) {
      clean[k] = v.trim();
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

/** merge default + overrides */
export function getBlockCostValue(
  overrides: Record<string, string>,
  key: string,
): string {
  return overrides[key] ?? DEFAULT_BLOCK_COST_VALUES[key] ?? "";
}
