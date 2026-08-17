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
  buyPrice: number;
  /** ราคาเงิน/กรัม รับซื้อ (bid_g_price จาก DoDev) */
  silverBuyPerGram: number;
  /** ราคาเงิน/กรัม ขายออก รวม VAT 7% (ask_g_price จาก DoDev) */
  silverSellPerGram: number;
  updatedAt: number;
  updatedBy: string;
  lastFetchError: string;
  lastFetchErrorAt: number;
  /** ค่าเปลี่ยน นน. เท่ากัน ตามที่ขึ้น "จอราคาร้าน" — key = weight id ฝั่งจอ
   *  (`ChangePriceWeight.excId`) · ว่าง = จอไม่ได้ส่งมา (fallback คำนวณเอง) */
  changeRates: Record<string, number>;
  /** ราคาทองที่จอใช้คำนวณ changeRates ชุดนี้ — ไม่ตรง pricePerBaht = ค้าง */
  changeRatesForPrice: number;
}

const PATH = "config/goldPrice";

/** ค่าเริ่มต้น — ใช้ก่อน Firestore โหลด · อย่าให้เป็น 0 (จะทำให้ตาราง = 0) */
export const DEFAULT_GOLD_PRICE: GoldPrice = {
  pricePerBaht: 50000,
  buyPrice: 0,
  silverBuyPerGram: 0,
  silverSellPerGram: 0,
  updatedAt: 0,
  updatedBy: "",
  lastFetchError: "",
  lastFetchErrorAt: 0,
  changeRates: {},
  changeRatesForPrice: 0,
};

/** เก็บเฉพาะค่าเปลี่ยนที่เป็นเลขบวก (กัน payload เพี้ยนทำตารางโชว์ 0/NaN) */
function sanitizeChangeRates(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rates: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) rates[k] = v;
  }
  return rates;
}

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
        buyPrice:
          typeof data.buyPrice === "number" && data.buyPrice > 0
            ? data.buyPrice
            : 0,
        silverBuyPerGram:
          typeof data.silverBuyPerGram === "number" && data.silverBuyPerGram > 0
            ? data.silverBuyPerGram
            : 0,
        silverSellPerGram:
          typeof data.silverSellPerGram === "number" &&
          data.silverSellPerGram > 0
            ? data.silverSellPerGram
            : 0,
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
        lastFetchError:
          typeof data.lastFetchError === "string" ? data.lastFetchError : "",
        lastFetchErrorAt:
          typeof data.lastFetchErrorAt === "number" ? data.lastFetchErrorAt : 0,
        changeRates: sanitizeChangeRates(data.changeRates),
        changeRatesForPrice:
          typeof data.changeRatesForPrice === "number" &&
          data.changeRatesForPrice > 0
            ? data.changeRatesForPrice
            : 0,
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
