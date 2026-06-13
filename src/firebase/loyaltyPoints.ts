/* ─── Loyalty points redeem — สะสมแต้ม แลก ทองคำแท่ง ──────────────
   doc เดียว: /config/loyaltyPoints
   เก็บแค่ตารางแลกของรางวัล (string ทุก field รองรับ "1.905 กรัม (½ สลึง)")
   default fallback ใน DEFAULT_LOYALTY_POINTS_VALUES                        */

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./config";

export interface LoyaltyPointsOverrides {
  values: Record<string, string>;
  updatedAt: number;
  updatedBy: string;
}

const PATH = "config/loyaltyPoints";

/** ค่า default ทุก cell · key รูป redeem-rN-pts/gold · value = string */
export const DEFAULT_LOYALTY_POINTS_VALUES: Record<string, string> = {
  "redeem-r1-pts": "20 แต้ม",
  "redeem-r1-gold": "0.3 กรัม",
  "redeem-r2-pts": "35 แต้ม",
  "redeem-r2-gold": "0.6 กรัม",
  "redeem-r3-pts": "55 แต้ม",
  "redeem-r3-gold": "1.0 กรัม",
  "redeem-r4-pts": "100 แต้ม",
  "redeem-r4-gold": "1.905 กรัม (½ สลึง)",
  "redeem-r5-pts": "190 แต้ม",
  "redeem-r5-gold": "3.811 กรัม (1 สลึง)",
};

export const EMPTY_LOYALTY_POINTS: LoyaltyPointsOverrides = {
  values: {},
  updatedAt: 0,
  updatedBy: "",
};

export function subscribeLoyaltyPoints(
  onChange: (data: LoyaltyPointsOverrides) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, PATH),
    (snap) => {
      const data = snap.exists()
        ? (snap.data() as Partial<LoyaltyPointsOverrides>)
        : {};
      const values: Record<string, string> = {};
      if (data.values && typeof data.values === "object") {
        for (const [k, v] of Object.entries(data.values)) {
          if (typeof v === "string" && v.length <= 80) {
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
      console.error("[LoyaltyPoints] subscribe error:", err);
      onError?.(err);
    },
  );
}

export async function updateLoyaltyPoints(
  values: Record<string, string>,
  updatedBy: string,
): Promise<void> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && v.trim().length > 0 && v.length <= 80) {
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
export function getLoyaltyPointsValue(
  overrides: Record<string, string>,
  key: string,
): string {
  return overrides[key] ?? DEFAULT_LOYALTY_POINTS_VALUES[key] ?? "";
}
