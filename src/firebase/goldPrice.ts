/* ─── Gold price — ราคาทองคำไทย (อ้างอิงสมาคมค้าทองคำ) ──────────────
   doc เดียว: /config/goldPrice
   - pricePerBaht:  ราคาทองคำแท่งบาทละ (฿)
   - updatedAt:     ms epoch
   - updatedBy:     ชื่อ admin ที่ update ล่าสุด                        */

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./config";

export interface GoldPrice {
  pricePerBaht: number;
  updatedAt: number;
  updatedBy: string;
}

const PATH = "config/goldPrice";

/** ค่าเริ่มต้น — ใช้ก่อน Firestore โหลด · อย่าให้เป็น 0 (จะทำให้ตาราง = 0) */
export const DEFAULT_GOLD_PRICE: GoldPrice = {
  pricePerBaht: 50000,
  updatedAt: 0,
  updatedBy: "",
};

export function subscribeGoldPrice(
  onChange: (g: GoldPrice) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db, PATH),
    (snap) => {
      const data = snap.exists() ? (snap.data() as Partial<GoldPrice>) : {};
      onChange({
        pricePerBaht:
          typeof data.pricePerBaht === "number" && data.pricePerBaht > 0
            ? data.pricePerBaht
            : DEFAULT_GOLD_PRICE.pricePerBaht,
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
      });
    },
    (err) => {
      console.error("[GoldPrice] subscribe error:", err);
      onError?.(err);
    },
  );
}

export interface FetchGoldPriceResult {
  ok: boolean;
  stored: boolean;
  price: number;
  reason?: string;
  sourceDate?: string;
  sourceTime?: string;
}

/** เรียก Cloud Function fetchGoldPriceNow — admin click "ดึงราคาตอนนี้" */
export async function triggerFetchGoldPriceNow(): Promise<FetchGoldPriceResult> {
  const callable = httpsCallable<unknown, FetchGoldPriceResult>(
    functions,
    "fetchGoldPriceNow",
  );
  const res = await callable({});
  return res.data;
}

export async function updateGoldPrice(
  pricePerBaht: number,
  updatedBy: string,
): Promise<void> {
  if (!Number.isFinite(pricePerBaht) || pricePerBaht <= 0) {
    throw new Error("ราคาทองต้องเป็นเลขบวก");
  }
  await setDoc(
    doc(db, PATH),
    {
      pricePerBaht,
      updatedAt: Date.now(),
      updatedBy: updatedBy || "",
    },
    { merge: true },
  );
}
